import Foundation
import ActivityKit

/// Manages Live Activity for the running session.
/// @Observable wrapper around ActivityKit APIs, replacing the RN bridge LiveActivityModule.
@Observable
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private(set) var isActive = false
    private(set) var activityId: String?

    private let activityQueue = DispatchQueue(label: "com.runcrew.liveactivity")

    private init() {}

    // MARK: - Availability

    var isAvailable: Bool {
        guard #available(iOS 16.2, *) else { return false }
        return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    // MARK: - Start

    func startActivity(
        courseName: String = "",
        isCourseRun: Bool = false,
        durationSeconds: Int = 0
    ) {
        guard #available(iOS 16.2, *) else { return }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            NSLog("[LiveActivity] Activities disabled by user")
            return
        }

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
                DispatchQueue.main.async {
                    self?.activityId = activity.id
                    self?.isActive = true
                }
                NSLog("[LiveActivity] Started: %@", activity.id)
            } catch {
                NSLog("[LiveActivity] Start failed: %@", error.localizedDescription)
            }
        }
    }

    // MARK: - Update

    func updateActivity(
        distanceMeters: Double,
        durationSeconds: Int,
        currentPace: Int,
        avgPace: Int,
        calories: Int,
        heartRate: Int = 0,
        cadence: Int = 0,
        isPaused: Bool = false
    ) {
        guard #available(iOS 16.2, *) else { return }

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

        activityQueue.async { [weak self] in
            Task { [weak self] in
                guard let self else { return }
                let targetId = await MainActor.run { self.activityId }

                guard let activity = Activity<RunningActivityAttributes>.activities.first(where: { $0.id == targetId })
                    ?? Activity<RunningActivityAttributes>.activities.first else {
                    return
                }

                // Update tracked ID if we fell back to first activity
                if activity.id != targetId {
                    await MainActor.run { self.activityId = activity.id }
                }

                await activity.update(
                    .init(state: state, staleDate: Date().addingTimeInterval(300)),
                    alertConfiguration: nil
                )
            }
        }
    }

    // MARK: - End

    func endActivity(
        distanceMeters: Double = 0,
        durationSeconds: Int = 0,
        currentPace: Int = 0,
        avgPace: Int = 0,
        calories: Int = 0,
        heartRate: Int = 0,
        cadence: Int = 0
    ) {
        guard #available(iOS 16.2, *) else { return }

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

        activityQueue.async { [weak self] in
            Task {
                for activity in Activity<RunningActivityAttributes>.activities {
                    await activity.end(
                        .init(state: finalState, staleDate: Date().addingTimeInterval(300)),
                        dismissalPolicy: .immediate
                    )
                }
                await MainActor.run {
                    self?.activityId = nil
                    self?.isActive = false
                }
                NSLog("[LiveActivity] Ended")
            }
        }
    }

    // MARK: - Cleanup (app termination)

    static func endAllActivities() {
        guard #available(iOS 16.2, *) else { return }
        Task {
            for activity in Activity<RunningActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            NSLog("[LiveActivity] endAllActivities: dismissed all")
        }
    }
}
