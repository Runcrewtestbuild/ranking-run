import SwiftUI

struct ProfileView: View {
    @Environment(AppState.self) private var appState

    // Mock stats
    private let followers = 24
    private let following = 18
    private let likes = 156

    // Runner level
    private let runnerLevel = 8
    private let xpProgress: Double = 0.65 // 65%
    private let xpLabel = "123.5 / 200km"

    private let menuItems: [(icon: String, iconBg: Color, title: String)] = [
        ("clock.arrow.circlepath", Color(hex: "FF7A33"), "러닝 기록"),
        ("shoe.2", Color(hex: "8B5CF6"), "장비 관리"),
        ("arrow.down.circle", Color(hex: "10B981"), "활동 가져오기"),
        ("person.2", Color(hex: "3B82F6"), "친구 찾기"),
        ("star", Color(hex: "FFD700"), "포인트 내역"),
        ("doc.text", Color(hex: "6B7280"), "이용약관"),
        ("lock.shield", Color(hex: "6B7280"), "개인정보처리방침"),
    ]

    var body: some View {
        ZStack {
            RVColors.background
                .ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header — RN: paddingHorizontal 24, paddingVertical 8
                    header
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.vertical, RVSpacing.sm)

                    // Player Card (Avatar + Stats) — flat layout, no card
                    playerCard

                    // Runner Level Banner — RN: marginHorizontal 24
                    runnerBanner
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.md)

