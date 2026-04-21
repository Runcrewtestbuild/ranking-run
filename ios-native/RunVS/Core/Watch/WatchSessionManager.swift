import Foundation
import HealthKit
import UIKit
import WatchConnectivity

/// Singleton that owns WCSession and mediates Phone <-> Watch communication.
/// Migrated from RN bridge version: all RCT/ObjC annotations removed.
@Observable
final class WatchSessionManager: NSObject, WCSessionDelegate {
    static let shared = WatchSessionManager()

    // Observable state for UI
    private(set) var isWatchConnected = false
    private(set) var lastHeartRate: Int = 0

    // Callbacks for standalone watch runs
    var onStandaloneRunReceived: (([String: Any]) -> Void)? {
        didSet {
            guard onStandaloneRunReceived != nil else { return }
            let buffered = pendingStandaloneRuns
            pendingStandaloneRuns.removeAll()
            for run in buffered {
                NSLog("[WatchSessionMgr] Flushing buffered standalone run")
                onStandaloneRunReceived?(run)
            }
        }
    }

    private var pendingStandaloneRuns: [[String: Any]] = []
    private var lastSendTime: TimeInterval = 0
    private let throttleInterval: TimeInterval = 1.0
    private(set) var lastRunState: [String: Any]?
    private(set) var currentRunPhase: String = "idle"

    private var lastCommandTimestamp: Double = 0
    private var lastAuthoritativePhaseChange: Date = .distantPast

    // Notifications for native command handling
    static let watchStartRunNotification = Notification.Name("WatchStartRunRequested")
    static let watchPauseRunNotification = Notification.Name("WatchPauseRunRequested")
    static let watchResumeRunNotification = Notification.Name("WatchResumeRunRequested")
    static let watchStopRunNotification = Notification.Name("WatchStopRunRequested")

    private override init() {
        super.init()
    }

    private var session: WCSession { WCSession.default }

    // MARK: - Activation

    func activate() {
        guard WCSession.isSupported() else {
            NSLog("[WatchSessionMgr] WCSession NOT supported")
            return
        }
        session.delegate = self
        session.activate()
        NSLog("[WatchSessionMgr] WCSession activate() called")

        setupWorkoutMirroring()
    }

