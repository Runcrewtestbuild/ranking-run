import SwiftUI
import UIKit
import Combine

// MARK: - Running Phase

enum RunningPhase: String {
    case idle
    case countdown
    case running
    case paused
    case completed
}

// MARK: - GPS Status

enum GPSStatus: String {
    case acquiring
    case good
    case excellent
    case disabled

    var color: Color {
        switch self {
        case .excellent: RVColors.success
        case .good: RVColors.warning
        case .acquiring: RVColors.error
        case .disabled: RVColors.error
        }
    }

    var label: String {
        switch self {
        case .excellent: "GPS \u{00B1}5m"
        case .good: "GPS \u{00B1}15m"
        case .acquiring: "GPS..."
        case .disabled: "GPS Off"
        }
    }
}

// MARK: - Running ViewModel

@Observable
final class RunningViewModel: ChunkUploaderDataSource {
    var phase: RunningPhase = .idle
    var countdownValue: Int = 3
    var gpsStatus: GPSStatus = .excellent

    // Running metrics
    var distanceMeters: Double = 0
    var durationSeconds: Int = 0
    var avgPaceSecondsPerKm: Double = 0
    var currentPaceSecondsPerKm: Double = 0
    var calories: Int = 0
    var heartRate: Int = 0
    var cadence: Int = 0
    var elevationGainMeters: Double = 0

    var isPaused: Bool { phase == .paused }
    var isAutoPaused: Bool = false

    // Course running
    var courseId: String?
    var isCourseRunning: Bool { courseId != nil }

    // Goal-based running (metronome)
    var goalBPM: Int?

    // Public split accessors for RunningView
    var splitCount: Int { splits.count }
    var lastSplit: Split? { splits.last }
    var visibleSplits: [Split] { Array(splits.suffix(5)) }

    // Session ID for chunk uploads
    private(set) var sessionId: String = UUID().uuidString

    // MARK: - Dependencies

    private let gpsTracker = GPSTracker.shared
    private let liveActivity = LiveActivityManager.shared
    private let metronome = MetronomeEngine()
    private var chunkUploader: ChunkUploader?

    // Timer for duration tracking (Date-based, not simulation)
    private var timer: Timer?
    private var runStartDate: Date?
    private var pauseAccumulated: TimeInterval = 0
    private var lastPauseDate: Date?

    // Watch state update throttle
    private var lastWatchUpdateTime: TimeInterval = 0
    private let watchUpdateInterval: TimeInterval = 1.0

    // GPS observation (polling timer for @Observable engine properties)
    private var gpsObservationTimer: Timer?

    // Splits tracking
    private var splits: [Split] = []
    private var pauseIntervals: [(pausedAt: String, resumedAt: String?)] = []
    private var bestPace: Double = .infinity

    // MARK: - Actions

