import SwiftUI

struct CourseDetailView: View {
    let courseId: String

    init(courseId: String = "mock-course-1") {
        self.courseId = courseId
    }

    @Environment(\.dismiss) private var dismiss

    // Mock data
    private let course = Course(
        id: "mock-course-1",
        creatorId: "user-1",
        title: "한강 반포 코스",
        description: "반포대교에서 잠수교까지 왕복하는 5km 러닝 코스입니다. 한강 야경을 즐기며 달리기 좋은 코스예요.",
        distanceMeters: 5_120,
        elevationGainMeters: 32,
        difficulty: "보통",
        totalRuns: 1_284,
        creatorNickname: "speed_king",
        region: "서울 서초구",
        createdAt: Date().addingTimeInterval(-86400 * 30)
    )

    private let rankings: [(rank: Int, nickname: String, pace: String, time: String)] = [
        (1, "speed_king", "4'12\"", "21:30"),
        (2, "marathon_queen", "4'25\"", "22:38"),
        (3, "park_runner", "4'31\"", "23:07"),
        (4, "night_owl", "4'45\"", "24:18"),
        (5, "morning_bird", "4'52\"", "24:54"),
    ]

    @State private var isFavorited: Bool = false
    @State private var isLiked: Bool = false
    @State private var likeCount: Int = 86

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Map preview
                        mapSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.md)

                        // Course info
                        courseInfoSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Stats row
                        statsRow
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.lg)

                        // Like + Favorite row
                        socialRow
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.lg)

                        // Rankings
                        rankingsSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        // Bottom spacing for CTA
                        Color.clear.frame(height: 120)
                    }
                }
            }
            .safeAreaPadding(.top)

            // Bottom CTA
            VStack {
                Spacer()
                ctaButton
            }
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

            Text("코스 상세")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { isFavorited.toggle() } label: {
                Image(systemName: isFavorited ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 20))
                    .foregroundStyle(isFavorited ? RVColors.primary : RVColors.text)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Map

    // RN: mapContainer height 200, borderRadius 14
    private var mapSection: some View {
        ZStack {
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
                .frame(height: 200)
            VStack(spacing: RVSpacing.sm) {
                Image(systemName: "map")
                    .font(.system(size: 32))
                    .foregroundStyle(RVColors.textTertiary)
                Text("코스 미리보기")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
        }
    }

    // MARK: - Course Info

    private var courseInfoSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            // Difficulty badge
            if let difficulty = course.difficulty {
                Text(difficulty)
                    .font(.system(size: RVFontSize.xs, weight: .bold))
                    .foregroundStyle(RVColors.primary)
                    .padding(.horizontal, RVSpacing.sm)
                    .padding(.vertical, 3)
                    .background(
                        Capsule().fill(RVColors.primary.opacity(0.15))
                    )
            }

            // Title
            Text(course.title)
                .font(.system(size: RVFontSize.title, weight: .heavy))
                .tracking(-0.5)
                .foregroundStyle(RVColors.text)

            // Creator + region
            HStack(spacing: RVSpacing.sm) {
                HStack(spacing: 4) {
                    Image(systemName: "person.fill")
                        .font(.system(size: 12))
                    Text(course.creatorNickname)
                }

                if let region = course.region {
                    Text("\u{00B7}")
                    HStack(spacing: 4) {
                        Image(systemName: "mappin")
                            .font(.system(size: 12))
                        Text(region)
                    }
                }
            }
            .font(.system(size: RVFontSize.sm, weight: .medium))
            .foregroundStyle(RVColors.textSecondary)

            // Description
            if let desc = course.description {
                Text(desc)
                    .font(.system(size: RVFontSize.md))
                    .foregroundStyle(RVColors.text)
                    .lineSpacing(4)
                    .padding(.top, RVSpacing.xs)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Stats Row

    // RN: statsRow bg surface, borderRadius 14, border 1, padding lg (16)
    private var statsRow: some View {
        HStack(spacing: 0) {
            courseStatItem(
                icon: "figure.run",
                value: RunFormatters.formatDistanceWithUnit(meters: course.distanceMeters),
                label: "거리"
            )
            courseStatDivider
            courseStatItem(
                icon: "arrow.up.right",
                value: "\(Int(course.elevationGainMeters))m",
                label: "고도"
            )
            courseStatDivider
            courseStatItem(
                icon: "flame.fill",
                value: course.difficulty ?? "보통",
                label: "난이도"
            )
            courseStatDivider
            courseStatItem(
                icon: "person.3.fill",
                value: RunFormatters.formatNumber(course.totalRuns),
                label: "러닝 수"
            )
        }
        .padding(.vertical, RVSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    private func courseStatItem(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(RVColors.primary)
            Text(value)
                .font(.system(size: RVFontSize.md, weight: .heavy))
                .foregroundStyle(RVColors.text)
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var courseStatDivider: some View {
        Rectangle()
            .fill(RVColors.border)
            .frame(width: 1, height: 40)
    }

    // MARK: - Social Row

    private var socialRow: some View {
        HStack(spacing: RVSpacing.lg) {
            // Like button
            Button {
                isLiked.toggle()
                likeCount += isLiked ? 1 : -1
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isLiked ? "heart.fill" : "heart")
                        .font(.system(size: 18))
                        .foregroundStyle(isLiked ? RVColors.error : RVColors.textSecondary)
                    Text("\(likeCount)")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }

            // Favorite button
            Button {
                isFavorited.toggle()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: isFavorited ? "bookmark.fill" : "bookmark")
                        .font(.system(size: 18))
                        .foregroundStyle(isFavorited ? RVColors.primary : RVColors.textSecondary)
                    Text("저장")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }

            Spacer()
        }
    }

    // MARK: - Rankings

    private var rankingsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            HStack {
                Text("랭킹")
                    .font(.system(size: RVFontSize.lg, weight: .bold))
                    .foregroundStyle(RVColors.text)

                Spacer()

                Text("\(RunFormatters.formatNumber(course.totalRuns))명 참여")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }

            VStack(spacing: RVSpacing.sm) {
                ForEach(rankings, id: \.rank) { entry in
                    rankingRow(entry)
                }
            }
        }
    }

    // RN: rrRow bg card, borderRadius lg (18), border 1, padding md (12)
    private func rankingRow(_ entry: (rank: Int, nickname: String, pace: String, time: String)) -> some View {
        let medalColors: [Color] = [Color(hex: "FFD700"), Color(hex: "9CA3AF"), Color(hex: "CD7F32")]
        let isMedal = entry.rank <= 3

        return HStack(spacing: RVSpacing.md) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(isMedal ? medalColors[entry.rank - 1] : RVColors.surface)
                    .frame(width: 28, height: 28)
                Text("\(entry.rank)")
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
            Text(entry.nickname)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)
                .lineLimit(1)

            Spacer()

            // Pace + Time
            VStack(alignment: .trailing, spacing: 1) {
                Text(entry.pace)
                    .font(.system(size: RVFontSize.md, weight: .heavy, design: .monospaced))
                    .foregroundStyle(RVColors.primary)
                Text(entry.time)
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

    // MARK: - CTA

    // RN: bottomCta bg background, paddingHorizontal 24, paddingVertical 12, borderTopWidth 1
    private var ctaButton: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(RVColors.border)
                .frame(height: 1)

            Button { } label: {
                HStack(spacing: RVSpacing.sm) {
                    Image(systemName: "play.fill")
                        .font(.system(size: 16))
                    Text("이 코스로 달리기")
                        .font(.system(size: RVFontSize.md, weight: .heavy))
                }
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(RVColors.primary)
                        .shadow(color: RVColors.primary.opacity(0.3), radius: 12, y: 4)
                )
            }
            .padding(.horizontal, RVSpacing.xxl)
            .padding(.vertical, RVSpacing.md)
        }
        .background(RVColors.background)
    }
}

#Preview {
    CourseDetailView()
}
