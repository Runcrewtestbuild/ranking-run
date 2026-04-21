import Foundation
import UIKit
import UserNotifications

/// Manages push notification registration and device token lifecycle.
/// Registers with APNs and sends the device token to the backend.
@Observable
final class PushManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushManager()

    private(set) var isRegistered = false
    private(set) var deviceToken: String?
    private(set) var permissionStatus: UNAuthorizationStatus = .notDetermined

    /// Posted when a notification tap should navigate somewhere
    static let notificationTappedNotification = Notification.Name("PushNotificationTapped")

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Registration

    /// Request notification permissions and register with APNs
    func requestPermissionAndRegister() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { [weak self] granted, error in
            DispatchQueue.main.async {
                self?.permissionStatus = granted ? .authorized : .denied
                if granted {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
            if let error {
                NSLog("[PushManager] Permission error: %@", error.localizedDescription)
            }
        }
    }

    /// Check current permission status (call on app launch)
    func refreshPermissionStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.permissionStatus = settings.authorizationStatus
                if settings.authorizationStatus == .authorized {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    // MARK: - Token Handling

    /// Called from AppDelegate when APNs registration succeeds
    func didRegisterForRemoteNotifications(deviceToken token: Data) {
        let tokenString = token.map { String(format: "%02.2hhx", $0) }.joined()
        self.deviceToken = tokenString
        self.isRegistered = true
        NSLog("[PushManager] Device token: %@", tokenString)

        // Send token to backend
        Task {
            await sendTokenToBackend(tokenString)
        }
    }

    /// Called from AppDelegate when APNs registration fails
    func didFailToRegisterForRemoteNotifications(error: Error) {
        NSLog("[PushManager] Registration failed: %@", error.localizedDescription)
        isRegistered = false
    }

    // MARK: - Backend Registration

    private func sendTokenToBackend(_ token: String) async {
        do {
            try await APIClient.shared.requestVoid(
                .registerPushToken(token: token, platform: "ios")
            )
            NSLog("[PushManager] Token sent to backend successfully")
        } catch {
            NSLog("[PushManager] Failed to send token to backend: %@", error.localizedDescription)
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Handle notification when app is in foreground
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show banner even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }

    /// Handle notification tap
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        NSLog("[PushManager] Notification tapped: %@", userInfo.description)

        // Post notification for the app to handle navigation
        NotificationCenter.default.post(
            name: Self.notificationTappedNotification,
            object: nil,
            userInfo: userInfo
        )

        completionHandler()
    }
}
