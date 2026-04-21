import Foundation
import Security
import AuthenticationServices
import CryptoKit
import GoogleSignIn

@Observable
@MainActor
final class AuthManager {
    static let shared = AuthManager()

    private(set) var accessToken: String?
    private(set) var refreshTokenValue: String?
    private(set) var isLoading = false
    private(set) var isNewUser = false
    private(set) var error: String?

    private let service = "com.runcrew.runvs"

    /// Raw nonce for Apple Sign In (kept in memory during sign-in flow)
    private var currentNonce: String?

    private init() {
        accessToken = loadFromKeychain(account: "accessToken")
        refreshTokenValue = loadFromKeychain(account: "refreshToken")
    }

    // MARK: - Apple Sign In

    /// Generate a cryptographically secure random nonce
    func generateNonce() -> String {
        let nonce = UUID().uuidString + UUID().uuidString
        currentNonce = nonce
        return nonce
    }

    /// SHA256 hash of the nonce, used as the Apple Sign In nonce parameter
    func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }

    /// Handle the Apple Sign In credential after ASAuthorizationController completes
    func handleAppleSignIn(credential: ASAuthorizationAppleIDCredential) async throws {
        guard let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            throw AuthError.noIdentityToken
        }

        guard let rawNonce = currentNonce else {
            throw AuthError.noNonce
        }

        try await login(provider: "apple", token: identityToken, nonce: rawNonce)
    }

    // MARK: - Google Sign In (stub)

    // Web Client ID — backend validates aud against this
    private let googleServerClientID = "61103557165-8483ddhkn2ds739saiodr41a4sbod450.apps.googleusercontent.com"

    func signInWithGoogle() async throws {
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootVC = windowScene.windows.first?.rootViewController else {
            throw AuthError.custom("Google 로그인을 시작할 수 없습니다")
        }

        // Request ID token with server client ID so aud matches backend's expected value
        let config = GIDConfiguration(clientID: GIDSignIn.sharedInstance.configuration?.clientID ?? "",
                                       serverClientID: googleServerClientID)
        GIDSignIn.sharedInstance.configuration = config

        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootVC)
        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.custom("Google ID 토큰을 받지 못했습니다")
        }

        try await login(provider: "google", token: idToken)
    }

    // MARK: - Login (backend API call)

    func login(provider: String, token: String, nonce: String? = nil, force: Bool = false) async throws {
        isLoading = true
        error = nil

        do {
            let response: AuthResponse = try await APIClient.shared.request(
                .login(provider: provider, token: token, nonce: nonce, force: force)
            )

            setTokens(access: response.accessToken, refresh: response.refreshToken)

            if response.user.isNewUser {
                isNewUser = true
                isLoading = false
                return
            }

            // Fetch full user profile
            do {
                let profile: User = try await APIClient.shared.request(.getProfile)
                isNewUser = false
                isLoading = false
                // Profile is set on AppState by the caller
                NotificationCenter.default.post(
                    name: .authDidLogin,
                    object: nil,
                    userInfo: ["user": profile]
                )
            } catch let apiError as APIError {
                if case .banned(let reason) = apiError {
                    isLoading = false
                    throw AuthError.banned(reason: reason)
                }
                // Profile fetch failed but auth succeeded
                isLoading = false
                NotificationCenter.default.post(
                    name: .authDidLogin,
                    object: nil,
                    userInfo: [:]
                )
            }
        } catch let apiError as APIError {
            isLoading = false

            if case .conflict(let code, _) = apiError, code == "ALREADY_LOGGED_IN" {
                throw AuthError.alreadyLoggedIn(
                    retryWithForce: { [weak self] in
                        try await self?.login(provider: provider, token: token, nonce: nonce, force: true)
                    }
                )
            }

            error = apiError.localizedDescription
            throw apiError
        } catch let authError as AuthError {
            isLoading = false
            throw authError
        } catch {
            isLoading = false
            self.error = error.localizedDescription
            throw error
        }
    }

    // MARK: - Token Refresh

    func refreshAuth() async -> Bool {
        guard let refresh = refreshTokenValue else { return false }
        _ = refresh

        do {
            let response: RefreshResponse = try await APIClient.shared.request(
                .refreshToken(refreshToken: refresh)
            )
            setTokens(access: response.accessToken, refresh: response.refreshToken)
            return true
        } catch {
            // Only sign out on definitive 401
            if let apiError = error as? APIError, case .unauthorized = apiError {
                signOut()
            }
            return false
        }
    }

    // MARK: - Load Stored Auth (app launch)

    func loadStoredAuth() async -> User? {
        guard accessToken != nil, refreshTokenValue != nil else {
            return nil
        }

        isLoading = true

        do {
            let profile: User = try await APIClient.shared.request(.getProfile)
            isLoading = false

            // Check if onboarding was completed
            if profile.nickname.isEmpty {
                isNewUser = true
                return nil
            }

            return profile
        } catch let apiError as APIError {
            if case .banned(let reason) = apiError {
                isLoading = false
                error = "계정이 정지되었습니다: \(reason)"
                return nil
            }

            // Try refresh
            let refreshed = await refreshAuth()
            if refreshed {
                do {
                    let profile: User = try await APIClient.shared.request(.getProfile)
                    isLoading = false
                    if profile.nickname.isEmpty {
                        isNewUser = true
                        return nil
                    }
                    return profile
                } catch {
                    // Auth succeeded but profile failed -- still authenticated
                    isLoading = false
                    return nil
                }
            } else {
                isLoading = false
                return nil
            }
        } catch {
            isLoading = false
            return nil
        }
    }

    // MARK: - Sign Out

    func signOut() {
        // Fire-and-forget server logout
        Task {
            try? await APIClient.shared.requestVoid(.logout)
        }
        accessToken = nil
        refreshTokenValue = nil
        isNewUser = false
        error = nil
        currentNonce = nil
        deleteFromKeychain(account: "accessToken")
        deleteFromKeychain(account: "refreshToken")
    }

    // MARK: - Token Management

    func setTokens(access: String, refresh: String) {
        accessToken = access
        refreshTokenValue = refresh
        saveToKeychain(value: access, account: "accessToken")
        saveToKeychain(value: refresh, account: "refreshToken")
    }

    func clearError() {
        error = nil
    }

    // MARK: - Keychain (Security Framework)

    private func saveToKeychain(value: String, account: String) {
        guard let data = value.data(using: .utf8) else { return }

        deleteFromKeychain(account: account)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    private func loadFromKeychain(account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        return value
    }

    private func deleteFromKeychain(account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - Auth Errors

enum AuthError: Error, LocalizedError {
    case noIdentityToken
    case noNonce
    case googleNotReady
    case banned(reason: String)
    case alreadyLoggedIn(retryWithForce: () async throws -> Void)
    case cancelled
    case custom(String)

    var errorDescription: String? {
        switch self {
        case .noIdentityToken:
            return "Apple 인증 토큰을 받지 못했습니다."
        case .noNonce:
            return "인증 nonce가 없습니다."
        case .googleNotReady:
            return "Google 로그인 준비 중입니다."
        case .banned(let reason):
            return reason.isEmpty ? "계정이 정지되었습니다." : reason
        case .alreadyLoggedIn:
            return "다른 기기에서 이미 로그인 중입니다."
        case .cancelled:
            return "로그인이 취소되었습니다."
        case .custom(let message):
            return message
        }
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let authDidLogin = Notification.Name("authDidLogin")
    static let authDidLogout = Notification.Name("authDidLogout")
}
