import SwiftUI

struct CrewDetailView: View {
    @Environment(\.dismiss) private var dismiss

    // Mock data
    private let crew = Crew(
        id: "1",
        name: "서울 러너스",
        description: "서울에서 함께 달리는 모임입니다. 매주 수요일, 토요일 한강에서 정기 런닝을 진행합니다.",
        badgeColor: "FF7A33",
        memberCount: 128,
        maxMembers: 200,
        level: 5,
        region: "서울",
        requiresApproval: false,
        isMember: true
    )

    private let members: [User] = [
        User.mock(id: "1", nickname: "captain_kim", level: 12, totalDistanceMeters: 1250_000, totalRunCount: 320),
        User.mock(id: "2", nickname: "marathon_queen", level: 10, totalDistanceMeters: 980_000, totalRunCount: 245),
        User.mock(id: "3", nickname: "speed_king", level: 8, totalDistanceMeters: 750_000, totalRunCount: 180),
        User.mock(id: "4", nickname: "park_runner", level: 6, totalDistanceMeters: 420_000, totalRunCount: 110),
        User.mock(id: "5", nickname: "night_owl", level: 5, totalDistanceMeters: 320_000, totalRunCount: 85),
    ]

    private let weeklyRunners: [WeeklyRunner] = [
        WeeklyRunner(id: "1", rank: 1, nickname: "speed_king", runCount: 5, totalDistanceMeters: 38_500),
        WeeklyRunner(id: "2", rank: 2, nickname: "marathon_queen", runCount: 4, totalDistanceMeters: 32_100),
        WeeklyRunner(id: "3", rank: 3, nickname: "captain_kim", runCount: 3, totalDistanceMeters: 21_000),
    ]

    private let recentPosts: [Post] = [
        Post(id: "1", userId: "1", nickname: "captain_kim", content: "오늘 한강 런닝 모임 후기입니다! 날씨가 좋아서 다들 즐겁게 뛰었어요.", likeCount: 12, commentCount: 5, createdAt: .now),
        Post(id: "2", userId: "2", nickname: "marathon_queen", content: "다음 주 토요일 런닝 참석하실 분 댓글 남겨주세요~", likeCount: 8, commentCount: 15, createdAt: .now),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Cover
                        coverSection

                        // Info
                        infoSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Stats
                        statsRow
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Weekly ranking
                        weeklyRankingSection
                            .padding(.top, RVSpacing.xxl)

                        // Members
                        membersSection
                            .padding(.top, RVSpacing.xxl)

                        // Board / Recent Posts
                        boardSection
                            .padding(.top, RVSpacing.xxl)

                        Color.clear.frame(height: 100)
                    }
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

