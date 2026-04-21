import SwiftUI

struct CommunityFeedView: View {
    @State private var activeTab: CommunityTab = .ranking

    enum CommunityTab: String, CaseIterable {
        case ranking = "주간 랭킹"
        case explore = "크루 탐색"
        case friends = "친구"
    }

    // Mock data
    private let crews: [Crew] = [
        Crew(id: "1", name: "서울 러너스", description: "서울에서 함께 달리는 모임", memberCount: 128, level: 5, region: "서울", requiresApproval: false),
        Crew(id: "2", name: "한강 크루", description: "한강 코스 전문 크루", badgeColor: "10B981", memberCount: 56, level: 3, region: "서울", requiresApproval: true),
        Crew(id: "3", name: "새벽 러닝 클럽", description: "새벽 5시 기상 러닝", badgeColor: "8B5CF6", memberCount: 34, level: 2, region: "경기"),
    ]

    private let weeklyRunners: [WeeklyRunner] = [
        WeeklyRunner(id: "1", rank: 1, nickname: "speed_king", runCount: 7, totalDistanceMeters: 52_300),
        WeeklyRunner(id: "2", rank: 2, nickname: "marathon_queen", runCount: 5, totalDistanceMeters: 48_100),
        WeeklyRunner(id: "3", rank: 3, nickname: "park_runner", runCount: 6, totalDistanceMeters: 42_500),
        WeeklyRunner(id: "4", rank: 4, nickname: "night_owl", runCount: 4, totalDistanceMeters: 35_200),
        WeeklyRunner(id: "5", rank: 5, nickname: "morning_bird", runCount: 5, totalDistanceMeters: 31_800),
    ]

    var body: some View {
        ZStack {
            RVColors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header — RN: paddingHorizontal 20 (xl), paddingVertical 12 (md)
                header
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.vertical, RVSpacing.md)

                // Segmented control — RN: marginHorizontal 20 (xl), marginBottom 12 (md)
                segmentedControl
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.bottom, RVSpacing.md)

