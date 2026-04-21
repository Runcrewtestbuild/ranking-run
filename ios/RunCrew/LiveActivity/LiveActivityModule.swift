import Foundation
import ActivityKit

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {

    private var activityId: String?
    private let activityQueue = DispatchQueue(label: "com.runcrew.liveactivity")

    // MARK: - Start

    @objc
    func startActivity(_ data: NSDictionary,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else {
            reject("UNAVAILABLE", "Live Activities require iOS 16.2+", nil)
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            reject("DISABLED", "Live Activities are disabled by the user", nil)
            return
        }

        let courseName = data["courseName"] as? String ?? ""
        let isCourseRun = data["isCourseRun"] as? Bool ?? false
        let durationSeconds = data["durationSeconds"] as? Int ?? 0

        activityQueue.async { [weak self] in
            let attributes = RunningActivityAttributes(
                courseName: courseName,
                isCourseRun: isCourseRun
            )
            let initialState = RunningActivityAttributes.ContentState(
                distanceMeters: 0,
                durationSeconds: durationSeconds,
                currentPace: 0,
                avgPace: 0,
                calories: 0,
                heartRate: 0,
                cadence: 0,
                isPaused: false,
                timerStartDate: Date().addingTimeInterval(-Double(durationSeconds))
            )

            do {
                let activity = try Activity.request(
                    attributes: attributes,
                    content: .init(state: initialState, staleDate: Date().addingTimeInterval(300)),
                    pushType: nil
                )
                self?.activityId = activity.id
                print("[LiveActivity] Started: \(activity.id)")
                DispatchQueue.main.async { resolve(activity.id) }
            } catch {
                print("[LiveActivity] Start failed: \(error)")
                DispatchQueue.main.async { reject("START_FAILED", error.localizedDescription, error) }
            }
        }
    }

    // MARK: - Update

    @objc
    func updateActivity(_ data: NSDictionary,
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        let distanceMeters = data["distanceMeters"] as? Double ?? 0
        let durationSeconds = data["durationSeconds"] as? Int ?? 0
        let currentPace = data["currentPace"] as? Int ?? 0
        let avgPace = data["avgPace"] as? Int ?? 0
        let calories = data["calories"] as? Int ?? 0
        let heartRate = data["heartRate"] as? Int ?? 0
        let cadence = data["cadence"] as? Int ?? 0
        let isPaused = data["isPaused"] as? Bool ?? false

        activityQueue.async { [weak self] in
            let state = RunningActivityAttributes.ContentState(
                distanceMeters: distanceMeters,
                durationSeconds: durationSeconds,
                currentPace: currentPace,
                avgPace: avgPace,
                calories: calories,
                heartRate: heartRate,
                cadence: cadence,
                isPaused: isPaused,
                timerStartDate: Date().addingTimeInterval(-Double(durationSeconds))
            )

            Task { [weak self] in
                guard let self = self else {
                    DispatchQueue.main.async { resolve(false) }
                    return
                }
                guard let activity = Activity<RunningActivityAttributes>.activities.first(where: { $0.id == self.activityId }) else {
                    guard let fallback = Activity<RunningActivityAttributes>.activities.first else {
                        DispatchQueue.main.async { resolve(false) }
                        return
                    }
                    self.activityId = fallback.id
                    await fallback.update(
                        .init(state: state, staleDate: Date().addingTimeInterval(300)),
                        alertConfiguration: nil
                    )
                    DispatchQueue.main.async { resolve(true) }
                    return
                }
                await activity.update(
                    .init(state: state, staleDate: Date().addingTimeInterval(300)),
                    alertConfiguration: nil
                )
                DispatchQueue.main.async { resolve(true) }
            }
        }
    }

    // MARK: - End

    @objc
    func endActivity(_ data: NSDictionary,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard #available(iOS 16.2, *) else {
            resolve(false)
            return
        }

        let distanceMeters = data["distanceMeters"] as? Double ?? 0
        let durationSeconds = data["durationSeconds"] as? Int ?? 0
        let currentPace = data["currentPace"] as? Int ?? 0
        let avgPace = data["avgPace"] as? Int ?? 0
        let calories = data["calories"] as? Int ?? 0
        let heartRate = data["heartRate"] as? Int ?? 0
        let cadence = data["cadence"] as? Int ?? 0

        activityQueue.async { [weak self] in
            let finalState = RunningActivityAttributes.ContentState(
                distanceMeters: distanceMeters,
                durationSeconds: durationSeconds,
                currentPace: currentPace,
                avgPace: avgPace,
                calories: calories,
                heartRate: heartRate,
                cadence: cadence,
                isPaused: true,
                timerStartDate: Date().addingTimeInterval(-Double(durationSeconds))
            )

            Task { [weak self] in
                for activity in Activity<RunningActivityAttributes>.activities {
                    await activity.end(
                        .init(state: finalState, staleDate: Date().addingTimeInterval(300)),
                        dismissalPolicy: .immediate
                    )
                }
                self?.activityId = nil
                print("[LiveActivity] Ended")
                DispatchQueue.main.async { resolve(true) }
            }
        }
    }

    // MARK: - Check availability

    @objc
    func isAvailable(_ resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 16.2, *) {
            resolve(ActivityAuthorizationInfo().areActivitiesEnabled)
        } else {
            resolve(false)
        }
    }

    // MARK: - Native cleanup (called from AppDelegate on terminate/force-quit)

    /// End all running Live Activities without going through JS bridge.
    /// Safe to call from any thread; no-op on iOS < 16.2.
    @objc
    static func endAllActivities() {
        guard #available(iOS 16.2, *) else { return }
        Task {
            for activity in Activity<RunningActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            print("[LiveActivity] endAllActivities: dismissed all")
        }
    }

    // MARK: - RN bridge metadata

    @objc
    static func requiresMainQueueSetup() -> Bool { false }
}