            Text("크루")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 20))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Cover

    private var coverSection: some View {
        ZStack {
            Color(hex: crew.badgeColor ?? "FF7A33")
            Image(systemName: "person.3.fill")
                .font(.system(size: 48))
                .foregroundStyle(.white.opacity(0.2))
        }
        .frame(height: 180)
    }

    // MARK: - Info

    private var infoSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            HStack(spacing: RVSpacing.sm) {
                Text("Lv.\(crew.level)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(RVColors.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(RVColors.primary.opacity(0.15))
                    .clipShape(RoundedRectangle(cornerRadius: 4))

                Text(crew.name)
                    .font(.system(size: RVFontSize.xxl, weight: .heavy))
                    .foregroundStyle(RVColors.text)

                if let region = crew.region {
                    Text(region)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }
            }

            if let desc = crew.description {
                Text(desc)
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
                    .lineSpacing(4)
            }

            HStack(spacing: RVSpacing.md) {
                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 14))
                        .foregroundStyle(RVColors.textTertiary)
                    Text("\(crew.memberCount)\(crew.maxMembers.map { "/\($0)" } ?? "")")
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }

                HStack(spacing: 4) {
                    Image(systemName: crew.requiresApproval ? "shield.checkmark" : "arrow.right.circle")
                        .font(.system(size: 13))
                        .foregroundStyle(RVColors.textTertiary)
                    Text(crew.requiresApproval ? "승인 필요" : "자유 가입")
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
            }

            if crew.isMember {
                HStack(spacing: 4) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 14))
                    Text("가입됨")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                }
                .foregroundStyle(RVColors.primary)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.sm)
                .background(RVColors.primary.opacity(0.12))
                .clipShape(Capsule())
            }
        }
    }

    // MARK: - Stats

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(value: "\(crew.memberCount)", label: "멤버")
            statDivider
            statItem(value: "Lv.\(crew.level)", label: "레벨")
            statDivider
            statItem(value: RunFormatters.formatDistanceWithUnit(meters: 42_195), label: "이번 주 거리")
        }
        .padding(.vertical, RVSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: RVSpacing.xs) {
            Text(value)
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .foregroundStyle(RVColors.text)
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(RVColors.divider)
            .frame(width: 1, height: 28)
    }

    // MARK: - Weekly Ranking

    private var weeklyRankingSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionHeader(title: "주간 랭킹", icon: "trophy.fill", iconColor: RVColors.gold)

            VStack(spacing: RVSpacing.sm) {
                ForEach(weeklyRunners) { runner in
                    weeklyRankRow(runner)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    private func weeklyRankRow(_ runner: WeeklyRunner) -> some View {
        let medalColors: [Color] = [RVColors.gold, Color(hex: "9CA3AF"), Color(hex: "CD7F32")]
        let isMedal = runner.rank <= 3

        return HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(isMedal ? medalColors[runner.rank - 1] : RVColors.surface)
                    .frame(width: 24, height: 24)
                Text("\(runner.rank)")
                    .font(.system(size: RVFontSize.xs, weight: .heavy))
                    .foregroundStyle(isMedal ? .white : RVColors.textSecondary)
            }

            ZStack {
                Circle()
                    .fill(RVColors.surface)
                    .frame(width: 32, height: 32)
                Image(systemName: "person.fill")
                    .font(.system(size: 14))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Text(runner.nickname)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)
                .lineLimit(1)

            Spacer()

            Text(RunFormatters.formatDistanceWithUnit(meters: runner.totalDistanceMeters))
                .font(.system(size: RVFontSize.sm, weight: .heavy))
                .foregroundStyle(RVColors.primary)
                .monospacedDigit()
        }
        .padding(.horizontal, RVSpacing.md)
        .padding(.vertical, RVSpacing.sm + 2)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Members

    private var membersSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionHeader(title: "멤버", icon: "person.2.fill", iconColor: RVColors.primary, count: crew.memberCount)

            VStack(spacing: RVSpacing.sm) {
                ForEach(members) { user in
                    memberRow(user)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    private func memberRow(_ user: User) -> some View {
        HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(RVColors.surface)
                    .frame(width: 40, height: 40)
                Image(systemName: "person.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(RVColors.textTertiary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(user.nickname)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)
                Text("Lv.\(user.level)")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()

            Text(RunFormatters.formatDistanceWithUnit(meters: user.totalDistanceMeters))
                .font(.system(size: RVFontSize.sm, weight: .semibold))
                .foregroundStyle(RVColors.textSecondary)
                .monospacedDigit()
        }
        .padding(.horizontal, RVSpacing.md)
        .padding(.vertical, RVSpacing.sm + 2)
    }

    // MARK: - Board

    private var boardSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            sectionHeader(title: "게시판", icon: "text.bubble.fill", iconColor: Color(hex: "3B82F6"))

            VStack(spacing: RVSpacing.sm) {
                ForEach(recentPosts) { post in
                    boardPostRow(post)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    private func boardPostRow(_ post: Post) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            HStack(spacing: RVSpacing.sm) {
                ZStack {
                    Circle()
                        .fill(RVColors.surface)
                        .frame(width: 28, height: 28)
                    Image(systemName: "person.fill")
                        .font(.system(size: 12))
                        .foregroundStyle(RVColors.textTertiary)
                }

                Text(post.nickname)
                    .font(.system(size: RVFontSize.sm, weight: .bold))
                    .foregroundStyle(RVColors.text)

                Spacer()

                Text("방금")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Text(post.content)
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
                .lineLimit(2)

            HStack(spacing: RVSpacing.lg) {
                HStack(spacing: 4) {
                    Image(systemName: "heart")
                        .font(.system(size: 13))
                    Text("\(post.likeCount)")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                }
                .foregroundStyle(RVColors.textTertiary)

                HStack(spacing: 4) {
                    Image(systemName: "bubble.right")
                        .font(.system(size: 13))
                    Text("\(post.commentCount)")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                }
                .foregroundStyle(RVColors.textTertiary)
            }
        }
        .padding(RVSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Section Header

    private func sectionHeader(title: String, icon: String, iconColor: Color, count: Int? = nil) -> some View {
        HStack(spacing: RVSpacing.sm) {
            ZStack {
                Circle()
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 26, height: 26)
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(iconColor)
            }

            Text(title)
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .tracking(-0.3)
                .foregroundStyle(RVColors.text)

            if let count {
                Text("\(count)")
                    .font(.system(size: RVFontSize.sm, weight: .bold))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()

            Button { } label: {
                HStack(spacing: 2) {
                    Text("더 보기")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13))
                }
                .foregroundStyle(RVColors.textTertiary)
            }
        }
        .padding(.horizontal, RVSpacing.xxl)
    }
}

#Preview {
    CrewDetailView()
}
