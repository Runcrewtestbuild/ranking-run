import SwiftUI

@Observable
@MainActor
class AppState {
    var currentUser: User?
    var isCheckingAuth = true

    var nickname: String {
        currentUser?.nickname ?? "Runner"
    }

    var isAuthenticated: Bool {
        currentUser != nil
    }

    // MARK: - Auth Lifecycle

    /// Check Keychain for stored tokens and auto-login on app launch
    func loadStoredAuth() async {
        isCheckingAuth = true
        if let user = await AuthManager.shared.loadStoredAuth() {
            currentUser = user
        }
        isCheckingAuth = false
    }

    /// Called after successful login to set the user
    func setUser(_ user: User) {
        currentUser = user
    }

    func signOut() {
        AuthManager.shared.signOut()
        currentUser = nil
    }

    /// Quick sign-in for development: creates a mock user
    func devSignIn(nickname: String = "Runner") {
        currentUser = User(
            id: "dev-user",
            userCode: "DEV001",
            email: "dev@test.com",
            nickname: nickname,
            avatarUrl: nil,
            birthday: nil,
            gender: nil,
            heightCm: nil,
            weightKg: nil,
            bio: nil,
            instagramUsername: nil,
            country: nil,
            totalDistanceMeters: 123_450,
            totalRuns: 42,
            totalPoints: 0,
            runnerLevel: 5,
            createdAt: nil
        )
    }
}
