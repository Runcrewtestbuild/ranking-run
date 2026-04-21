import Foundation
import CoreLocation

/// High-level GPS tracking coordinator.
/// Owns LocationEngine and bridges it to WatchSessionManager for Watch updates.
/// ViewModels should use GPSTracker rather than LocationEngine directly.
@Observable
final class GPSTracker {
    static let shared = GPSTracker()

    let engine: LocationEngine

    private var notificationObservers: [NSObjectProtocol] = []

    private init() {
        engine = LocationEngine()
        setupWatchIntegration()
        setupWatchCommands()
    }

    deinit {
        for observer in notificationObservers {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Tracking Control

    func startTracking() {
        engine.startTracking()
        WatchSessionManager.shared.launchWatchApp()
        WatchSessionManager.shared.sendRunStateUpdate([
            "phase": "running",
            "distanceMeters": 0,
            "durationSeconds": 0,
            "currentPace": 0,
            "avgPace": 0,
            "calories": 0
        ])
    }

    func stopTracking() {
        engine.stopTracking()
        WatchSessionManager.shared.stopMirroredWorkout()
        WatchSessionManager.shared.sendRunStateUpdate(["phase": "completed"])
    }

    func pauseTracking() {
        engine.pauseTracking()
        WatchSessionManager.shared.pauseMirroredWorkout()
        WatchSessionManager.shared.sendRunStateUpdate(["phase": "paused"])
    }

    func resumeTracking() {
        engine.resumeTracking()
        WatchSessionManager.shared.resumeMirroredWorkout()
        WatchSessionManager.shared.sendRunStateUpdate(["phase": "running"])
    }

    func sendCountdownToWatch(countdownSeconds: Int) {
        let startedAt = Date().timeIntervalSince1970 * 1000
        WatchSessionManager.shared.sendRunStateUpdate([
            "phase": "countdown",
            "countdownStartedAt": startedAt,
            "countdownTotal": countdownSeconds,
            "distanceMeters": 0,
            "durationSeconds": 0,
            "currentPace": 0,
            "avgPace": 0,
            "calories": 0
        ])
    }

    /// Pre-warm the Watch app when entering the run screen
    func preWarmWatchApp() {
        WatchSessionManager.shared.launchWatchApp()
    }

    /// Cancel watch pre-warm if user navigates back
    func cancelWatchPreWarm() {
        WatchSessionManager.shared.sendRunStateUpdate(["phase": "idle"])
    }

    // MARK: - Watch Integration

    private func setupWatchIntegration() {
        engine.onLocationUpdate = { event in
            WatchSessionManager.shared.sendLocationUpdate(event)
        }

        engine.onMilestoneReached = { km, splitPace, totalTime in
            WatchSessionManager.shared.sendMilestone(km: km, splitPace: splitPace, totalTime: totalTime)
        }
    }

    /// Listen for Watch commands via NotificationCenter (instant native response)
    private func setupWatchCommands() {
        let startObserver = NotificationCenter.default.addObserver(
            forName: WatchSessionManager.watchStartRunNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            NSLog("[GPSTracker] Watch start command received")
            self?.startTracking()
        }
        notificationObservers.append(startObserver)

        let pauseObserver = NotificationCenter.default.addObserver(
            forName: WatchSessionManager.watchPauseRunNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            NSLog("[GPSTracker] Watch pause command received")
            self?.pauseTracking()
        }
        notificationObservers.append(pauseObserver)

        let resumeObserver = NotificationCenter.default.addObserver(
            forName: WatchSessionManager.watchResumeRunNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            NSLog("[GPSTracker] Watch resume command received")
            self?.resumeTracking()
        }
        notificationObservers.append(resumeObserver)

        let stopObserver = NotificationCenter.default.addObserver(
            forName: WatchSessionManager.watchStopRunNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            NSLog("[GPSTracker] Watch stop command received")
            self?.stopTracking()
        }
        notificationObservers.append(stopObserver)
    }

    /// Send periodic state update to Watch during a run
    func sendWatchStateUpdate(
        phase: String,
        distanceMeters: Double,
        durationSeconds: Int,
        currentPace: Int,
        avgPace: Int,
        calories: Int,
        heartRate: Int = 0,
        cadence: Int = 0
    ) {
        WatchSessionManager.shared.sendRunStateUpdate([
            "phase": phase,
            "distanceMeters": distanceMeters,
            "durationSeconds": durationSeconds,
            "currentPace": currentPace,
            "avgPace": avgPace,
            "calories": calories,
            "heartRate": heartRate,
            "cadence": cadence
        ])
    }
}
