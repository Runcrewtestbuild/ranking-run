package com.runcrew.gps

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.runcrew.gps.model.FilteredLocation
import com.runcrew.gps.model.RunSession
import com.runcrew.gps.sensor.HeadingTracker

/**
 * React Native native module exposing GPS tracking functionality to JavaScript.
 *
 * Module name: "GPSTrackerModule" (must match on both Android and iOS per shared-interfaces.md)
 *
 * Events emitted (via RCTDeviceEventEmitter):
 *   - GPSTracker_onLocationUpdate:      FilteredLocation at 1Hz during active tracking
 *   - GPSTracker_onGPSStatusChange:     GPS status transitions (searching/locked/lost/disabled)
 *   - GPSTracker_onRunningStateChange:  moving <-> stationary transitions
 *
 * Methods exposed to JS:
 *   - startTracking()       -> Promise<void>
 *   - stopTracking()        -> Promise<void>
 *   - pauseTracking()       -> Promise<void>
 *   - resumeTracking()      -> Promise<void>
 *   - getRawGPSPoints()     -> Promise<RawGPSPoint[]>
 *   - getFilteredRoute()    -> Promise<FilteredLocation[]>
 *   - getCurrentStatus()    -> Promise<GPSStatus>
 */
@ReactModule(name = GPSTrackerModule.NAME)
class GPSTrackerModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext), LocationEngine.Listener {

    companion object {
        const val NAME = "GPSTrackerModule"
        private const val TAG = "GPSTrackerModule"

        // Event names matching shared-interfaces.md
        private const val EVENT_LOCATION_UPDATE = "GPSTracker_onLocationUpdate"
        private const val EVENT_GPS_STATUS_CHANGE = "GPSTracker_onGPSStatusChange"
        private const val EVENT_RUNNING_STATE_CHANGE = "GPSTracker_onRunningStateChange"

        private const val EVENT_MILESTONE_REACHED = "GPSTracker_onMilestoneReached"
        private const val EVENT_HEADING_UPDATE = "GPSTracker_onHeadingUpdate"
        private const val EVENT_SUMMARY = "GPSTracker_onSummary"
        private const val EVENT_COURSE_DEVIATION = "GPSTracker_onCourseDeviation"
        private const val EVENT_CHECKPOINT_PASSED = "GPSTracker_onCheckpointPassed"
        private const val EVENT_COURSE_FINISHED = "GPSTracker_onCourseFinished"

        // Error codes matching shared-interfaces.md
        private const val ERROR_PERMISSION_DENIED = "PERMISSION_DENIED"
        private const val ERROR_GPS_DISABLED = "GPS_DISABLED"
        private const val ERROR_SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
        private const val ERROR_COLD_START_TIMEOUT = "COLD_START_TIMEOUT"
        private const val ERROR_BACKGROUND_RESTRICTED = "BACKGROUND_RESTRICTED"
    }

