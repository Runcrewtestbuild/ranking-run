import SwiftUI

struct OnboardingView: View {
    @Environment(AppState.self) private var appState

    @State private var step: Int = 0 // 0=nickname, 1=country, 2=avatar
    @State private var nickname: String = ""
    @State private var selectedCountry: String? = nil
    @State private var showGreeting: Bool = false
    @State private var greetingOpacity: Double = 0

    private let totalSteps = 3

    private let countries: [(code: String, flag: String, name: String)] = [
        ("KR", "\u{1F1F0}\u{1F1F7}", "\u{B300}\u{D55C}\u{BBFC}\u{AD6D}"),
        ("JP", "\u{1F1EF}\u{1F1F5}", "\u{65E5}\u{672C}"),
        ("US", "\u{1F1FA}\u{1F1F8}", "United States"),
        ("CN", "\u{1F1E8}\u{1F1F3}", "\u{4E2D}\u{56FD}"),
        ("GB", "\u{1F1EC}\u{1F1E7}", "United Kingdom"),
        ("DE", "\u{1F1E9}\u{1F1EA}", "Deutschland"),
        ("FR", "\u{1F1EB}\u{1F1F7}", "France"),
        ("AU", "\u{1F1E6}\u{1F1FA}", "Australia"),
    ]