                    // Activity Dashboard — RN: marginHorizontal 24
                    activityDashboard
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xl)

                    // Menu Items
                    menuSection
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xl)

                    // Sign Out
                    signOutButton
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xl)

                    // Bottom padding for tab bar
                    Color.clear.frame(height: 100)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header
    // RN: headerUsername fontSize 22, fontWeight 700; settings icon size 24

    private var header: some View {
        HStack {
            Text(appState.currentUser?.nickname ?? "RUNVS")
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(RVColors.text)
                .lineLimit(1)

            Spacer()

            Button { } label: {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(RVColors.text)
            }
        }
    }

    // MARK: - Player Card
    // RN: flat layout (no card bg). Top row: avatar 86x86 + stats row with gap 28.
    // Meta: paddingHorizontal 24, gap 4.
    // Edit button: marginHorizontal 24, height 34, bg surfaceLight, borderRadius 8

    private var playerCard: some View {
        VStack(spacing: 0) {
            // Top row: Avatar + Stats — RN: paddingHorizontal 24, paddingTop 4, paddingBottom 12, gap 28
            HStack(spacing: 28) {
                // Avatar — RN: 86x86, borderRadius 43
                ZStack {
                    Circle()
                        .fill(RVColors.surfaceLight)
                        .frame(width: 86, height: 86)
                        .overlay(
                            Circle().stroke(RVColors.border, lineWidth: 1)
                        )
                    Image(systemName: "person.fill")
                        .font(.system(size: 24))
                        .foregroundStyle(RVColors.textTertiary)
                }

                // Stats row — RN: flex 1, space-around
                HStack(spacing: 0) {
                    statColumn(value: "\(followers)", label: "팔로워")
                    statColumn(value: "\(following)", label: "팔로잉")
                    statColumn(value: "\(likes)", label: "좋아요")
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.top, 4)
            .padding(.bottom, 12)

            // Name + bio — RN: paddingHorizontal 24, gap 4
            VStack(alignment: .leading, spacing: 4) {
                // RN: nameRow gap 6
                HStack(spacing: 6) {
                    // RN: playerCardName fontSize 17, fontWeight 700, letterSpacing -0.3
                    Text(appState.currentUser?.nickname ?? "Runner")
                        .font(.system(size: RVFontSize.lg, weight: .bold))
                        .tracking(-0.3)
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)

                    Text("Lv.\(runnerLevel)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                if let bio = appState.currentUser?.bio {
                    // RN: fontSize 14, color text, lineHeight 20
                    Text(bio)
                        .font(.system(size: 14))
                        .foregroundStyle(RVColors.text)
                        .lineSpacing(20 - 14)
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, RVSpacing.xxl)

            // Edit Profile button — RN: height 34, bg surfaceLight, borderRadius 8, marginTop 12
            Button { } label: {
                Text("프로필 편집")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                    .frame(maxWidth: .infinity)
                    .frame(height: 34)
                    .background(RVColors.surfaceLight)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.top, 12)
            .padding(.bottom, 4)
        }
    }

    // RN: profileStatValue fontSize 17, fontWeight 700; profileStatLabel fontSize 13, fontWeight 400
    private func statColumn(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)
            Text(label)
                .font(.system(size: RVFontSize.sm, weight: .regular))
                .foregroundStyle(RVColors.textSecondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Runner Level Banner
    // RN: paddingHorizontal 14, paddingVertical 12, borderRadius 10, borderWidth 1

    private var runnerBanner: some View {
        VStack(spacing: 4) {
            HStack(spacing: 6) {
                // RN: runnerBannerTitle fontSize 14, fontWeight 800
                Text("스프린터")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(RVColors.primary)
                // RN: runnerBannerLv fontSize 12, fontWeight 900
                Text("Lv.\(runnerLevel)")
                    .font(.system(size: 12, weight: .black))
                    .foregroundStyle(RVColors.primary)
                Spacer()
            }

            // XP Bar — RN: track height 6, borderRadius 3
            VStack(spacing: 4) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(RVColors.primary.opacity(0.3))
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(RVColors.primary)
                            .frame(width: geometry.size.width * xpProgress, height: 6)
                    }
                }
                .frame(height: 6)

                HStack {
                    Spacer()
                    // RN: xpBarLabel fontSize 11, fontWeight 700
                    Text(xpLabel)
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }
            .padding(.top, 2)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.sm) // 10
                .fill(RVColors.primary.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .stroke(RVColors.primary.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Activity Dashboard

    // RN: heroCard marginHorizontal 24, bg card, borderRadius lg (18), padding xl (20), gap lg (16), border 1
    // RN: heroDistance fontSize 48, fontWeight 900, letterSpacing -2
    // RN: heroUnit fontSize lg (17), fontWeight 700, color textTertiary
    // RN: heroSecondaryValue fontSize lg (17), fontWeight 800
    // RN: heroSecondaryLabel fontSize xs (11), fontWeight 500, textTertiary
    // RN: heroSecondaryDivider width 1, height 24, bg divider
    private var activityDashboard: some View {
        VStack(spacing: RVSpacing.lg) {
            // Hero distance
            VStack(spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(RunFormatters.metersToKm(appState.currentUser?.totalDistanceMeters ?? 0, decimals: 1))
                        .font(.system(size: 48, weight: .black))
                        .tracking(-2)
                        .foregroundStyle(RVColors.text)
                    Text("km")
                        .font(.system(size: RVFontSize.lg, weight: .bold))
                        .foregroundStyle(RVColors.textTertiary)
                }
            }
            .frame(maxWidth: .infinity)

            // Secondary stats
            HStack(spacing: 0) {
                VStack(spacing: 2) {
                    Text("\(appState.currentUser?.totalRunCount ?? 0)")
                        .font(.system(size: RVFontSize.lg, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                    Text("횟수")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
                .frame(maxWidth: .infinity)

                Rectangle()
                    .fill(RVColors.divider)
                    .frame(width: 1, height: 24)

                VStack(spacing: 2) {
                    Text("--:--")
                        .font(.system(size: RVFontSize.lg, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                    Text("시간")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
                .frame(maxWidth: .infinity)

                Rectangle()
                    .fill(RVColors.divider)
                    .frame(width: 1, height: 24)

                VStack(spacing: 2) {
                    Text("0")
                        .font(.system(size: RVFontSize.lg, weight: .heavy))
                        .foregroundStyle(RVColors.primary)
                    Text("P")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.primary)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(RVSpacing.xl)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Menu Section

    private var menuSection: some View {
        VStack(spacing: 2) {
            ForEach(menuItems, id: \.title) { item in
                Button { } label: {
                    HStack(spacing: RVSpacing.md) {
                        ZStack {
                            Circle()
                                .fill(item.iconBg.opacity(0.15))
                                .frame(width: 36, height: 36)
                            Image(systemName: item.icon)
                                .font(.system(size: 16))
                                .foregroundStyle(item.iconBg)
                        }

                        Text(item.title)
                            .font(.system(size: RVFontSize.md, weight: .medium))
                            .foregroundStyle(RVColors.text)

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.md)
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Sign Out

    private var signOutButton: some View {
        Button {
            appState.signOut()
        } label: {
            Text("로그아웃")
                .font(.system(size: RVFontSize.md, weight: .medium))
                .foregroundStyle(RVColors.error)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .fill(RVColors.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.md)
                                .stroke(RVColors.border, lineWidth: 1)
                        )
                )
        }
    }
}

#Preview {
    ProfileView()
        .environment(AppState())
}