    private var locationEngine: LocationEngine? = null
    private var headingTracker: HeadingTracker? = null
    private var listenerCount = 0
    private var notificationUpdateCounter = 0
    private val trackingLock = Any()

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        val engine = LocationEngine(reactApplicationContext)
        engine.listener = this
        engine.initialize()
        // Register step listener to populate rolling cadence window
        engine.sensorFusionManager?.stepDetector?.addListener { _ ->
            val now = System.currentTimeMillis()
            recentStepTimestamps.addLast(now)
            // Cap buffer to prevent unbounded growth
            if (recentStepTimestamps.size > 300) {
                recentStepTimestamps.removeFirst()
            }
        }
        locationEngine = engine
    }

    override fun canOverrideExistingModule(): Boolean = false

    override fun onCatalystInstanceDestroy() {
        headingTracker?.stop()
        headingTracker = null
        locationEngine?.stop()
        locationEngine = null
        super.onCatalystInstanceDestroy()
    }

    // --- Event buffering for when JS listener is not yet registered ---
    // Matches iOS pattern: keep only the latest location event, preserve all milestone events.
    private data class BufferedEvent(val eventName: String, val params: WritableMap)
    private val eventBuffer = mutableListOf<BufferedEvent>()
    private val EVENT_BUFFER_MAX = 50

    // --- Event listener management for RN EventEmitter ---

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
        // Flush buffered events when JS listener is (re-)attached
        if (listenerCount == 1 && eventBuffer.isNotEmpty()) {
            flushEventBuffer()
        }
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
        if (listenerCount < 0) listenerCount = 0
    }

    /**
     * Flush buffered events: send only the latest summary event + all milestone events.
     * This avoids flooding JS with stale data while preserving critical milestones.
     */
    private fun flushEventBuffer() {
        val milestones = eventBuffer.filter { it.eventName == EVENT_MILESTONE_REACHED }
        val latestSummary = eventBuffer.lastOrNull { it.eventName == EVENT_SUMMARY }

        eventBuffer.clear()

        // Send milestones first (in order), then latest summary
        for (milestone in milestones) {
            emitToJS(milestone.eventName, milestone.params)
        }
        if (latestSummary != null) {
            emitToJS(latestSummary.eventName, latestSummary.params)
        }
    }

    // --- Tracking control methods ---

    @ReactMethod
    fun startTracking(promise: Promise) {
        synchronized(trackingLock) {
            try {
                // Check fine location permission
                if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    promise.reject(ERROR_PERMISSION_DENIED, "Fine location permission not granted")
                    return
                }

                // Check background location permission (Android 10+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    if (!hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)) {
                        Log.w(TAG, "Background location permission not granted. Tracking may stop in background.")
                        // Don't reject -- allow foreground-only tracking, but warn
                    }
                }

                // Check POST_NOTIFICATIONS permission (Android 13+)
                // Required for foreground service notification
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (!hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
                        if (Build.VERSION.SDK_INT >= 34) {
                            // Android 14+: foreground service REQUIRES notification permission.
                            // Without it the OS kills the service after 5-30 seconds.
                            promise.reject("NOTIFICATION_PERMISSION_REQUIRED",
                                "Notification permission required for GPS tracking on Android 14+")
                            return
                        }
                        // Android 13: service still runs, but notification won't show
                        Log.w(TAG, "POST_NOTIFICATIONS not granted. Notification may not appear.")
                    }
                }

                val engine = locationEngine
                if (engine == null) {
                    promise.reject(ERROR_SERVICE_UNAVAILABLE, "LocationEngine not initialized")
                    return
                }

                // Start foreground service for background tracking
                GPSForegroundService.startService(reactApplicationContext)

                // Reset cadence tracking for new session
                recentStepTimestamps.clear()

                // Start the engine (GPS + sensors)
                engine.start()

                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error starting tracking", e)
                promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to start tracking: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun stopTracking(promise: Promise) {
        synchronized(trackingLock) {
            try {
                locationEngine?.stop()
                GPSForegroundService.stopService(reactApplicationContext)
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping tracking", e)
                promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to stop tracking: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun pauseTracking(promise: Promise) {
        synchronized(trackingLock) {
            try {
                locationEngine?.pause()
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error pausing tracking", e)
                promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to pause tracking: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun resumeTracking(promise: Promise) {
        synchronized(trackingLock) {
            try {
                // Re-check permission — user could revoke between pause/resume
                if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
                    promise.reject(ERROR_PERMISSION_DENIED, "Fine location permission was revoked")
                    return
                }

                locationEngine?.resume()
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error resuming tracking", e)
                promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to resume tracking: ${e.message}", e)
            }
        }
    }

    @ReactMethod
    fun restartTracking(promise: Promise) {
        synchronized(trackingLock) {
            try {
                locationEngine?.restart()
                promise.resolve(null)
            } catch (e: Exception) {
                Log.e(TAG, "Error restarting tracking", e)
                promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to restart tracking: ${e.message}", e)
            }
        }
    }

    // --- Course navigation ---

    @ReactMethod
    fun setCourseRoute(data: ReadableMap, promise: Promise) {
        try {
            val routeArray = data.getArray("route")
            val checkpointsArray = data.getArray("checkpoints")

            val route = mutableListOf<Pair<Double, Double>>()
            if (routeArray != null) {
                for (i in 0 until routeArray.size()) {
                    val point = routeArray.getMap(i)
                    if (point != null) {
                        route.add(Pair(point.getDouble("latitude"), point.getDouble("longitude")))
                    }
                }
            }

            val checkpoints = mutableListOf<Triple<Double, Double, Int>>()
            if (checkpointsArray != null) {
                for (i in 0 until checkpointsArray.size()) {
                    val cp = checkpointsArray.getMap(i)
                    if (cp != null) {
                        checkpoints.add(Triple(
                            cp.getDouble("latitude"),
                            cp.getDouble("longitude"),
                            cp.getInt("order")
                        ))
                    }
                }
            }

            locationEngine?.setCourseRoute(route, checkpoints)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error setting course route", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to set course route: ${e.message}", e)
        }
    }

    // --- Data retrieval methods ---

    @ReactMethod
    fun getRawGPSPoints(promise: Promise) {
        try {
            val session = locationEngine?.session
            if (session == null) {
                promise.resolve(Arguments.createArray())
                return
            }

            val array = Arguments.createArray()
            for (point in session.rawPoints) {
                array.pushMap(point.toWritableMap())
            }
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting raw GPS points", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to get raw GPS points: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getFilteredRoute(promise: Promise) {
        try {
            val session = locationEngine?.session
            if (session == null) {
                promise.resolve(Arguments.createArray())
                return
            }

            val array = Arguments.createArray()
            for (location in session.filteredLocations) {
                array.pushMap(location.toWritableMap())
            }
            promise.resolve(array)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting filtered route", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to get filtered route: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getSmoothedRoute(promise: Promise) {
        try {
            val engine = locationEngine
            if (engine == null) {
                val emptyResult = Arguments.createMap()
                emptyResult.putArray("route", Arguments.createArray())
                emptyResult.putDouble("distance", 0.0)
                promise.resolve(emptyResult)
                return
            }

            val smoothed = engine.kalmanFilter.smoothRoute()
            if (smoothed.size < 2) {
                // Not enough data — fall back to original filtered route
                val session = engine.session
                val array = Arguments.createArray()
                if (session != null) {
                    for (location in session.filteredLocations) {
                        array.pushMap(location.toWritableMap())
                    }
                }
                val result = Arguments.createMap()
                result.putArray("route", array)
                result.putDouble("distance", session?.totalDistance ?: 0.0)
                promise.resolve(result)
                return
            }

            // Sanity check: if smoothed covers < half original, fall back
            val sessionRef = engine.session ?: run {
                promise.resolve(null)
                return
            }
            val origCount = sessionRef.filteredLocations.size
            if (origCount > 10 && smoothed.size < origCount / 2) {
                engine.kalmanFilter.clearHistory()
                val array = Arguments.createArray()
                for (location in sessionRef.filteredLocations) {
                    array.pushMap(location.toWritableMap())
                }
                val result = Arguments.createMap()
                result.putArray("route", array)
                result.putDouble("distance", sessionRef.totalDistance)
                promise.resolve(result)
                return
            }

            val array = Arguments.createArray()
            var totalDist = 0.0
            for (i in smoothed.indices) {
                val s = smoothed[i]
                var distFromPrev = 0.0
                if (i > 0) {
                    val prev = smoothed[i - 1]
                    distFromPrev = com.runcrew.gps.util.GeoMath.haversineDistance(
                        prev.latitude, prev.longitude, s.latitude, s.longitude
                    )
                    if (distFromPrev < 0.3) distFromPrev = 0.0
                    totalDist += distFromPrev
                }
                val point = Arguments.createMap()
                point.putDouble("latitude", s.latitude)
                point.putDouble("longitude", s.longitude)
                point.putDouble("altitude", s.altitude)
                point.putDouble("speed", s.speed.toDouble())
                point.putDouble("bearing", s.bearing.toDouble())
                point.putDouble("timestamp", s.timestamp.toDouble())
                point.putDouble("distanceFromPrevious", distFromPrev)
                point.putDouble("cumulativeDistance", totalDist)
                point.putBoolean("isInterpolated", false)
                array.pushMap(point)
            }

            val result = Arguments.createMap()
            result.putArray("route", array)
            result.putDouble("distance", totalDist)
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting smoothed route", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to get smoothed route: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getCurrentStatus(promise: Promise) {
        try {
            val session = locationEngine?.session
            val status = session?.gpsStatus ?: "disabled"
            promise.resolve(status)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting current status", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to get status: ${e.message}", e)
        }
    }

    // --- Heading tracking (magnetometer/rotation vector) ---

    @ReactMethod
    fun startHeadingUpdates(promise: Promise) {
        try {
            if (headingTracker != null) {
                promise.resolve(null)
                return
            }

            val sensorManager = reactApplicationContext.getSystemService(
                android.content.Context.SENSOR_SERVICE
            ) as android.hardware.SensorManager

            val tracker = HeadingTracker(sensorManager)
            tracker.setListener(object : HeadingTracker.Listener {
                override fun onHeadingUpdate(heading: Double) {
                    val params = Arguments.createMap().apply {
                        putDouble("heading", heading)
                    }
                    sendEvent(EVENT_HEADING_UPDATE, params)
                }
            })
            tracker.start()
            headingTracker = tracker
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error starting heading updates", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to start heading: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopHeadingUpdates(promise: Promise) {
        try {
            headingTracker?.stop()
            headingTracker = null
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping heading updates", e)
            promise.reject(ERROR_SERVICE_UNAVAILABLE, "Failed to stop heading: ${e.message}", e)
        }
    }

    // --- LocationEngine.Listener implementation ---

    // Rolling cadence window: track recent step timestamps for real-time SPM
    // ConcurrentLinkedDeque: accessed from sensor callback thread (step listener)
    // and main thread (onFilteredLocationUpdate) — must be thread-safe.
    private val recentStepTimestamps = java.util.concurrent.ConcurrentLinkedDeque<Long>()
    private val CADENCE_WINDOW_MS = 15_000L  // 15-second rolling window

    override fun onFilteredLocationUpdate(location: FilteredLocation, session: RunSession) {
        // Native-only: update cadence for summary timer, update notification.
        // Location data is no longer sent to JS per-tick; the 1-second summary replaces it.
        val sensorFusion = locationEngine?.sensorFusionManager
        val isCurrentlyMoving = sensorFusion?.let { !it.isStationary() } ?: session?.isMoving ?: true
        val cadenceSPM = if (isCurrentlyMoving && sensorFusion != null) {
            val now = System.currentTimeMillis()
            val windowCutoff = now - CADENCE_WINDOW_MS
            // Prune old entries (thread-safe: peekFirst/pollFirst won't throw on concurrent modification)
            while (true) {
                val oldest = recentStepTimestamps.peekFirst() ?: break
                if (oldest < windowCutoff) {
                    recentStepTimestamps.pollFirst()
                } else {
                    break
                }
            }
            // Calculate cadence from steps in the rolling window
            val stepsInWindow = recentStepTimestamps.size
            if (stepsInWindow > 0) {
                (stepsInWindow.toDouble() / (CADENCE_WINDOW_MS / 1000.0) * 60).toInt()
            } else 0
        } else 0

        // Store cadence for the summary timer to read
        locationEngine?.lastCadenceSPM = cadenceSPM

        // Update notification periodically (every 5th update to avoid excessive overhead)
        notificationUpdateCounter++
        if (notificationUpdateCounter % 5 == 0) {
            GPSForegroundService.updateNotification(
                reactApplicationContext,
                session.totalDistance,
                session.getElapsedTime()
            )
        }
    }

    override fun onSummaryUpdate(summary: Map<String, Any>) {
        val params = Arguments.createMap().apply {
            for ((key, value) in summary) {
                when (value) {
                    is Double -> putDouble(key, value)
                    is Int -> putInt(key, value)
                    is Boolean -> putBoolean(key, value)
                    is Float -> putDouble(key, value.toDouble())
                    is String -> putString(key, value)
                }
            }
        }
        sendEvent(EVENT_SUMMARY, params)
    }

    override fun onGPSStatusChange(status: String, accuracy: Float?, satelliteCount: Int) {
        locationEngine?.session?.gpsStatus = status

        val params = Arguments.createMap().apply {
            putString("status", status)
            if (accuracy != null) {
                putDouble("accuracy", accuracy.toDouble())
            } else {
                putNull("accuracy")
            }
            putInt("satelliteCount", satelliteCount)
        }
        sendEvent(EVENT_GPS_STATUS_CHANGE, params)
    }

    override fun onRunningStateChange(state: String, durationMs: Long) {
        val params = Arguments.createMap().apply {
            putString("state", state)
            putDouble("duration", durationMs.toDouble())
        }
        sendEvent(EVENT_RUNNING_STATE_CHANGE, params)
    }

    override fun onMilestoneReached(km: Int, splitPaceSecondsPerKm: Int, totalTimeSeconds: Int) {
        val params = Arguments.createMap().apply {
            putInt("km", km)
            putInt("splitPaceSecondsPerKm", splitPaceSecondsPerKm)
            putInt("totalTimeSeconds", totalTimeSeconds)
        }
        sendEvent(EVENT_MILESTONE_REACHED, params)
    }

    override fun onCourseDeviation(deviationMeters: Double, isOffCourse: Boolean, progressPercent: Double, remainingMeters: Double) {
        val params = Arguments.createMap().apply {
            putDouble("deviationMeters", deviationMeters)
            putBoolean("isOffCourse", isOffCourse)
            putDouble("progressPercent", progressPercent)
            putDouble("remainingMeters", remainingMeters)
        }
        sendEvent(EVENT_COURSE_DEVIATION, params)
    }

    override fun onCheckpointPassed(order: Int, elapsedSeconds: Int) {
        val params = Arguments.createMap().apply {
            putInt("order", order)
            putInt("elapsedSeconds", elapsedSeconds)
        }
        sendEvent(EVENT_CHECKPOINT_PASSED, params)
    }

    override fun onCourseFinished() {
        val params = Arguments.createMap()
        sendEvent(EVENT_COURSE_FINISHED, params)
    }

    override fun onError(code: String, message: String) {
        Log.e(TAG, "GPS Error [$code]: $message")
        // Errors are surfaced via Promise rejections on the calling methods.
        // Critical errors that occur asynchronously can be sent as GPS status changes.
        if (code == ERROR_PERMISSION_DENIED || code == ERROR_GPS_DISABLED) {
            onGPSStatusChange("disabled", null, 0)
        }
    }

    // --- Private helpers ---

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (listenerCount <= 0) {
            // Buffer critical events so they aren't lost during JS listener gaps.
            // Keep only latest summary + all milestones (matching iOS pattern).
            if (eventName == EVENT_SUMMARY) {
                // Replace any existing buffered summary with the latest one
                eventBuffer.removeAll { it.eventName == EVENT_SUMMARY }
                eventBuffer.add(BufferedEvent(eventName, params))
            } else if (eventName == EVENT_MILESTONE_REACHED) {
                eventBuffer.add(BufferedEvent(eventName, params))
            }
            // Cap total buffer size
            while (eventBuffer.size > EVENT_BUFFER_MAX) {
                // Remove oldest non-milestone events first, then oldest milestones
                val nonMilestoneIdx = eventBuffer.indexOfFirst { it.eventName != EVENT_MILESTONE_REACHED }
                if (nonMilestoneIdx >= 0) {
                    eventBuffer.removeAt(nonMilestoneIdx)
                } else {
                    eventBuffer.removeAt(0)
                }
            }
            return
        }
        emitToJS(eventName, params)
    }

    private fun emitToJS(eventName: String, params: WritableMap) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName: ${e.message}")
        }
    }

    private fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            reactApplicationContext, permission
        ) == PackageManager.PERMISSION_GRANTED
    }
}