    private var isValidNickname: Bool {
        nickname.count >= 2 && nickname.count <= 12
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            if showGreeting {
                greetingOverlay
            } else {
                VStack(spacing: 0) {
                    // Progress bar + back button
                    progressHeader

                    // Step content
                    Group {
                        switch step {
                        case 0: nicknameStep
                        case 1: countryStep
                        case 2: avatarStep
                        default: EmptyView()
                        }
                    }
                    .transition(.opacity)
                    .animation(.easeInOut(duration: 0.2), value: step)
                }
                .safeAreaPadding(.top)
            }
        }
    }

    // MARK: - Progress Header

    // RN: progressRow paddingHorizontal 24, paddingTop 16, gap 12
    private var progressHeader: some View {
        HStack(spacing: RVSpacing.md) {
            if step > 0 {
                Button {
                    withAnimation { step -= 1 }
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(RVColors.text)
                        .frame(width: 44, height: 44)
                }
            }

            // Progress bar — RN: flex 1, height 4, borderRadius 2
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(RVColors.surface)
                        .frame(height: 4)
                    RoundedRectangle(cornerRadius: 2)
                        .fill(RVColors.primary)
                        .frame(width: geo.size.width * CGFloat(step + 1) / CGFloat(totalSteps), height: 4)
                        .animation(.easeInOut, value: step)
                }
            }
            .frame(height: 4)
        }
        .padding(.horizontal, RVSpacing.xxl)
        .padding(.top, RVSpacing.lg)
    }

    // MARK: - Step 1: Nickname

    // RN: stepTitle fontSize 28 (title), fontWeight 800, letterSpacing -0.5
    // RN: stepSubtitle fontSize 15, fontWeight 500, textSecondary
    private var nicknameStep: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: RVSpacing.sm) {
                Text("닉네임을 정해주세요")
                    .font(.system(size: RVFontSize.title, weight: .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(RVColors.text)
                Text("다른 러너들에게 보여질 이름이에요")
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.top, RVSpacing.xxxl)

            // Input field — RN: bg surface, borderRadius md (14), padding lg (16), fontSize 20 (xl)
            TextField("2~12자 닉네임", text: $nickname)
                .font(.system(size: RVFontSize.xl, weight: .semibold))
                .foregroundStyle(RVColors.text)
                .padding(RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .fill(RVColors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.md)
                                .stroke(
                                    isValidNickname ? RVColors.primary : RVColors.border,
                                    lineWidth: 1
                                )
                        )
                )
                .padding(.horizontal, RVSpacing.xxl)
                .padding(.top, RVSpacing.xxl)

            // Character count
            Text("\(nickname.count)/12")
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(isValidNickname ? RVColors.primary : RVColors.textTertiary)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, RVSpacing.xxl)
                .padding(.top, RVSpacing.xs)

            Spacer()

            // Next button
            nextButton(enabled: isValidNickname) {
                withAnimation { step = 1 }
            }
        }
    }

    // MARK: - Step 2: Country

    private var countryStep: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: RVSpacing.sm) {
                Text("국가를 선택해주세요")
                    .font(.system(size: RVFontSize.title, weight: .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(RVColors.text)
                Text("랭킹 필터에 사용됩니다")
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.top, RVSpacing.xxxl)

            // Country grid
            ScrollView(.vertical, showsIndicators: false) {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: RVSpacing.md) {
                    ForEach(countries, id: \.code) { country in
                        Button {
                            selectedCountry = country.code
                        } label: {
                            HStack(spacing: RVSpacing.sm) {
                                Text(country.flag)
                                    .font(.system(size: 24))
                                Text(country.name)
                                    .font(.system(size: RVFontSize.md, weight: .semibold))
                                    .foregroundStyle(
                                        selectedCountry == country.code ? .white : RVColors.text
                                    )
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, RVSpacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: RVRadius.md)
                                    .fill(
                                        selectedCountry == country.code
                                            ? RVColors.primary
                                            : RVColors.surface
                                    )
                                    .overlay(
                                        RoundedRectangle(cornerRadius: RVRadius.md)
                                            .stroke(
                                                selectedCountry == country.code
                                                    ? RVColors.primary
                                                    : RVColors.border,
                                                lineWidth: 1
                                            )
                                    )
                            )
                        }
                    }
                }
                .padding(.horizontal, RVSpacing.xxl)
                .padding(.top, RVSpacing.xxl)
            }

            // Next button
            nextButton(enabled: selectedCountry != nil) {
                withAnimation { step = 2 }
            }
        }
    }

    // MARK: - Step 3: Avatar

    private var avatarStep: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: RVSpacing.sm) {
                Text("프로필 사진을 설정하세요")
                    .font(.system(size: RVFontSize.title, weight: .heavy))
                    .tracking(-0.5)
                    .foregroundStyle(RVColors.text)
                Text("나중에 변경할 수 있어요")
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.top, RVSpacing.xxxl)

            Spacer()

            // Avatar placeholder — RN: 120x120, borderRadius 60
            Button { } label: {
                ZStack {
                    Circle()
                        .fill(RVColors.surface)
                        .frame(width: 120, height: 120)
                        .overlay(Circle().stroke(RVColors.border, lineWidth: 2))
                    VStack(spacing: 4) {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(RVColors.textTertiary)
                        Text("사진 추가")
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                }
            }

            // Skip text
            Button { } label: {
                Text("건너뛰기")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .padding(.top, RVSpacing.lg)

            Spacer()

            // Complete button
            Button {
                showGreeting = true
                withAnimation(.easeInOut(duration: 0.3)) {
                    greetingOpacity = 1
                }
                // After greeting, complete onboarding
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    appState.devSignIn(nickname: nickname)
                }
            } label: {
                Text("시작하기")
                    .font(.system(size: RVFontSize.md, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .fill(RVColors.primary)
                    )
            }
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.bottom, RVSpacing.xxxl)
        }
    }

    // MARK: - Greeting Overlay

    // RN: greetingContainer centered, greetingEmoji fontSize 64, greetingTitle fontSize 28
    private var greetingOverlay: some View {
        VStack(spacing: RVSpacing.xl) {
            Spacer()

            Text("\u{1F3C3}")
                .font(.system(size: 64))

            Text("\(nickname)님, 환영합니다!")
                .font(.system(size: RVFontSize.title, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(RVColors.text)

            Text("함께 달려볼까요?")
                .font(.system(size: RVFontSize.lg, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)

            Spacer()
        }
        .opacity(greetingOpacity)
    }

    // MARK: - Reusable Next Button

    private func nextButton(enabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("다음")
                .font(.system(size: RVFontSize.md, weight: .heavy))
                .foregroundStyle(enabled ? .white : RVColors.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(enabled ? RVColors.primary : RVColors.surface)
                )
        }
        .disabled(!enabled)
        .padding(.horizontal, RVSpacing.xxl)
        .padding(.bottom, RVSpacing.xxxl)
    }
}

#Preview {
    OnboardingView()
        .environment(AppState())
}
