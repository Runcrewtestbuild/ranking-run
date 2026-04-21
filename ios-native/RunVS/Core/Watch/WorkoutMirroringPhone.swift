import Foundation
import HealthKit

/// Phone-side HKWorkoutSession mirroring receiver.
/// Receives mirrored workout sessions from the Apple Watch for instant phase sync.
/// The WATCH creates the session and mirrors it to the phone via
/// startMirroringToCompanionDevice(). This manager receives the mirrored session
/// and can call pause()/resume()/end() on it for bidirectional control.
@available(iOS 17, *)
class WorkoutMirroringPhone: NSObject {
    static let shared = WorkoutMirroringPhone()

    private let healthStore = HKHealthStore()
    private(set) var session: HKWorkoutSession?

    /// Fires when HKWorkoutSession state changes. Parameters: (oldPhase, newPhase)
    var onPhaseChange: ((String, String) -> Void)?

    var isSessionActive: Bool {
        guard let session else { return false }
        return session.state == .running || session.state == .paused || session.state == .prepared
    }

    private var hasRequestedAuth = false

    private override init() {
        super.init()
    }

    // MARK: - Setup

    func setup() {
        healthStore.workoutSessionMirroringStartHandler = { [weak self] mirroredSession in
            DispatchQueue.main.async {
                self?.handleMirroredSession(mirroredSession)
            }
        }
        NSLog("[WorkoutMirrorPhone] setup complete")
    }

    func ensureAuthorized() {
        guard !hasRequestedAuth else { return }
        hasRequestedAuth = true
        requestAuthorization { granted in
            NSLog("[WorkoutMirrorPhone] HealthKit auth: %@", granted ? "granted" : "denied")
        }
    }

    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false)
            return
        }

        let typesToShare: Set<HKSampleType> = [HKObjectType.workoutType()]
        let typesToRead: Set<HKObjectType> = []

        healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead) { success, error in
            if let error {
                NSLog("[WorkoutMirrorPhone] Auth error: %@", error.localizedDescription)
            }
            DispatchQueue.main.async { completion(success) }
        }
    }

    // MARK: - Mirrored Session

    private func handleMirroredSession(_ mirroredSession: HKWorkoutSession) {
        NSLog("[WorkoutMirrorPhone] Received mirrored session, state=%d", mirroredSession.state.rawValue)

        if let existing = session, existing !== mirroredSession {
            existing.end()
        }

        session = mirroredSession
        mirroredSession.delegate = self
    }

    func pauseRun() {
        session?.pause()
    }

    func resumeRun() {
        session?.resume()
    }

    func stopRun() {
        session?.end()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.cleanup()
        }
    }

    func cleanup() {
        session = nil
    }

    // MARK: - State Mapping

    private func mapStateToPhase(_ state: HKWorkoutSessionState) -> String {
        switch state {
        case .notStarted, .prepared: return "idle"
        case .running: return "running"
        case .paused: return "paused"
        case .stopped, .ended: return "completed"
        @unknown default: return "idle"
        }
    }
}

// MARK: - HKWorkoutSessionDelegate

@available(iOS 17, *)
extension WorkoutMirroringPhone: HKWorkoutSessionDelegate {
    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        let oldPhase = mapStateToPhase(fromState)
        let newPhase = mapStateToPhase(toState)

        DispatchQueue.main.async { [weak self] in
            self?.onPhaseChange?(oldPhase, newPhase)
        }

        if toState == .stopped || toState == .ended {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
                self?.cleanup()
            }
        }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        NSLog("[WorkoutMirrorPhone] session failed: %@", error.localizedDescription)
        DispatchQueue.main.async { [weak self] in
            self?.cleanup()
        }
    }
}
