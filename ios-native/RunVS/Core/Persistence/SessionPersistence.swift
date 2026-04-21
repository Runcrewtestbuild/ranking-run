import Foundation
import UIKit

/// Persisted snapshot of a running session for crash recovery.
/// Matches the behavior of RN's useRunningSessionPersistence:
/// - Save every 10 GPS updates (~10s)
/// - Save immediately on background transition
/// - Save on pause/resume transitions
/// - Clear on session complete or reset
struct PersistedRunningSession: Codable {
    let sessionId: String
    var courseId: String?
    var phase: String
    var startTime: TimeInterval     // epoch ms
    var durationSeconds: Int
    var isPaused: Bool
    var isAutoPaused: Bool
    var distanceMeters: Double
    var currentPaceSecondsPerKm: Double
    var avgPaceSecondsPerKm: Double
    var elevationGainMeters: Double
    var elevationLossMeters: Double
    var calories: Int
    var filteredLocations: [FilteredLocationPoint]
    var splits: [Split]
    var chunkSequence: Int
    var lastChunkDistance: Double
    var lastChunkPointIndex: Int
    var savedAt: TimeInterval       // epoch ms
}

/// Manages periodic persistence of running session state to disk.
/// Uses a JSON file in the app's Documents directory for reliability.
final class SessionPersistence {
    static let shared = SessionPersistence()

    private let persistInterval = 10  // Save every N GPS updates
    private var updateCount = 0
    private var backgroundObserver: NSObjectProtocol?

    private var fileURL: URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("running_session_backup.json")
    }

    private init() {
        observeBackgroundTransition()
    }

    deinit {
        if let observer = backgroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    /// Called on each GPS update. Saves periodically based on persistInterval.
    func onGPSUpdate(snapshot: PersistedRunningSession) {
        updateCount += 1
        if updateCount % persistInterval == 0 {
            save(snapshot)
        }
    }

    /// Save immediately (e.g., on pause/resume, background transition)
    func save(_ snapshot: PersistedRunningSession) {
        do {
            let data = try JSONEncoder().encode(snapshot)
            try data.write(to: fileURL, options: .atomic)
        } catch {
            NSLog("[SessionPersistence] Save failed: %@", error.localizedDescription)
        }
    }

    /// Load persisted session (for crash recovery on app restart)
    func load() -> PersistedRunningSession? {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return nil }
        do {
            let data = try Data(contentsOf: fileURL)
            let session = try JSONDecoder().decode(PersistedRunningSession.self, from: data)

            // Validate: reject sessions older than 24 hours (stale data)
            let age = Date().timeIntervalSince1970 * 1000 - session.savedAt
            if age > 24 * 60 * 60 * 1000 {
                NSLog("[SessionPersistence] Discarding stale session (%.0f hours old)", age / 3600000)
                clear()
                return nil
            }

            NSLog("[SessionPersistence] Loaded session: %.0fm, %ds",
                  session.distanceMeters, session.durationSeconds)
            return session
        } catch {
            NSLog("[SessionPersistence] Load failed: %@", error.localizedDescription)
            return nil
        }
    }

    /// Clear persisted data (on session complete or reset)
    func clear() {
        updateCount = 0
        try? FileManager.default.removeItem(at: fileURL)
    }

    /// Check if there is a persisted session available for recovery
    var hasPersistedSession: Bool {
        FileManager.default.fileExists(atPath: fileURL.path)
    }

    // MARK: - Background Observation

    private func observeBackgroundTransition() {
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            // The actual snapshot is built and saved by RunningViewModel
            // which calls save() directly when backgrounding.
            NSLog("[SessionPersistence] App entering background")
            _ = self  // prevent unused warning
        }
    }

    // MARK: - Snapshot Builder

    /// Build a snapshot from the current ViewModel state.
    /// Called by RunningViewModel to create a persistable representation.
    static func buildSnapshot(
        sessionId: String,
        courseId: String?,
        phase: String,
        startTime: Date,
        durationSeconds: Int,
        isPaused: Bool,
        isAutoPaused: Bool,
        distanceMeters: Double,
        currentPaceSecondsPerKm: Double,
        avgPaceSecondsPerKm: Double,
        elevationGainMeters: Double,
        elevationLossMeters: Double,
        calories: Int,
        filteredLocations: [FilteredLocationPoint],
        splits: [Split],
        chunkSequence: Int,
        lastChunkDistance: Double,
        lastChunkPointIndex: Int
    ) -> PersistedRunningSession {
        PersistedRunningSession(
            sessionId: sessionId,
            courseId: courseId,
            phase: phase,
            startTime: startTime.timeIntervalSince1970 * 1000,
            durationSeconds: durationSeconds,
            isPaused: isPaused,
            isAutoPaused: isAutoPaused,
            distanceMeters: distanceMeters,
            currentPaceSecondsPerKm: currentPaceSecondsPerKm,
            avgPaceSecondsPerKm: avgPaceSecondsPerKm,
            elevationGainMeters: elevationGainMeters,
            elevationLossMeters: elevationLossMeters,
            calories: calories,
            filteredLocations: Array(filteredLocations.suffix(10000)),
            splits: splits,
            chunkSequence: chunkSequence,
            lastChunkDistance: lastChunkDistance,
            lastChunkPointIndex: lastChunkPointIndex,
            savedAt: Date().timeIntervalSince1970 * 1000
        )
    }
}