    func startCountdown() {
        phase = .countdown
        let seconds = RunSettings.shared.countdownSeconds
        countdownValue = seconds
        sessionId = UUID().uuidString

        // Notify Watch of countdown
        gpsTracker.sendCountdownToWatch(countdownSeconds: seconds)

        // Fire initial haptic for first countdown tick
        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()

        Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
            guard let self else { timer.invalidate(); return }
            self.countdownValue -= 1
            if self.countdownValue <= 0 {
                timer.invalidate()
                // "GO" haptic
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                self.startRunning()
            } else {
                // Each countdown tick haptic
                UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            }
        }
    }

    func startRunning() {
        phase = .running
        runStartDate = Date()
        pauseAccumulated = 0
        lastPauseDate = nil
        distanceMeters = 0
        durationSeconds = 0
        calories = 0
        elevationGainMeters = 0
        splits = []
        pauseIntervals = []
        bestPace = .infinity

        // Start real GPS tracking
        gpsTracker.startTracking()

        // Start GPS observation
        startGPSObservation()

        // Start duration timer (Date-based)
        startTimer()

        // Start Live Activity
        liveActivity.startActivity(
            courseName: courseId ?? "",
            isCourseRun: isCourseRunning,
            durationSeconds: 0
        )

        // Start chunk uploader
        chunkUploader = ChunkUploader(sessionId: sessionId, dataSource: self)

        // Start metronome if goal BPM is set
        if let bpm = goalBPM, bpm > 0 {
            metronome.start(bpm: bpm)
        }

        // Set up milestone callback
        gpsTracker.engine.onMilestoneReached = { [weak self] km, splitPace, totalTime in
            guard let self else { return }
            let split = Split(
                kilometerIndex: km,
                durationSeconds: splitPace,
                paceSecondsPerKm: Double(splitPace),
                distanceMeters: 1000,
                elevationGainMeters: 0
            )
            self.splits.append(split)
            if Double(splitPace) < self.bestPace {
                self.bestPace = Double(splitPace)
            }
        }

        // Start session persistence
        SessionPersistence.shared.clear()
    }

    func pause() {
        phase = .paused
        lastPauseDate = Date()
        gpsTracker.pauseTracking()
        stopTimer()

        // Record pause interval
        let pausedAt = ISO8601DateFormatter().string(from: Date())
        pauseIntervals.append((pausedAt: pausedAt, resumedAt: nil))

        // Update Live Activity
        updateLiveActivity(isPaused: true)

        // Persist session state
        persistSession()
    }

    func resume() {
        if let pauseStart = lastPauseDate {
            pauseAccumulated += Date().timeIntervalSince(pauseStart)
        }
        lastPauseDate = nil

        // Update last pause interval with resume time
        if var last = pauseIntervals.last, last.resumedAt == nil {
            pauseIntervals.removeLast()
            last.resumedAt = ISO8601DateFormatter().string(from: Date())
            pauseIntervals.append(last)
        }

        phase = .running
        gpsTracker.resumeTracking()
        startTimer()

        updateLiveActivity(isPaused: false)

        // Persist session state
        persistSession()
    }

    func stop() -> Run {
        phase = .completed
        stopTimer()
        stopGPSObservation()

        gpsTracker.stopTracking()
        metronome.stop()
        chunkUploader?.uploadFinalChunk()

        // End Live Activity
        liveActivity.endActivity(
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds,
            currentPace: Int(currentPaceSecondsPerKm),
            avgPace: Int(avgPaceSecondsPerKm),
            calories: calories
        )

        // Dismiss Watch result
        WatchSessionManager.shared.sendResultDismissedToWatch()

        // Clear persisted session
        SessionPersistence.shared.clear()

        return buildRunResult()
    }

    func reset() {
        phase = .idle
        distanceMeters = 0
        durationSeconds = 0
        avgPaceSecondsPerKm = 0
        currentPaceSecondsPerKm = 0
        calories = 0
        heartRate = 0
        cadence = 0
        elevationGainMeters = 0
        courseId = nil
        goalBPM = nil
        splits = []
        pauseIntervals = []
        bestPace = .infinity
        chunkUploader = nil
        stopTimer()
        stopGPSObservation()
        metronome.stop()
        SessionPersistence.shared.clear()
    }

    // MARK: - GPS Observation

    /// Poll the LocationEngine's @Observable properties at 1Hz
    /// and sync them into this ViewModel's properties.
    private func startGPSObservation() {
        gpsObservationTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.syncFromGPS()
        }
    }

    private func stopGPSObservation() {
        gpsObservationTimer?.invalidate()
        gpsObservationTimer = nil
    }

    private func syncFromGPS() {
        guard phase == .running else { return }
        let engine = gpsTracker.engine

        // Distance
        distanceMeters = engine.cumulativeDistance

        // GPS status
        gpsStatus = mapGPSStatus(engine.gpsAccuracyLevel)

        // Speed -> Pace
        let speed = engine.currentSpeed
        if speed > 0.3 {
            currentPaceSecondsPerKm = 1000.0 / speed
        }

        // Avg pace
        if distanceMeters > 0 {
            avgPaceSecondsPerKm = Double(durationSeconds) / (distanceMeters / 1000.0)
        }

        // Cadence
        cadence = engine.currentCadence

        // Elevation
        elevationGainMeters = engine.elevationGain

        // Calories (rough estimate: ~60 cal per km)
        calories = Int(distanceMeters / 1000.0 * 60)

        // Heart rate from Watch
        let watchHR = WatchSessionManager.shared.lastHeartRate
        if watchHR > 0 {
            heartRate = watchHR
        }

        // Moving state -> auto pause
        isAutoPaused = !engine.isMoving && distanceMeters > 50

        // Notify chunk uploader
        chunkUploader?.onDistanceUpdate(currentDistance: distanceMeters)

        // Session persistence (every GPS update)
        let snapshot = buildPersistenceSnapshot()
        SessionPersistence.shared.onGPSUpdate(snapshot: snapshot)

        // Periodic Watch state update (throttled to 1Hz)
        let now = Date().timeIntervalSince1970
        if now - lastWatchUpdateTime >= watchUpdateInterval {
            lastWatchUpdateTime = now
            gpsTracker.sendWatchStateUpdate(
                phase: phase.rawValue,
                distanceMeters: distanceMeters,
                durationSeconds: durationSeconds,
                currentPace: Int(currentPaceSecondsPerKm),
                avgPace: Int(avgPaceSecondsPerKm),
                calories: calories,
                heartRate: heartRate,
                cadence: cadence
            )

            // Update Live Activity
            updateLiveActivity(isPaused: false)
        }
    }

    private func mapGPSStatus(_ level: GPSAccuracyLevel) -> GPSStatus {
        switch level {
        case .excellent: return .excellent
        case .good: return .good
        case .acquiring: return .acquiring
        case .disabled: return .disabled
        }
    }

    // MARK: - Timer (Date-based duration)

    private func startTimer() {
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self, self.phase == .running else { return }
            self.updateDuration()
        }
    }

    private func stopTimer() {
        timer?.invalidate()
        timer = nil
    }

    private func updateDuration() {
        guard let start = runStartDate else { return }
        var elapsed = Date().timeIntervalSince(start) - pauseAccumulated
        if isPaused, let pauseStart = lastPauseDate {
            elapsed -= Date().timeIntervalSince(pauseStart)
        }
        durationSeconds = max(0, Int(elapsed))
    }

    // MARK: - Live Activity Updates

    private func updateLiveActivity(isPaused: Bool) {
        liveActivity.updateActivity(
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds,
            currentPace: Int(currentPaceSecondsPerKm),
            avgPace: Int(avgPaceSecondsPerKm),
            calories: calories,
            heartRate: heartRate,
            cadence: cadence,
            isPaused: isPaused
        )
    }

    // MARK: - Persistence

    private func persistSession() {
        let snapshot = buildPersistenceSnapshot()
        SessionPersistence.shared.save(snapshot)
    }

    private func buildPersistenceSnapshot() -> PersistedRunningSession {
        SessionPersistence.buildSnapshot(
            sessionId: sessionId,
            courseId: courseId,
            phase: phase.rawValue,
            startTime: runStartDate ?? Date(),
            durationSeconds: durationSeconds,
            isPaused: isPaused,
            isAutoPaused: isAutoPaused,
            distanceMeters: distanceMeters,
            currentPaceSecondsPerKm: currentPaceSecondsPerKm,
            avgPaceSecondsPerKm: avgPaceSecondsPerKm,
            elevationGainMeters: elevationGainMeters,
            elevationLossMeters: gpsTracker.engine.elevationLoss,
            calories: calories,
            filteredLocations: gpsTracker.engine.filteredLocations,
            splits: splits,
            chunkSequence: chunkUploader?.currentChunkSequence ?? 0,
            lastChunkDistance: chunkUploader?.currentLastChunkDistance ?? 0,
            lastChunkPointIndex: chunkUploader?.currentLastChunkPointIndex ?? 0
        )
    }

    // MARK: - Run Result

    private func buildRunResult() -> Run {
        let userId = "current-user"  // Will be replaced with actual user ID from AppState
        return Run(
            userId: userId,
            courseId: courseId,
            startedAt: runStartDate ?? Date(),
            endedAt: .now,
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds,
            avgPaceSecondsPerKm: avgPaceSecondsPerKm,
            bestPaceSecondsPerKm: bestPace.isFinite ? bestPace : nil,
            elevationGainMeters: elevationGainMeters,
            estimatedCalories: calories,
            splits: splits,
            routeGeometry: RouteGeometry(coordinates: gpsTracker.engine.getRouteCoordinates())
        )
    }

    // MARK: - ChunkUploaderDataSource

    func getFilteredLocations() -> [FilteredLocationPoint] {
        gpsTracker.engine.filteredLocations
    }

    func getCurrentDistance() -> Double {
        distanceMeters
    }

    func getAvgPace() -> Double {
        avgPaceSecondsPerKm
    }

    func getElevationGain() -> Double {
        elevationGainMeters
    }

    func getDurationSeconds() -> Int {
        durationSeconds
    }

    func getSplitsForUpload() -> [[String: Any]] {
        splits.map { split in
            [
                "kilometer_index": split.kilometerIndex,
                "duration_seconds": split.durationSeconds,
                "pace_seconds_per_km": split.paceSecondsPerKm,
                "distance_meters": split.distanceMeters,
                "elevation_gain_meters": split.elevationGainMeters
            ]
        }
    }

    func getPauseIntervalsForUpload() -> [[String: Any]] {
        pauseIntervals.map { interval in
            var dict: [String: Any] = ["paused_at": interval.pausedAt]
            if let resumed = interval.resumedAt {
                dict["resumed_at"] = resumed
            }
            return dict
        }
    }
}
