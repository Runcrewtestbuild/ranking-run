import SwiftUI
import AuthenticationServices

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var isAppleLoading = false
    @State private var isGoogleLoading = false
    @State private var errorMessage: String?
    @State private var showError = false
    @State private var showForceLoginAlert = false
    @State private var forceLoginAction: (() async throws -> Void)?

    private var authManager: AuthManager { AuthManager.shared }
    private var isDisabled: Bool { isAppleLoading || isGoogleLoading }

    var body: some View {
        ZStack {
            RVColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Hero section
                Spacer()

                VStack(spacing: RVSpacing.lg) {
                    Text("RUNVS")
                        .font(.system(size: 64, weight: .black))
                        .foregroundStyle(RVColors.text)
                        .tracking(-2)
                        .lineSpacing(68 - 64)

                    Text("러닝 코스 공유 앱")
                        .font(.system(size: RVFontSize.lg, weight: .regular))
                        .foregroundStyle(RVColors.textTertiary)
                        .lineSpacing(26 - 17)
                        .padding(.top, RVSpacing.sm)

                    RoundedRectangle(cornerRadius: 2)
                        .fill(RVColors.primary)
                        .frame(width: 40, height: 4)
                        .padding(.top, RVSpacing.xs)
                }

                Spacer()

                // Button section
                VStack(spacing: RVSpacing.sm) {
                    // Apple Sign In
                    appleSignInButton

                    // Google Sign In
                    googleSignInButton

                    Text("로그인하면 이용약관 및 개인정보처리방침에 동의합니다.")
                        .font(.system(size: RVFontSize.xs))
                        .foregroundStyle(RVColors.textTertiary)
                        .multilineTextAlignment(.center)
                        .padding(.top, RVSpacing.xs)
                }
                .padding(.horizontal, RVSpacing.xxl)
                .padding(.bottom, RVSpacing.xxxl)
            }
        }
        .alert("오류", isPresented: $showError) {
            Button("확인", role: .cancel) { }
        } message: {
            Text(errorMessage ?? "알 수 없는 오류가 발생했습니다.")
        }
        .alert("로그인 확인", isPresented: $showForceLoginAlert) {
            Button("취소", role: .cancel) {
                forceLoginAction = nil
            }
            Button("로그인", role: .destructive) {
                Task {
                    do {
                        try await forceLoginAction?()
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                    forceLoginAction = nil
                }
            }
        } message: {
            Text("이 기기에서 로그인하시겠습니까? 기존 기기에서는 자동으로 로그아웃됩니다.")
        }
    }

    // MARK: - Apple Sign In Button

    private var appleSignInButton: some View {
        Button {
            handleAppleSignIn()
        } label: {
            HStack(spacing: RVSpacing.sm) {
                if isAppleLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Image(systemName: "apple.logo")
                        .font(.system(size: 20))
                    Text("Apple로 계속하기")
                        .font(.system(size: RVFontSize.md, weight: .bold))
                }
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.md + 2)
            .background(Color.black)
            .clipShape(Capsule())
            .shadow(color: Color(hex: "1C1917").opacity(0.03), radius: 4, y: 1)
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1.0)
    }

    // MARK: - Google Sign In Button

    private var googleSignInButton: some View {
        Button {
            handleGoogleSignIn()
        } label: {
            HStack(spacing: RVSpacing.sm) {
                if isGoogleLoading {
                    ProgressView()
                        .tint(Color(hex: "333333"))
                } else {
                    Text("G")
                        .font(.system(size: 20, weight: .bold))
                    Text("Google로 계속하기")
                        .font(.system(size: RVFontSize.md, weight: .bold))
                }
            }
            .foregroundStyle(Color(hex: "333333"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.md + 2)
            .background(Color.white)
            .clipShape(Capsule())
            .overlay(
                Capsule()
                    .stroke(Color(hex: "DDDDDD"), lineWidth: 1)
            )
            .shadow(color: Color(hex: "1C1917").opacity(0.03), radius: 4, y: 1)
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1.0)
    }

    // MARK: - Apple Sign In Flow

    private func handleAppleSignIn() {
        isAppleLoading = true
        let rawNonce = authManager.generateNonce()
        let hashedNonce = authManager.sha256(rawNonce)

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashedNonce

        let delegate = AppleSignInDelegate { result in
            Task { @MainActor in
                switch result {
                case .success(let credential):
                    do {
                        try await authManager.handleAppleSignIn(credential: credential)
                    } catch let authError as AuthError {
                        handleAuthError(authError)
                    } catch {
                        errorMessage = error.localizedDescription
                        showError = true
                    }
                case .failure(let error):
                    if (error as? ASAuthorizationError)?.code == .canceled {
                        // User cancelled -- do nothing
                    } else {
                        errorMessage = "Apple 로그인에 실패했습니다."
                        showError = true
                    }
                }
                isAppleLoading = false
            }
        }

        // Keep delegate alive by storing in the coordinator
        appleSignInDelegate = delegate

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = delegate
        controller.performRequests()
    }

    /// Stored to keep the delegate alive during the async Apple Sign In flow
    @State private var appleSignInDelegate: AppleSignInDelegate?

    // MARK: - Google Sign In Flow

    private func handleGoogleSignIn() {
        isGoogleLoading = true
        Task {
            do {
                try await AuthManager.shared.signInWithGoogle()
                // User is set via NotificationCenter → AppState.onReceive(.authDidLogin)
            } catch let authError as AuthError {
                handleAuthError(authError)
            } catch {
                errorMessage = error.localizedDescription
                showError = true
            }
            isGoogleLoading = false
        }
    }

    // MARK: - Error Handling

    private func handleAuthError(_ authError: AuthError) {
        switch authError {
        case .alreadyLoggedIn(let retryWithForce):
            forceLoginAction = retryWithForce
            showForceLoginAlert = true
        case .banned(let reason):
            errorMessage = reason.isEmpty ? "계정이 정지되었습니다." : reason
            showError = true
        case .cancelled:
            break
        default:
            errorMessage = authError.localizedDescription
            showError = true
        }
    }
}

// MARK: - Apple Sign In Delegate

/// ASAuthorizationControllerDelegate that bridges to a Swift closure
private class AppleSignInDelegate: NSObject, ASAuthorizationControllerDelegate {
    private let completion: (Result<ASAuthorizationAppleIDCredential, Error>) -> Void

    init(completion: @escaping (Result<ASAuthorizationAppleIDCredential, Error>) -> Void) {
        self.completion = completion
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            completion(.failure(AuthError.noIdentityToken))
            return
        }
        completion(.success(credential))
    }

    func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithError error: Error
    ) {
        completion(.failure(error))
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
