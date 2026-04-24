package com.runcrew.gps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.runcrew.gps.filter.KalmanFilter
import com.runcrew.gps.filter.OutlierDetector
import com.runcrew.gps.filter.StationaryDetector
import com.runcrew.gps.model.FilteredLocation
import com.runcrew.gps.model.GPSPoint
import com.runcrew.gps.model.RunSession
import com.runcrew.gps.sensor.SensorFusionManager
import com.runcrew.gps.util.BatteryOptimizer
import com.runcrew.gps.util.CoordinateConverter
import com.runcrew.gps.util.GeoMath

/**
 * Wraps FusedLocationProviderClient and orchestrates the full filtering pipeline:
 *
 *   FusedLocation -> [Validity Check] -> [Outlier Removal] -> [Kalman Filter]
 *                -> [Sensor Fusion] -> FilteredLocation
 *
 * This class owns all filter/sensor components and the RunSession state.
 * It receives raw location callbacks on the main thread and processes them
 * through the pipeline, emitting filtered results to a listener.
 */
class LocationEngine(
    private val context: Context
) {
    companion object {
        private const val TAG = "LocationEngine"

        // Cold start: GPS accuracy must be below this before data is used (unified with iOS)
        private const val COLD_START_ACCURACY_THRESHOLD = 20f

        // Cold start timeout (ms): if accuracy never drops below threshold
        private const val COLD_START_TIMEOUT_MS = 30_000L

        // GPS status: if no update for this duration, GPS is "lost"
        private const val GPS_LOST_TIMEOUT_MS = 10_000L

        /**
         * Load persisted run state after crash recovery.
         */
        fun loadPersistedState(context: Context): Map<String, Any>? {
            val prefs = context.getSharedPreferences("runvs_run_state", Context.MODE_PRIVATE)
            val savedAt = prefs.getLong("savedAt", 0)
            if (savedAt == 0L) return null
            return mapOf(
                "distance" to prefs.getFloat("distance", 0f).toDouble(),
                "duration" to prefs.getLong("duration", 0),
                "startTime" to prefs.getLong("startTime", 0),
                "phase" to (prefs.getString("phase", "running") ?: "running"),
                "savedAt" to savedAt,
            )
        }

        /**
         * Clear persisted run state (static version for use without engine instance).
         */
        fun clearPersistedState(context: Context) {
            context.getSharedPreferences("runvs_run_state", Context.MODE_PRIVATE)
                .edit().clear().apply()
        }
    }

    // --- Public listener interface ---

    interface Listener {
        fun onFilteredLocationUpdate(location: FilteredLocation, session: RunSession)
        fun onSummaryUpdate(summary: Map<String, Any>)
        fun onGPSStatusChange(status: String, accuracy: Float?, satelliteCount: Int)
        fun onRunningStateChange(state: String, durationMs: Long)
        fun onMilestoneReached(km: Int, splitPaceSecondsPerKm: Int, totalTimeSeconds: Int)
        fun onError(code: String, message: String)
    }

    var listener: Listener? = null

    // --- Components ---

    private val coordinateConverter = CoordinateConverter()
    internal val kalmanFilter = KalmanFilter(coordinateConverter)
    private val outlierDetector = OutlierDetector()
    private val batteryOptimizer = BatteryOptimizer()

    // Sensor components are initialized lazily (need SensorManager from context)
    internal var sensorFusionManager: SensorFusionManager? = null
    private var stationaryDetector: StationaryDetector? = null

    val session = RunSession()

    // --- FusedLocationProvider ---

    private var fusedLocationClient: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null

    // --- Cold start state ---

    @Volatile
    private var coldStartComplete = false
    @Volatile
    private var coldStartBeginTime = 0L

    // --- GPS status tracking ---

    @Volatile
    private var lastGpsUpdateTime = 0L
    @Volatile
    private var currentGpsStatus = "searching"

    // --- Satellite tracking ---

    @Volatile
    private var satelliteCount = 0
    @Volatile
    private var usedSatelliteCount = 0

    private var gnssStatusCallback: GnssStatus.Callback? = null

    // --- Summary timer (1-second cadence, emits aggregated metrics to JS) ---

    private var summaryHandler: Handler? = null
    private var summaryRunnable: Runnable? = null

    @Volatile
    private var lastGPSAccuracy: Float = 0f
    @Volatile
    var lastCadenceSPM: Int = 0

    // --- Crash recovery persistence ---
    @Volatile
    private var lastPersistTime = 0L

    // --- Previous filtered location for distance calculation ---

    @Volatile
    private var previousFilteredLat = 0.0
    @Volatile
    private var previousFilteredLng = 0.0

    // --- Milestone (split) tracking ---

    @Volatile
    private var previousMilestoneDistance = 0.0
    @Volatile
    private var previousMilestoneTime = 0L  // elapsed ms at last km milestone

    // --- Indoor / pedometer fallback ---
    // Uses a dedicated HandlerThread instead of the main looper so callbacks
    // fire reliably even if the main thread is busy (e.g., during UI rendering).
    private var pedometerHandlerThread: HandlerThread? = null
    private var pedometerHandler: android.os.Handler? = null
    private var pedometerFallbackRunnable: Runnable? = null
    @Volatile
    private var pedometerBaseSteps = 0
    @Volatile
    private var gpsDistanceAtLost = 0.0

    /**
     * Initialize the engine. Must be called before start().
     * Sets up sensor managers and FusedLocationProviderClient.
     */
    fun initialize() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as android.hardware.SensorManager
        val statDetector = StationaryDetector(sensorManager)
        stationaryDetector = statDetector
        sensorFusionManager = SensorFusionManager(sensorManager, kalmanFilter, statDetector)

        // Listen for stationary/moving state changes
        statDetector.addListener { newState, duration ->
            val stateStr = when (newState) {
                StationaryDetector.MovementState.MOVING -> "moving"
                StationaryDetector.MovementState.STATIONARY -> "stationary"
            }
            session.isMoving = (newState == StationaryDetector.MovementState.MOVING)
            listener?.onRunningStateChange(stateStr, duration)
        }
    }

    /**
     * Start receiving GPS updates and processing them through the filter pipeline.
     * Requires location permissions to be granted.
     */
    fun start() {
        if (!hasLocationPermission()) {
            listener?.onError("PERMISSION_DENIED", "Location permission not granted")
            return
        }

        if (!isGPSEnabled()) {
            listener?.onError("GPS_DISABLED", "GPS is not enabled in device settings")
            return
        }

        session.start()
        coldStartComplete = false
        coldStartBeginTime = System.currentTimeMillis()
        currentGpsStatus = "searching"
        listener?.onGPSStatusChange("searching", null, usedSatelliteCount)

        // Reset all filter state
        kalmanFilter.reset()
        coordinateConverter.reset()
        outlierDetector.reset()
        batteryOptimizer.reset()
        sensorFusionManager?.reset()
        previousFilteredLat = 0.0
        previousFilteredLng = 0.0
        previousMilestoneDistance = 0.0
        previousMilestoneTime = 0L
        lastGPSAccuracy = 0f
        lastCadenceSPM = 0

        // Start sensors
        sensorFusionManager?.start()

        // Start satellite tracking
        registerGnssStatusCallback()

        // Start 1-second summary timer for JS metrics
        startSummaryTimer()

        // Start GPS
        requestLocationUpdates()
    }

    /**
     * Stop all GPS updates and sensor listeners.
     */
    fun stop() {
        stopSummaryTimer()
        stopPedometerFallback()
        // Quit the pedometer thread only on full tracking stop
        pedometerHandlerThread?.quitSafely()
        pedometerHandlerThread = null
        pedometerHandler = null
        removeLocationUpdates()
        unregisterGnssStatusCallback()
        sensorFusionManager?.stop()
        session.stop()
        clearPersistedState()

        if (currentGpsStatus != "disabled") {
            currentGpsStatus = "disabled"
            listener?.onGPSStatusChange("disabled", null, usedSatelliteCount)
        }
    }

    /**
     * Pause tracking: GPS keeps running (for resume accuracy) but points are not recorded.
     */
    fun pause() {
        session.pause()
    }

    /**
     * Resume tracking after pause.
     */
    fun resume() {
        session.resume()
    }

    /**
     * Restart GPS listeners without resetting cumulative distance or filters.
     * Used by the JS heartbeat when no GPS updates are received for an extended period.
     */
    fun restart() {
        Log.i(TAG, "restart — restarting GPS listeners (preserving state)")
        removeLocationUpdates()
        batteryOptimizer.reset()
        currentGpsStatus = "searching"
        listener?.onGPSStatusChange("searching", null, usedSatelliteCount)
        requestLocationUpdates()
    }

    /**
     * Update the GPS polling interval based on current battery optimization state.
     */
    fun updateLocationInterval() {
        if (fusedLocationClient == null || locationCallback == null) return

        val interval = batteryOptimizer.getCurrentInterval()
        val fastest = batteryOptimizer.getCurrentFastestInterval()

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, interval)
            .setMinUpdateIntervalMillis(fastest)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .build()

        try {
            val cb = locationCallback ?: return
            if (hasLocationPermission()) {
                fusedLocationClient?.requestLocationUpdates(request, cb, Looper.getMainLooper())
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException updating location interval", e)
        }
    }

    // --- Private: Location request management ---

    @Synchronized
    private fun requestLocationUpdates() {
        // Clean up any existing callback before creating a new one
        removeLocationUpdates()

        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            BatteryOptimizer.INTERVAL_MOVING_MS
        )
            .setMinUpdateIntervalMillis(BatteryOptimizer.FASTEST_INTERVAL_MOVING_MS)
            .setMinUpdateDistanceMeters(0f)
            .setWaitForAccurateLocation(false)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                for (location in result.locations) {
                    processRawLocation(location)
                }
            }

            override fun onLocationAvailability(availability: LocationAvailability) {
                if (!availability.isLocationAvailable) {
                    val now = System.currentTimeMillis()
                    if (now - lastGpsUpdateTime > GPS_LOST_TIMEOUT_MS && currentGpsStatus != "lost") {
                        currentGpsStatus = "lost"
                        listener?.onGPSStatusChange("lost", null, usedSatelliteCount)
                        startPedometerFallback()
                    }
                }
            }
        }

        try {
            val cb = locationCallback ?: return
            if (hasLocationPermission()) {
                fusedLocationClient?.requestLocationUpdates(request, cb, Looper.getMainLooper())
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException requesting location updates", e)
            listener?.onError("PERMISSION_DENIED", "Location permission was revoked")
        }
    }

    @Synchronized
    private fun removeLocationUpdates() {
        locationCallback?.let { callback ->
            fusedLocationClient?.removeLocationUpdates(callback)
        }
        locationCallback = null
    }

    // --- Private: Filtering Pipeline ---

    /**
     * Main pipeline entry point. Called on the main thread for each raw GPS fix.
     */
    private fun processRawLocation(location: android.location.Location) {
        lastGpsUpdateTime = System.currentTimeMillis()
        lastGPSAccuracy = location.accuracy

        // Reject stale/cached locations from FusedLocationProvider.
        // Android can return a cached cell-tower position with decent accuracy (~15m)
        // but from a completely different location. Use elapsedRealtimeNanos to detect this.
        val locationAgeMs = (android.os.SystemClock.elapsedRealtimeNanos() - location.elapsedRealtimeNanos) / 1_000_000L
        if (locationAgeMs > 10_000L) {
            Log.d(TAG, "Rejected stale cached location: ${locationAgeMs}ms old")
            return
        }

        val point = GPSPoint.fromLocation(location)

        // Always store raw point (for server upload)
        session.addRawPoint(point)

        // --- Cold start gate ---
        if (!coldStartComplete) {
            if (point.horizontalAccuracy <= COLD_START_ACCURACY_THRESHOLD) {
                coldStartComplete = true
                currentGpsStatus = "locked"
                listener?.onGPSStatusChange("locked", point.horizontalAccuracy, usedSatelliteCount)
            } else {
                // Check timeout
                if (System.currentTimeMillis() - coldStartBeginTime > COLD_START_TIMEOUT_MS) {
                    // Accept what we have and proceed
                    coldStartComplete = true
                    currentGpsStatus = "locked"
                    listener?.onGPSStatusChange("locked", point.horizontalAccuracy, usedSatelliteCount)
                    Log.w(TAG, "Cold start timeout. Proceeding with accuracy: ${point.horizontalAccuracy}m")
                } else {
                    // Still waiting for accurate fix
                    listener?.onGPSStatusChange("searching", point.horizontalAccuracy, usedSatelliteCount)
                    return
                }
            }
        }

        // Update GPS status if accuracy degrades
        if (point.horizontalAccuracy > OutlierDetector.MAX_ACCURACY_METERS) {
            if (currentGpsStatus != "lost") {
                currentGpsStatus = "lost"
                listener?.onGPSStatusChange("lost", point.horizontalAccuracy, usedSatelliteCount)
                startPedometerFallback()
            }
        } else if (currentGpsStatus != "locked") {
            currentGpsStatus = "locked"
            listener?.onGPSStatusChange("locked", point.horizontalAccuracy, usedSatelliteCount)
            stopPedometerFallback()
        }

        // If session is paused, don't process further
        if (!session.isActive()) return

        // --- Layer 1+2: Outlier detection (includes validity check) ---
        val outlierResult = outlierDetector.evaluate(point)
        if (outlierResult is OutlierDetector.OutlierResult.Rejected) {
            Log.d(TAG, "Point rejected: ${outlierResult.reason}")
            return
        }

        // --- Spike detection: reject physically impossible jumps BEFORE kalman update ---
        // Compare raw GPS against the last *filtered* position (matched with iOS).
        // The Kalman filter smooths position, so raw-vs-filtered distance can appear
        // larger than actual movement. Use generous limits to avoid rejecting valid points.
        if (previousFilteredLat != 0.0) {
            val rawDist = GeoMath.haversineDistance(
                previousFilteredLat, previousFilteredLng,
                point.latitude, point.longitude
            )
            val timeDelta = (point.timestamp - (session.filteredLocations.lastOrNull()?.timestamp ?: point.timestamp)) / 1000.0
            // 15 m/s limit — generous to account for Kalman filter lag
            val maxPlausibleDist = kotlin.math.max(15.0 * kotlin.math.max(timeDelta, 0.5), 10.0)
            if (rawDist > maxPlausibleDist) {
                Log.d(TAG, "Spike rejected: raw-vs-filtered ${rawDist}m > ${maxPlausibleDist}m")
                return
            }
            // Background gap: accept and let Kalman filter smooth the transition.
            if (timeDelta > 5.0 && rawDist > 50.0) {
                Log.d(TAG, "Background gap: ${rawDist}m in ${timeDelta}s — accepting (Kalman will smooth)")
            }
        }

        // --- Layer 3: Kalman Filter ---
        // Update process noise from accelerometer BEFORE Kalman update (matched with iOS)
        stationaryDetector?.let { detector ->
            val accelVarianceG2 = (detector.currentAccelVariance / (9.81 * 9.81)).coerceAtLeast(0.001)
            kalmanFilter.updateProcessNoise(accelVarianceG2)
        }
        kalmanFilter.updateSpeedAdaptiveQ()

        val filterResult = kalmanFilter.process(point) ?: return

        // --- Layer 4: Sensor Fusion ---
        val fusion = sensorFusionManager
        fusion?.onFilteredLocationReady(
            point, filterResult.latitude, filterResult.longitude,
            filterResult.speed, filterResult.bearing
        )

        // Best altitude: barometer if available, else Kalman-filtered GPS alt
        val bestAltitude = fusion?.getBestAltitude(filterResult.altitude) ?: filterResult.altitude

        // --- Stationary suppression: clamp position + don't accumulate distance ---
        // Android FusedLocationProvider has significantly more GPS drift than iOS
        // Core Location, especially indoors. When stationary, lock the emitted position
        // to the last known good location to prevent the map marker from wandering.
        val isStationary = fusion?.isStationary() ?: false
        val rawDist = if (previousFilteredLat == 0.0) {
            0.0
        } else {
            GeoMath.haversineDistance(
                previousFilteredLat, previousFilteredLng,
                filterResult.latitude, filterResult.longitude
            )
        }

        val emitLat: Double
        val emitLng: Double
        val distFromPrev: Double

        if (isStationary) {
            // Safety net: if detector says stationary but movement is clearly
            // significant (> 3m), the detector is wrong — still count distance and update position
            // Raised from 2m to 3m to better suppress Android indoor GPS drift
            if (rawDist > 3.0) {
                emitLat = filterResult.latitude
                emitLng = filterResult.longitude
                distFromPrev = rawDist
            } else {
                // Clamp position to last known location — prevents GPS drift on map
                emitLat = if (previousFilteredLat != 0.0) previousFilteredLat else filterResult.latitude
                emitLng = if (previousFilteredLng != 0.0) previousFilteredLng else filterResult.longitude
                distFromPrev = 0.0
            }
        } else {
            emitLat = filterResult.latitude
            emitLng = filterResult.longitude
            // Normal case: ignore tiny movements (< 0.5m) as noise
            // Android FusedLocationProvider has more drift than iOS — use higher threshold
            distFromPrev = if (rawDist >= 0.5) rawDist else 0.0
        }

        val cumulativeDistance = session.totalDistance + distFromPrev

        val filteredLocation = FilteredLocation(
            latitude = emitLat,
            longitude = emitLng,
            altitude = bestAltitude,
            speed = if (isStationary) 0.0 else filterResult.speed,
            bearing = filterResult.bearing,
            timestamp = point.timestamp,
            distanceFromPrevious = distFromPrev,
            cumulativeDistance = cumulativeDistance,
            isInterpolated = false
        )

        session.addFilteredLocation(filteredLocation)
        // Only update previous position when actually moving — keeps the anchor stable during stationary
        if (!isStationary || previousFilteredLat == 0.0) {
            previousFilteredLat = filterResult.latitude
            previousFilteredLng = filterResult.longitude
        }

        // Adaptive GPS interval based on movement and battery state
        val isMoving = !isStationary
        val movementChanged = batteryOptimizer.updateMovementState(isMoving)
        val batteryChanged = batteryOptimizer.updateBatteryState(context)
        if (movementChanged || batteryChanged) {
            updateLocationInterval()
        }

        // Emit to listener
        listener?.onFilteredLocationUpdate(filteredLocation, session)

        // Milestone detection: emit split event at every km boundary.
        // Loop to emit ALL missed km boundaries when a GPS jump >1km occurs
        // (e.g. tunnel exit, background resume) so the split array stays complete.
        val prevKm = (previousMilestoneDistance / 1000).toInt()
        val currentKm = (cumulativeDistance / 1000).toInt()
        if (currentKm > prevKm && currentKm > 0) {
            for (km in (prevKm + 1)..currentKm) {
                val elapsedMs = session.getElapsedTime()
                val elapsedSec = (elapsedMs / 1000).toInt()
                val splitSeconds = ((elapsedMs - previousMilestoneTime) / 1000).toInt()
                val splitPace = if (splitSeconds > 0) splitSeconds else 0
                previousMilestoneTime = elapsedMs
                listener?.onMilestoneReached(km, splitPace, elapsedSec)
            }
        }
        previousMilestoneDistance = cumulativeDistance
    }

    // --- Summary timer (1-second cadence) ---

    private fun startSummaryTimer() {
        summaryHandler = Handler(Looper.getMainLooper())
        summaryRunnable = object : Runnable {
            override fun run() {
                emitSummary()
                summaryHandler?.postDelayed(this, 1000)
            }
        }
        summaryHandler?.postDelayed(summaryRunnable!!, 1000)
    }

    private fun stopSummaryTimer() {
        summaryRunnable?.let { summaryHandler?.removeCallbacks(it) }
        summaryHandler = null
        summaryRunnable = null
    }

    /**
     * Emit a 1-second summary of running metrics to JS.
     * Matches the iOS summary format exactly.
     */
    private fun emitSummary() {
        val s = session
        if (s.state != RunSession.State.TRACKING && s.state != RunSession.State.PAUSED) return

        val elapsed = s.getElapsedTime() / 1000.0 // seconds
        val distance = s.totalDistance
        val avgPace = if (distance > 0) elapsed / (distance / 1000.0) else 0.0
        val lastLoc = s.filteredLocations.lastOrNull()
        val speed = lastLoc?.speed ?: 0.0
        val currentPace = if (speed > 0.3) 1000.0 / speed else avgPace
        val calories = (distance / 1000.0 * 60).toInt()
        val isStationary = sensorFusionManager?.isStationary() ?: false

        listener?.onSummaryUpdate(mapOf(
            "distanceMeters" to distance,
            "durationSeconds" to elapsed.toInt(),
            "avgPaceSecondsPerKm" to avgPace.toInt(),
            "currentPaceSecondsPerKm" to currentPace.toInt(),
            "calories" to calories,
            "latitude" to (lastLoc?.latitude ?: 0.0),
            "longitude" to (lastLoc?.longitude ?: 0.0),
            "altitude" to (lastLoc?.altitude ?: 0.0),
            "speed" to speed,
            "bearing" to (lastLoc?.bearing ?: 0.0),
            "gpsAccuracy" to lastGPSAccuracy.toDouble(),
            "isMoving" to !isStationary,
            "isPaused" to (s.state == RunSession.State.PAUSED),
            "cadence" to lastCadenceSPM,
        ))

        // Persist run state every 10 seconds for crash recovery
        if (System.currentTimeMillis() - lastPersistTime > 10_000) {
            lastPersistTime = System.currentTimeMillis()
            persistRunState()
        }
    }

    // --- Crash Recovery Persistence ---

    /**
     * Persist critical run state to SharedPreferences for crash recovery.
     * Called every 10 seconds from emitSummary().
     */
    private fun persistRunState() {
        val s = session
        if (s.state != RunSession.State.TRACKING && s.state != RunSession.State.PAUSED) return
        val prefs = context.getSharedPreferences("runvs_run_state", Context.MODE_PRIVATE)
        prefs.edit()
            .putFloat("distance", s.totalDistance.toFloat())
            .putLong("duration", s.getElapsedTime())
            .putLong("startTime", s.startTime)
            .putString("phase", if (s.state == RunSession.State.TRACKING) "running" else "paused")
            .putLong("savedAt", System.currentTimeMillis())
            .apply()
    }

    /**
     * Clear persisted run state (called on normal stop).
     */
    fun clearPersistedState() {
        context.getSharedPreferences("runvs_run_state", Context.MODE_PRIVATE)
            .edit().clear().apply()
    }

    // --- Indoor / Pedometer Fallback ---

    /**
     * Start emitting pedometer-based distance events when GPS is lost.
     * Fires every 2 seconds, using step count * stride for distance.
     */
    private fun startPedometerFallback() {
        if (pedometerFallbackRunnable != null) return
        val fusion = sensorFusionManager ?: return

        pedometerBaseSteps = fusion.stepDetector.totalSteps
        gpsDistanceAtLost = session.totalDistance
        Log.i(TAG, "Starting pedometer fallback (baseSteps=$pedometerBaseSteps, gpsDistAtLost=$gpsDistanceAtLost)")

        // Initialize dedicated HandlerThread if not already running
        if (pedometerHandlerThread == null) {
            val thread = HandlerThread("PedometerFallback").apply { start() }
            pedometerHandlerThread = thread
            pedometerHandler = android.os.Handler(thread.looper)
        }

        val handler = pedometerHandler ?: return
        val runnable = object : Runnable {
            override fun run() {
                emitPedometerUpdate()
                handler.postDelayed(this, 2000)
            }
        }
        pedometerFallbackRunnable = runnable
        handler.postDelayed(runnable, 2000)
    }

    private fun stopPedometerFallback() {
        pedometerFallbackRunnable?.let { runnable ->
            pedometerHandler?.removeCallbacks(runnable)
        }
        pedometerFallbackRunnable = null
        // Don't quit the thread here — reuse it for the next fallback cycle.
        // The thread is cleaned up in stop() when tracking fully stops.
    }

    /**
     * Emit a synthetic location event using step-based distance.
     */
    private fun emitPedometerUpdate() {
        if (session.state != RunSession.State.TRACKING) {
            stopPedometerFallback()
            return
        }

        val fusion = sensorFusionManager ?: return
        val stepDelta = fusion.stepDetector.totalSteps - pedometerBaseSteps
        if (stepDelta <= 0) return

        val distance = stepDelta * fusion.stepDetector.currentStrideEstimate
        val newCumulativeDistance = gpsDistanceAtLost + distance

        // Only move forward
        if (newCumulativeDistance <= session.totalDistance) return

        // Dead reckoning for position
        val dr = fusion.attemptDeadReckoning()
        val lat = dr?.latitude ?: previousFilteredLat
        val lon = dr?.longitude ?: previousFilteredLng

        val distFromPrev = newCumulativeDistance - session.totalDistance

        val filteredLocation = FilteredLocation(
            latitude = lat,
            longitude = lon,
            altitude = fusion.getBestAltitude(0.0),
            speed = if (fusion.isStationary()) 0.0 else fusion.stepDetector.currentStrideEstimate * 2.0,
            bearing = 0.0,
            timestamp = System.currentTimeMillis(),
            distanceFromPrevious = distFromPrev,
            cumulativeDistance = newCumulativeDistance,
            isInterpolated = true
        )

        session.addFilteredLocation(filteredLocation)

        // Emit to listener on main thread. emitPedometerUpdate() runs on the
        // PedometerFallback HandlerThread, but sendEvent (called by the listener)
        // must be invoked on the main thread for the RN bridge.
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            listener?.onFilteredLocationUpdate(filteredLocation, session)
        }

        // Milestone detection — loop for GPS jump safety
        // Also posted to main thread (same reason as location update above).
        val prevKm = (previousMilestoneDistance / 1000).toInt()
        val currentKm = (newCumulativeDistance / 1000).toInt()
        if (currentKm > prevKm && currentKm > 0) {
            val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())
            for (km in (prevKm + 1)..currentKm) {
                val elapsedMs = session.getElapsedTime()
                val elapsedSec = (elapsedMs / 1000).toInt()
                val splitSeconds = ((elapsedMs - previousMilestoneTime) / 1000).toInt()
                val splitPace = if (splitSeconds > 0) splitSeconds else 0
                previousMilestoneTime = elapsedMs
                mainHandler.post {
                    listener?.onMilestoneReached(km, splitPace, elapsedSec)
                }
            }
        }
        previousMilestoneDistance = newCumulativeDistance
    }

    // --- Permission & GPS availability checks ---

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun isGPSEnabled(): Boolean {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
        return locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) ?: false
    }

    // --- GNSS satellite tracking ---

    private fun registerGnssStatusCallback() {
        if (!hasLocationPermission()) return
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return

        val callback = object : GnssStatus.Callback() {
            override fun onSatelliteStatusChanged(status: GnssStatus) {
                satelliteCount = status.satelliteCount
                var used = 0
                for (i in 0 until status.satelliteCount) {
                    if (status.usedInFix(i)) used++
                }
                usedSatelliteCount = used
            }
        }
        gnssStatusCallback = callback

        try {
            locationManager.registerGnssStatusCallback(callback, android.os.Handler(Looper.getMainLooper()))
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException registering GNSS status callback", e)
        }
    }

    private fun unregisterGnssStatusCallback() {
        val locationManager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return
        gnssStatusCallback?.let { callback ->
            locationManager.unregisterGnssStatusCallback(callback)
        }
        gnssStatusCallback = null
        satelliteCount = 0
        usedSatelliteCount = 0
    }
}
