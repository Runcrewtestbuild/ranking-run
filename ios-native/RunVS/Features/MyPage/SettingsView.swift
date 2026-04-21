import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss

    // Settings state (mock - will be replaced by SettingsStore)
    @State private var selectedLanguage: String = "ko"
    @State private var voiceGuidance: Bool = true
    @State private var map3DStyle: Bool = false
    @State private var themeMode: String = "dark"

    private let languages: [(key: String, label: String)] = [
        ("ko", "\u{D55C}\u{AD6D}\u{C5B4}"),
        ("en", "English"),
        ("ja", "\u{65E5}\u{672C}\u{8A9E}"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xl) {
                        // Language
                        languageSection

                        // App Settings
                        appSettingsSection

                        // Legal
                        legalSection

                        // Account
                        accountSection

                        // App Info
                        appInfoSection
                    }
                    .padding(.bottom, RVSpacing.xxxl + RVSpacing.xl)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    private var screenHeader: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }

            Spacer()

            Text("설정")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Language Section

    // RN: sectionTitle fontSize sm (13), fontWeight 700, textTertiary, uppercase, letterSpacing 0.8
    // RN: card bg card, borderRadius lg (18), border 1
    private var languageSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionTitle("언어")

            VStack(spacing: 0) {
                ForEach(Array(languages.enumerated()), id: \.offset) { index, lang in
                    if index > 0 {
                        Rectangle()
                            .fill(RVColors.divider)
                            .frame(height: 1)
                            .padding(.horizontal, RVSpacing.xl)
                    }

                    Button {
                        selectedLanguage = lang.key
                    } label: {
                        HStack {
                            Text(lang.label)
                                .font(.system(size: RVFontSize.md, weight: selectedLanguage == lang.key ? .bold : .regular))
                                .foregroundStyle(selectedLanguage == lang.key ? RVColors.primary : RVColors.text)

                            Spacer()

                            if selectedLanguage == lang.key {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(RVColors.primary)
                            }
                        }
                        .padding(.horizontal, RVSpacing.xl)
                        .padding(.vertical, RVSpacing.lg)
                    }
                }
            }
            .background(settingsCard)
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // MARK: - App Settings Section

    private var appSettingsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionTitle("앱 설정")

            VStack(spacing: 0) {
                // Theme
                VStack(spacing: 0) {
                    settingsRow(
                        icon: "moon",
                        iconColor: RVColors.primary,
                        title: "테마",
                        subtitle: themeMode == "dark" ? "다크 모드" : themeMode == "light" ? "라이트 모드" : "시스템 설정"
                    )

                    // Segment control
                    HStack(spacing: 0) {
                        ForEach(["auto", "light", "dark"], id: \.self) { mode in
                            Button {
                                themeMode = mode
                            } label: {
                                Text(mode == "auto" ? "자동" : mode == "light" ? "라이트" : "다크")
                                    .font(.system(size: RVFontSize.sm, weight: themeMode == mode ? .bold : .semibold))
                                    .foregroundStyle(themeMode == mode ? .white : RVColors.textSecondary)
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, RVSpacing.sm)
                                    .background(
                                        themeMode == mode
                                            ? RVColors.primary
                                            : Color.clear
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: RVRadius.md - 2))
                            }
                        }
                    }
                    .padding(3)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.md)
                            .fill(RVColors.surfaceLight)
                    )
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.bottom, RVSpacing.lg)
                }

                settingsDivider

                // Voice guidance toggle
                toggleRow(
                    icon: "speaker.wave.2",
                    iconColor: RVColors.primary,
                    title: "음성 안내",
                    subtitle: voiceGuidance ? "코스 방향 안내 활성화" : "음성 안내 꺼짐",
                    isOn: $voiceGuidance
                )

                settingsDivider

                // 3D Map toggle
                toggleRow(
                    icon: "map",
                    iconColor: RVColors.primary,
                    title: "3D 지도",
                    subtitle: map3DStyle ? "3D 건물 표시" : "2D 플랫 뷰",
                    isOn: $map3DStyle
                )
            }
            .background(settingsCard)
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // MARK: - Legal Section

    private var legalSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionTitle("법적 고지")

            VStack(spacing: 0) {
                navigationRow(
                    icon: "doc.text",
                    iconColor: RVColors.primary,
                    title: "이용약관"
                )

                settingsDivider

                navigationRow(
                    icon: "shield.checkmark",
                    iconColor: RVColors.primary,
                    title: "개인정보처리방침"
                )
            }
            .background(settingsCard)
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // MARK: - Account Section

    private var accountSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionTitle("계정")

            VStack(spacing: 0) {
                // Logout
                Button {
                    appState.signOut()
                } label: {
                    HStack(spacing: RVSpacing.lg) {
                        iconCircle(icon: "rectangle.portrait.and.arrow.right", color: RVColors.textSecondary)
                        Text("로그아웃")
                            .font(.system(size: RVFontSize.md, weight: .medium))
                            .foregroundStyle(RVColors.text)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.vertical, RVSpacing.lg)
                }

                settingsDivider

                // Delete account
                Button { } label: {
                    HStack(spacing: RVSpacing.lg) {
                        iconCircle(icon: "person.badge.minus", color: RVColors.error, bgColor: RVColors.error.opacity(0.15))
                        Text("회원 탈퇴")
                            .font(.system(size: RVFontSize.md, weight: .medium))
                            .foregroundStyle(RVColors.error)
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.vertical, RVSpacing.lg)
                }
            }
            .background(settingsCard)
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // MARK: - App Info

    private var appInfoSection: some View {
        Text("RUNVS v1.0.0")
            .font(.system(size: RVFontSize.sm, weight: .medium))
            .foregroundStyle(RVColors.textTertiary)
            .frame(maxWidth: .infinity)
            .padding(.top, RVSpacing.lg)
    }

    // MARK: - Reusable Components

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: RVFontSize.sm, weight: .bold))
            .foregroundStyle(RVColors.textTertiary)
            .tracking(0.8)
            .textCase(.uppercase)
            .padding(.leading, RVSpacing.xs)
    }

    private var settingsCard: some View {
        RoundedRectangle(cornerRadius: RVRadius.lg)
            .fill(RVColors.card)
            .overlay(
                RoundedRectangle(cornerRadius: RVRadius.lg)
                    .stroke(RVColors.border, lineWidth: 1)
            )
    }

    private var settingsDivider: some View {
        Rectangle()
            .fill(RVColors.divider)
            .frame(height: 1)
            .padding(.horizontal, RVSpacing.xl)
    }

    // RN: iconCircle 36x36, borderRadius 18, bg surfaceLight
    private func iconCircle(icon: String, color: Color, bgColor: Color = RVColors.surfaceLight) -> some View {
        ZStack {
            Circle()
                .fill(bgColor)
                .frame(width: 36, height: 36)
            Image(systemName: icon)
                .font(.system(size: 18))
                .foregroundStyle(color)
        }
    }

    // RN: toggleRow flexDirection row, padding lg (16), paddingHorizontal xl (20)
    private func settingsRow(icon: String, iconColor: Color, title: String, subtitle: String) -> some View {
        HStack(spacing: RVSpacing.lg) {
            iconCircle(icon: icon, color: iconColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text(subtitle)
                    .font(.system(size: RVFontSize.sm))
                    .foregroundStyle(RVColors.textTertiary)
            }
            Spacer()
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.top, RVSpacing.lg)
    }

    private func toggleRow(icon: String, iconColor: Color, title: String, subtitle: String, isOn: Binding<Bool>) -> some View {
        HStack(spacing: RVSpacing.lg) {
            iconCircle(icon: icon, color: iconColor)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text(subtitle)
                    .font(.system(size: RVFontSize.sm))
                    .foregroundStyle(RVColors.textTertiary)
            }
            Spacer()
            Toggle("", isOn: isOn)
                .tint(RVColors.primary)
                .labelsHidden()
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.vertical, RVSpacing.lg)
    }

    private func navigationRow(icon: String, iconColor: Color, title: String) -> some View {
        Button { } label: {
            HStack(spacing: RVSpacing.lg) {
                iconCircle(icon: icon, color: iconColor)
                Text(title)
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 14))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .padding(.horizontal, RVSpacing.xl)
            .padding(.vertical, RVSpacing.lg)
        }
    }
}

#Preview {
    SettingsView()
        .environment(AppState())
}
