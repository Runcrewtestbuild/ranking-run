import SwiftUI

struct UserProfileView: View {
    let userId: String

    init(userId: String = "mock-user-1") {
        self.userId = userId
    }

    @Environment(\.dismiss) private var dismiss
    @State private var isFollowing: Bool = false
    @State private var followersCount: Int = 156

    // Mock profile
    private let profile = ProfileData(
        nickname: "speed_king",
        bio: "5km PB 21:30 | 한강 러너 | 서울 서초구",
        level: 12,
        totalDistanceMeters: 1_234_500,
        totalRuns: 245,
        followingCount: 48,
        likesReceived: 1_280,
        crewName: "서울 러너스",
        country: "KR"
    )

    private let recentCourses: [(id: String, title: String, distance: String, runs: Int)] = [
        ("c1", "한강 반포 코스", "5.12 km", 1284),
        ("c2", "올림픽공원 순환", "3.80 km", 856),
        ("c3", "남산 둘레길", "7.23 km", 432),
    ]

    private let topRankings: [(courseTitle: String, rank: Int, pace: String)] = [
        ("한강 반포 코스", 1, "4'12\""),
        ("올림픽공원 순환", 3, "4'45\""),
        ("양재천 코스", 8, "5'02\""),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Player card area
                        playerSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.md)

                        // Action buttons (follow / friend)
                        actionButtons
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.lg)

                        // Stats dashboard
                        statsDashboard
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Created courses
                        coursesSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Top rankings
                        rankingsSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        Color.clear.frame(height: RVSpacing.huge)
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

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Player Section

    // RN: PlayerCard layout — avatar + nickname + level + bio + social stats
    private var playerSection: some View {
        VStack(spacing: RVSpacing.md) {
            // Avatar
            ZStack {
                Circle()
                    .fill(RVColors.surfaceLight)
                    .frame(width: 86, height: 86)
                    .overlay(Circle().stroke(RVColors.border, lineWidth: 1))
                Image(systemName: "person.fill")
                    .font(.system(size: 28))
                    .foregroundStyle(RVColors.textTertiary)
            }

            // Name + level
            VStack(spacing: RVSpacing.xs) {
                HStack(spacing: 6) {
                    Text(profile.nickname)
                        .font(.system(size: RVFontSize.xl, weight: .heavy))
                        .tracking(-0.3)
                        .foregroundStyle(RVColors.text)

                    Text("Lv.\(profile.level)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                }

                if let crew = profile.crewName {
                    Text(crew)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.primary)
                }

                if let bio = profile.bio {
                    Text(bio)
                        .font(.system(size: RVFontSize.sm))
                        .foregroundStyle(RVColors.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.top, 2)
                }
            }

            // Social stats row
            HStack(spacing: 0) {
                socialStat(value: "\(followersCount)", label: "팔로워")
                socialStat(value: "\(profile.followingCount)", label: "팔로잉")
                socialStat(value: RunFormatters.formatNumber(profile.likesReceived), label: "좋아요")
            }
        }
    }

    private func socialStat(value: String, label: String) -> some View {
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

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: RVSpacing.md) {
            // Follow button
            Button {
                isFollowing.toggle()
                followersCount += isFollowing ? 1 : -1
            } label: {
                Text(isFollowing ? "팔로잉" : "팔로우")
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(isFollowing ? RVColors.text : .white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.sm + 2)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(isFollowing ? RVColors.surfaceLight : RVColors.primary)
                    )
            }

            // Friend request button
            Button { } label: {
                Text("친구 추가")
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.sm + 2)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(RVColors.surfaceLight)
                    )
            }
        }
    }

    // MARK: - Stats Dashboard

    private var statsDashboard: some View {
        VStack(spacing: RVSpacing.lg) {
            // Hero distance
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(RunFormatters.metersToKm(profile.totalDistanceMeters, decimals: 1))
                    .font(.system(size: 48, weight: .black))
                    .tracking(-2)
                    .foregroundStyle(RVColors.text)
                Text("km")
                    .font(.system(size: RVFontSize.lg, weight: .bold))
                    .foregroundStyle(RVColors.textTertiary)
            }

            HStack(spacing: 0) {
                VStack(spacing: 2) {
                    Text("\(profile.totalRuns)")
                        .font(.system(size: RVFontSize.lg, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                    Text("러닝 횟수")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
                .frame(maxWidth: .infinity)

                Rectangle().fill(RVColors.divider).frame(width: 1, height: 24)

                VStack(spacing: 2) {
                    Text("\(recentCourses.count)")
                        .font(.system(size: RVFontSize.lg, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                    Text("코스 제작")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
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

    // MARK: - Courses Section

    private var coursesSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("제작한 코스")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            VStack(spacing: RVSpacing.sm) {
                ForEach(recentCourses, id: \.id) { course in
                    HStack(spacing: RVSpacing.md) {
                        // Thumbnail
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(RVColors.surfaceLight)
                                .frame(width: 56, height: 56)
                            Image(systemName: "map")
                                .font(.system(size: 18))
                                .foregroundStyle(RVColors.primary)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(course.title)
                                .font(.system(size: RVFontSize.md, weight: .bold))
                                .foregroundStyle(RVColors.text)
                                .lineLimit(1)
                            HStack(spacing: RVSpacing.xs) {
                                Text(course.distance)
                                    .font(.system(size: RVFontSize.sm, weight: .medium))
                                    .foregroundStyle(RVColors.textSecondary)
                                Text("\u{00B7}")
                                    .foregroundStyle(RVColors.textTertiary)
                                Text("\(RunFormatters.formatNumber(course.runs))명 참여")
                                    .font(.system(size: RVFontSize.sm, weight: .medium))
                                    .foregroundStyle(RVColors.textSecondary)
                            }
                        }

                        Spacer()

                        Image(systemName: "chevron.right")
                            .font(.system(size: 14))
                            .foregroundStyle(RVColors.textTertiary)
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
            }
        }
    }

    // MARK: - Rankings Section

    private var rankingsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("랭킹 기록")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            VStack(spacing: RVSpacing.sm) {
                ForEach(topRankings, id: \.courseTitle) { ranking in
                    let medalColors: [Color] = [Color(hex: "FFD700"), Color(hex: "9CA3AF"), Color(hex: "CD7F32")]
                    let isMedal = ranking.rank <= 3

                    HStack(spacing: RVSpacing.md) {
                        ZStack {
                            Circle()
                                .fill(isMedal ? medalColors[ranking.rank - 1] : RVColors.surface)
                                .frame(width: 28, height: 28)
                            Text("\(ranking.rank)")
                                .font(.system(size: RVFontSize.xs, weight: .heavy))
                                .foregroundStyle(isMedal ? .white : RVColors.textSecondary)
                        }

                        Text(ranking.courseTitle)
                            .font(.system(size: RVFontSize.md, weight: .bold))
                            .foregroundStyle(RVColors.text)
                            .lineLimit(1)

                        Spacer()

                        Text(ranking.pace)
                            .font(.system(size: RVFontSize.md, weight: .heavy, design: .monospaced))
                            .foregroundStyle(RVColors.primary)
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
            }
        }
    }
}

// MARK: - View-local model

private struct ProfileData {
    let nickname: String
    let bio: String?
    let level: Int
    let totalDistanceMeters: Double
    let totalRuns: Int
    let followingCount: Int
    let likesReceived: Int
    let crewName: String?
    let country: String?
}

#Preview {
    UserProfileView()
}