                // Tab content
                ScrollView(.vertical, showsIndicators: false) {
                    switch activeTab {
                    case .explore:
                        exploreContent
                    case .friends:
                        friendsContent
                    case .ranking:
                        rankingContent
                    }

                    // Bottom padding for tab bar
                    Color.clear.frame(height: 100)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    // RN: headerTitle fontSize 24 (xxl), fontWeight 800, letterSpacing -0.5
    // RN: headerActions gap xs (4), headerBtn 44x44 borderRadius 22, bg surface
    private var header: some View {
        HStack {
            Text("소셜")
                .font(.system(size: RVFontSize.xxl, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(RVColors.text)

            Spacer()

            HStack(spacing: RVSpacing.xs) {
                Button { } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 20))
                        .foregroundStyle(RVColors.text)
                        .frame(width: 44, height: 44)
                        .background(RVColors.surface)
                        .clipShape(Circle())
                }

                Button { } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 22))
                        .foregroundStyle(RVColors.text)
                        .frame(width: 44, height: 44)
                        .background(RVColors.surface)
                        .clipShape(Circle())
                }
            }
        }
    }

    // MARK: - Segmented Control

    // RN: tabBar bg surface, borderRadius md (14), padding 3
    // RN: tab active bg card, shadow, borderRadius md-2 (12)
    // RN: tabText fontSize 13 (sm), fontWeight 600 (inactive) / 700 (active)
    private var segmentedControl: some View {
        HStack(spacing: 0) {
            ForEach(CommunityTab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        activeTab = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(.system(size: RVFontSize.sm, weight: activeTab == tab ? .bold : .semibold))
                        .foregroundStyle(activeTab == tab ? RVColors.text : RVColors.textTertiary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RVSpacing.sm + 2) // 10
                        .background(
                            activeTab == tab
                                ? RVColors.card
                                : Color.clear
                        )
                        .clipShape(RoundedRectangle(cornerRadius: RVRadius.md - 2)) // 12
                        .shadow(color: activeTab == tab ? .black.opacity(0.08) : .clear, radius: 2, y: 1)
                }
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md) // 14
                .fill(RVColors.surface)
        )
    }

    // MARK: - Explore Content (Crew Cards)

    // RN: listContent paddingHorizontal 20 (xl), paddingBottom xxxl+xl
    private var exploreContent: some View {
        VStack(spacing: RVSpacing.md) {
            ForEach(crews) { crew in
                crewCard(crew)
            }
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.top, RVSpacing.lg)
    }

    // RN: exploreCard bg card, borderRadius lg (18), border 1, overflow hidden
    // RN: exploreCover height 100
    // RN: exploreInfo padding lg (16), paddingTop sm (8), gap 6
    // RN: exploreName fontSize md (15), fontWeight 800
    // RN: exploreDesc fontSize sm (13), fontWeight 500, lineHeight 18
    // RN: exploreStatText fontSize xs (11), fontWeight 500, textTertiary
    private func crewCard(_ crew: Crew) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Cover area — RN: height 100
            ZStack {
                RoundedRectangle(cornerRadius: 0)
                    .fill(Color(hex: crew.badgeColor ?? "FF7A33"))
                    .frame(height: 100)
                Image(systemName: crew.badgeIcon ?? "person.3.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(.white.opacity(0.3))
            }

            // Info
            VStack(alignment: .leading, spacing: 6) {
                // Name row
                HStack(spacing: RVSpacing.sm) {
                    Text("Lv.\(crew.level)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                    Text(crew.name)
                        .font(.system(size: RVFontSize.md, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)

                    if let region = crew.region {
                        Text(region)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(RVColors.primary)
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(RVColors.primary.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }

                if let desc = crew.description {
                    Text(desc)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                        .lineSpacing(18 - 13)
                        .lineLimit(2)
                }

                // Bottom row: stats + join button
                HStack {
                    HStack(spacing: 4) {
                        Image(systemName: "person.2")
                            .font(.system(size: 13))
                            .foregroundStyle(RVColors.textTertiary)
                        Text("\(crew.memberCount)\(crew.maxMembers.map { "/\($0)" } ?? "")")
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                        Text("\u{00B7}")
                            .foregroundStyle(RVColors.textTertiary)
                        Image(systemName: crew.requiresApproval ? "shield.checkmark" : "arrow.right.circle")
                            .font(.system(size: 12))
                            .foregroundStyle(RVColors.textTertiary)
                        Text(crew.requiresApproval ? "승인 필요" : "자유 가입")
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                    }

                    Spacer()

                    if crew.isMember {
                        HStack(spacing: 3) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(RVColors.primary)
                            Text("가입됨")
                                .font(.system(size: RVFontSize.xs, weight: .bold))
                                .foregroundStyle(RVColors.primary)
                        }
                        .padding(.horizontal, RVSpacing.md)
                        .padding(.vertical, RVSpacing.xs + 1) // 5
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(Capsule())
                    } else {
                        Text("가입")
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, RVSpacing.md)
                            .padding(.vertical, RVSpacing.xs + 1) // 5
                            .background(RVColors.primary)
                            .clipShape(Capsule())
                    }
                }
            }
            .padding(RVSpacing.lg) // 16
            .padding(.top, RVSpacing.sm - RVSpacing.lg) // offset to ~8
        }
        .background(RVColors.card)
        .clipShape(RoundedRectangle(cornerRadius: RVRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .stroke(RVColors.border, lineWidth: 1)
        )
    }

    // MARK: - Friends Content

    private var friendsContent: some View {
        VStack(spacing: RVSpacing.sm) {
            Spacer().frame(height: RVSpacing.xxxl * 2)
            Image(systemName: "person.2.circle")
                .font(.system(size: 36))
                .foregroundStyle(RVColors.textTertiary)
            Text("친구를 추가해보세요")
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)
                .padding(.top, RVSpacing.sm)

            Button { } label: {
                HStack(spacing: 6) {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 16))
                    Text("친구 찾기")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                }
                .foregroundStyle(.white)
                .padding(.vertical, RVSpacing.sm + 2)
                .padding(.horizontal, RVSpacing.xl)
                .background(RVColors.primary)
                .clipShape(Capsule())
            }
            .padding(.top, RVSpacing.md)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Ranking Content

    // RN: listContent paddingHorizontal 20 (xl), paddingBottom xxxl+xl
    // RN: rrRow bg card, borderRadius lg (18), border 1, padding md (12), marginBottom sm (8), gap md (12)
    private var rankingContent: some View {
        VStack(spacing: RVSpacing.sm) {
            ForEach(weeklyRunners) { runner in
                rankingRow(runner)
            }
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.top, RVSpacing.lg)
    }

    // RN: rrRankBadge 28x28 borderRadius 14, rrRankText fontSize xs (11), fontWeight 800
    // RN: rrAvatar 36x36 borderRadius 18
    // RN: rrName fontSize md (15), fontWeight 700
    // RN: rrCrew fontSize xs (11), fontWeight 500, textTertiary
    // RN: rrDistance fontSize md (15), fontWeight 800, color primary
    // RN: rrMeta fontSize xs (11), fontWeight 500, textTertiary
    private func rankingRow(_ runner: WeeklyRunner) -> some View {
        let medalColors: [Color] = [Color(hex: "FFD700"), Color(hex: "9CA3AF"), Color(hex: "CD7F32")]
        let isMedal = runner.rank <= 3

        return HStack(spacing: RVSpacing.md) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(isMedal ? medalColors[runner.rank - 1] : RVColors.surface)
                    .frame(width: 28, height: 28)
                Text("\(runner.rank)")
                    .font(.system(size: RVFontSize.xs, weight: .heavy))
                    .foregroundStyle(isMedal ? .white : RVColors.textSecondary)
            }

            // Avatar
            ZStack {
                Circle()
                    .fill(RVColors.surface)
                    .frame(width: 36, height: 36)
                Image(systemName: "person.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(RVColors.textTertiary)
            }

            // Name
            VStack(alignment: .leading, spacing: 1) {
                Text(runner.nickname)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)
                if let crew = runner.crewName {
                    Text(crew)
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Stats
            VStack(alignment: .trailing, spacing: 1) {
                Text("\(runner.runCount)회")
                    .font(.system(size: RVFontSize.md, weight: .heavy))
                    .foregroundStyle(RVColors.primary)
                Text(RunFormatters.formatDistanceWithUnit(meters: runner.totalDistanceMeters))
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
        }
        .padding(RVSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }
}

#Preview {
    CommunityFeedView()
}