    private func setupWorkoutMirroring() {
        if #available(iOS 17, *) {
            let mgr = WorkoutMirroringPhone.shared
            mgr.setup()

            mgr.onPhaseChange = { [weak self] oldPhase, newPhase in
                guard let self else { return }
                NSLog("[WatchSessionMgr] MIRRORED phase: %@->%@", oldPhase, newPhase)

                self.currentRunPhase = newPhase
                self.lastAuthoritativePhaseChange = Date()

                switch newPhase {
                case "running" where oldPhase == "idle" || oldPhase == "completed":
                    NSLog("[WatchSessionMgr] MIRRORED start ignored - standalone or handled via WCSession")
                case "paused":
                    NotificationCenter.default.post(name: Self.watchPauseRunNotification, object: nil)
                case "running" where oldPhase == "paused":
                    NotificationCenter.default.post(name: Self.watchResumeRunNotification, object: nil)
                case "completed":
                    NotificationCenter.default.post(name: Self.watchStopRunNotification, object: nil)
                default:
                    break
                }
            }
        }
    }

    // MARK: - Launch Watch App

    private let healthStore = HKHealthStore()

    func launchWatchApp() {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        guard WCSession.isSupported() else { return }
        let wc = WCSession.default
        guard wc.isPaired, wc.isWatchAppInstalled else {
            NSLog("[WatchSessionMgr] Skip startWatchApp - watch not paired or app not installed")
            return
        }

        if #available(iOS 17, *) {
            WorkoutMirroringPhone.shared.ensureAuthorized()
        }

        let config = HKWorkoutConfiguration()
        config.activityType = .running
        config.locationType = .outdoor

        healthStore.startWatchApp(with: config) { success, error in
            if success {
                NSLog("[WatchSessionMgr] startWatchApp succeeded")
            } else {
                NSLog("[WatchSessionMgr] startWatchApp failed: %@", error?.localizedDescription ?? "unknown")
            }
        }
    }

    // MARK: - Mirrored Workout Control

    func pauseMirroredWorkout() {
        if #available(iOS 17, *) {
            WorkoutMirroringPhone.shared.pauseRun()
        }
    }

    func resumeMirroredWorkout() {
        if #available(iOS 17, *) {
            WorkoutMirroringPhone.shared.resumeRun()
        }
    }

    func stopMirroredWorkout() {
        if #available(iOS 17, *) {
            WorkoutMirroringPhone.shared.stopRun()
        }
    }

    // MARK: - Status

    var isWatchReachable: Bool {
        WCSession.isSupported() ? session.isReachable : false
    }
    var isWatchPaired: Bool {
        WCSession.isSupported() ? session.isPaired : false
    }
    var isWatchAppInstalled: Bool {
        WCSession.isSupported() ? session.isWatchAppInstalled : false
    }

    // MARK: - Send to Watch

    private(set) var lastLocationData: [String: Any]?

    func sendLocationUpdate(_ data: [String: Any]) {
        let now = Date().timeIntervalSince1970
        guard now - lastSendTime >= throttleInterval else { return }
        guard session.activationState == .activated, session.isPaired, session.isReachable else { return }
        lastSendTime = now

        var message = data
        message["type"] = "locationUpdate"
        lastLocationData = message

        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    private static let carryForwardKeys: Set<String> = [
        "goalType", "goalValue",
        "programTargetDistance", "programTargetTime", "programTimeDelta",
        "programRequiredPace", "programStatus", "metronomeBPM",
        "countdownStartedAt", "countdownTotal",
        "intervalRunSeconds", "intervalWalkSeconds", "intervalTotalSets"
    ]

    func sendRunStateUpdate(_ state: [String: Any], authoritative: Bool = true) {
        var message = state
        message["type"] = "stateUpdate"
        if message["timestamp"] == nil {
            message["timestamp"] = Date().timeIntervalSince1970 * 1000
        }

        let newPhaseForReset = message["phase"] as? String
        if newPhaseForReset == "countdown" || (newPhaseForReset == "running" && currentRunPhase == "idle") {
            lastRunState = nil
        }

        // Carry forward program goal fields
        if let last = lastRunState {
            for key in Self.carryForwardKeys {
                if message[key] == nil, let cached = last[key] {
                    message[key] = cached
                }
            }
        }

        let newPhase = message["phase"] as? String
        var isPhaseChange = newPhase != nil && newPhase != currentRunPhase

        if isPhaseChange && !authoritative {
            let isActiveRun = currentRunPhase == "running" || currentRunPhase == "paused"
            if isActiveRun {
                let elapsed = Date().timeIntervalSince(lastAuthoritativePhaseChange)
                if elapsed < 3.0 {
                    message["phase"] = currentRunPhase
                    isPhaseChange = false
                }
            }
        }

        if isPhaseChange, let phase = newPhase {
            currentRunPhase = phase
            if authoritative {
                lastAuthoritativePhaseChange = Date()
            }
            if phase == "countdown" {
                launchWatchApp()
            }
            if phase == "completed" || phase == "idle" {
                if #available(iOS 17, *) {
                    WorkoutMirroringPhone.shared.stopRun()
                }
            }
        }

        lastRunState = message

        // Phase delivery routing
        let mirroringHandlesPhase: Bool
        if #available(iOS 17, *) {
            mirroringHandlesPhase = isPhaseChange
                && WorkoutMirroringPhone.shared.session != nil
                && newPhase != "countdown"
                && newPhase != "idle"
        } else {
            mirroringHandlesPhase = false
        }

        if mirroringHandlesPhase {
            var dataOnly = message
            dataOnly.removeValue(forKey: "phase")
            trySendMessage(dataOnly)
        } else if isPhaseChange {
            session.transferUserInfo(message)
            do { try session.updateApplicationContext(message) } catch {}
            trySendMessage(message)
        } else {
            trySendMessage(message)
        }
    }

    private func trySendMessage(_ message: [String: Any]) {
        guard session.activationState == .activated, session.isPaired, session.isReachable else { return }
        session.sendMessage(message, replyHandler: nil) { _ in }
    }

    func sendWeeklyGoalToWatch(_ goalKm: Double) {
        guard session.activationState == .activated, session.isPaired else { return }

        if session.isReachable {
            let message: [String: Any] = [
                "type": "stateUpdate",
                "weeklyGoalKm": goalKm,
                "timestamp": Date().timeIntervalSince1970 * 1000
            ]
            session.sendMessage(message, replyHandler: nil, errorHandler: nil)
        }

        var ctx: [String: Any] = [
            "type": "stateUpdate",
            "weeklyGoalKm": goalKm,
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        if let last = lastRunState {
            for (key, value) in last where ctx[key] == nil {
                ctx[key] = value
            }
        }
        do { try session.updateApplicationContext(ctx) } catch {}
    }

    func sendResultDismissedToWatch() {
        guard session.activationState == .activated, session.isPaired else { return }
        let message: [String: Any] = [
            "type": "resultDismissed",
            "timestamp": Date().timeIntervalSince1970 * 1000
        ]
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil, errorHandler: nil)
        }
        session.transferUserInfo(message)
    }

    func sendMilestone(km: Int, splitPace: Int, totalTime: Int) {
        guard session.activationState == .activated, session.isPaired else { return }
        let message: [String: Any] = [
            "type": "milestone",
            "kilometer": km,
            "splitPace": splitPace,
            "totalTime": totalTime
        ]
        session.transferUserInfo(message)
        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    // MARK: - Watch Command Handling

    private func handleWatchCommand(_ message: [String: Any]) {
        let cmd = message["command"] as? String ?? ""
        let ts = message["timestamp"] as? Double ?? 0

        if ts > 0 && ts == lastCommandTimestamp { return }
        lastCommandTimestamp = ts

        NSLog("[WatchSessionMgr] handleWatchCommand: %@", cmd)

        switch cmd {
        case "start":
            NotificationCenter.default.post(name: Self.watchStartRunNotification, object: nil)
        case "pause":
            NotificationCenter.default.post(name: Self.watchPauseRunNotification, object: nil)
        case "resume":
            NotificationCenter.default.post(name: Self.watchResumeRunNotification, object: nil)
        case "stop":
            NotificationCenter.default.post(name: Self.watchStopRunNotification, object: nil)
        default:
            break
        }
    }

    private func deliverStandaloneRun(_ data: [String: Any]) {
        if let callback = onStandaloneRunReceived {
            callback(data)
        } else {
            pendingStandaloneRuns.append(data)
        }
    }

    // MARK: - WCSessionDelegate

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {
        NSLog("[WatchSessionMgr] activation state=%d paired=%d reachable=%d",
              activationState.rawValue, session.isPaired ? 1 : 0, session.isReachable ? 1 : 0)
        DispatchQueue.main.async { [weak self] in
            self?.isWatchConnected = session.isPaired && session.isReachable
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async { [weak self] in
            self?.isWatchConnected = session.isPaired && session.isReachable
        }
        if session.isReachable, let state = lastRunState {
            session.sendMessage(state, replyHandler: nil, errorHandler: nil)
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        switch type {
        case "command":
            handleWatchCommand(message)
        case "heartRate":
            DispatchQueue.main.async { [weak self] in
                self?.lastHeartRate = message["heartRate"] as? Int ?? 0
            }
        case "standaloneRunComplete":
            deliverStandaloneRun(message)
        default:
            break
        }
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        let type = userInfo["type"] as? String ?? ""
        switch type {
        case "standaloneRunComplete":
            deliverStandaloneRun(userInfo)
        case "command":
            handleWatchCommand(userInfo)
        default:
            break
        }
    }

    func session(_ session: WCSession,
                 didReceiveMessage message: [String: Any],
                 replyHandler: @escaping ([String: Any]) -> Void) {
        guard let type = message["type"] as? String else {
            replyHandler(["status": "error"])
            return
        }
        switch type {
        case "command":
            handleWatchCommand(message)
            replyHandler(["status": "ok"])
        case "heartRate":
            DispatchQueue.main.async { [weak self] in
                self?.lastHeartRate = message["heartRate"] as? Int ?? 0
            }
            replyHandler(["status": "ok"])
        case "standaloneRunComplete":
            deliverStandaloneRun(message)
            replyHandler(["status": "ok"])
        case "requestState":
            var reply: [String: Any] = lastRunState ?? ["type": "stateUpdate", "phase": currentRunPhase]
            if let loc = lastLocationData {
                for (key, value) in loc where key != "type" {
                    reply[key] = value
                }
            }
            replyHandler(reply)
        default:
            replyHandler(["status": "unknown"])
        }
    }
}
