import SwiftUI

@main
struct RunVSApp: App {
    @State private var appState = AppState()
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.isCheckingAuth {
                    // Splash / loading while checking stored tokens
                    ZStack {
                        RVColors.background
                            .ignoresSafeArea()
                        ProgressView()
                            .tint(RVColors.primary)
                    }
                } else {
                    ContentView()
                }
            }
            .environment(appState)
            .preferredColorScheme(.dark)
            .task {
                await appState.loadStoredAuth()
            }
            .onReceive(NotificationCenter.default.publisher(for: .authDidLogin)) { notification in
                if let user = notification.userInfo?["user"] as? User {
                    appState.setUser(user)
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .authDidLogout)) { _ in
                appState.signOut()
            }
        }
    }
}

// MARK: - AppDelegate (Push Notifications + Watch + Lifecycle)

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Activate Watch connectivity
        WatchSessionManager.shared.activate()

        // Set up push notifications
        PushManager.shared.refreshPermissionStatus()

        // Retry any pending chunk uploads from previous sessions
        ChunkUploader.retryPendingChunks()

        return true
    }

    // MARK: - Push Token

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        PushManager.shared.didRegisterForRemoteNotifications(deviceToken: deviceToken)
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        PushManager.shared.didFailToRegisterForRemoteNotifications(error: error)
    }

    // MARK: - Termination Cleanup

    func applicationWillTerminate(_ application: UIApplication) {
        LiveActivityManager.endAllActivities()
    }
}
