import SwiftUI

struct CourseListView: View {
    // Mock data
    private let popularCourses: [Course] = [
        Course(id: "1", title: "한강 반포 코스", distanceMeters: 5200, difficulty: "easy", totalRuns: 342, creatorNickname: "runner_kim"),
        Course(id: "2", title: "남산 순환 코스", distanceMeters: 8100, difficulty: "hard", totalRuns: 128, creatorNickname: "mountain_lover"),
        Course(id: "3", title: "올림픽공원 한 바퀴", distanceMeters: 3800, difficulty: "easy", totalRuns: 567, creatorNickname: "park_runner"),
    ]

    private let newCourses: [Course] = [
        Course(id: "4", title: "청계천 야경 코스", distanceMeters: 4500, difficulty: "normal", totalRuns: 12, creatorNickname: "night_run"),
        Course(id: "5", title: "여의도 벚꽃길", distanceMeters: 6300, difficulty: "normal", totalRuns: 45, creatorNickname: "cherry_blossom"),
        Course(id: "6", title: "잠실 석촌호수", distanceMeters: 2700, difficulty: "easy", totalRuns: 89, creatorNickname: "lake_view"),
    ]

    private let nearbyCourses: [Course] = [
        Course(id: "7", title: "동네 한 바퀴", distanceMeters: 2100, difficulty: "easy", totalRuns: 23, creatorNickname: "local_runner"),
        Course(id: "8", title: "공원 순환 코스", distanceMeters: 3400, difficulty: "normal", totalRuns: 56, creatorNickname: "park_master"),
    ]

    var body: some View {
        ZStack {
            RVColors.background
                .ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header
                    header
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.lg)
                        .padding(.bottom, RVSpacing.md)

                    // Favorites section (horizontal scroll)
                    sectionHeader(title: "즐겨찾기", icon: "heart.fill", iconColor: .red)
                        .padding(.top, RVSpacing.xl)

                    emptyHint("즐겨찾기한 코스가 없습니다")
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.sm)

                    // Nearby section (horizontal scroll)
                    sectionHeader(title: "내 주변 코스", icon: "location.fill", iconColor: .red)
                        .padding(.top, RVSpacing.xl)

                    nearbyScrollSection

                    // Popular section (vertical list)
                    sectionHeader(title: "인기 코스", icon: "flame.fill", iconColor: .orange, showMore: true)
                        .padding(.top, RVSpacing.xl)

                    courseList(popularCourses)

                    // New section (vertical list)
                    sectionHeader(title: "새로운 코스", icon: "sparkles", iconColor: RVColors.success, showMore: true)
                        .padding(.top, RVSpacing.xl)

                    courseList(newCourses)

                    // Bottom padding for tab bar
                    Color.clear.frame(height: 100)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    // RN: headerTitle fontSize 34, fontWeight 900, letterSpacing -1
    // RN: searchBtn 40x40, borderRadius full, bg surface, icon size 22
    private var header: some View {
        HStack {
            Text("코스 탐색")
                .font(.system(size: RVFontSize.display, weight: .black))
                .tracking(-1)
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { } label: {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 22))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 40, height: 40)
                    .background(RVColors.surface)
                    .clipShape(Circle())
            }
        }
    }

    // MARK: - Section Header

    // RN: sectionHeader paddingHorizontal xxl (24), marginBottom md (12)
    // RN: sectionIconBadge 26x26 borderRadius 13, icon size 14
    // RN: sectionTitle fontSize 17 (lg), fontWeight 800, letterSpacing -0.3
    // RN: seeMoreHeaderText fontSize 13, fontWeight 600, color textTertiary
    private func sectionHeader(title: String, icon: String, iconColor: Color, showMore: Bool = false) -> some View {
        HStack {
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
            }

            Spacer()

            if showMore {
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
        }
        .padding(.horizontal, RVSpacing.xxl)
        .padding(.bottom, RVSpacing.md)
    }

    // MARK: - Nearby Horizontal Scroll

    // RN: nearbyScrollContent paddingHorizontal xxl (24), gap md (12)
    private var nearbyScrollSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RVSpacing.md) {
                ForEach(nearbyCourses) { course in
                    nearbyCard(course)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    // RN: nearbyCard width 160, bg card, borderRadius lg (18), overflow hidden, border 1, shadow sm
    // RN: nearbyThumbContainer height 100
    // RN: hCardInfo paddingHorizontal sm (8), paddingVertical 6, gap 2
    // RN: hCardTitle fontSize 14, fontWeight 700
    // RN: hCardMeta fontSize 12, fontWeight 500, opacity 0.7
    // RN: hCardSub fontSize 12, fontWeight 400, opacity 0.4
    private func nearbyCard(_ course: Course) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Thumbnail placeholder
            ZStack {
                RVColors.surface
                Image(systemName: "map")
                    .font(.system(size: 28))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .frame(width: 160, height: 100)

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(course.title)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)

                HStack(spacing: 0) {
                    Text(RunFormatters.formatDistanceWithUnit(meters: course.distanceMeters))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(RVColors.text.opacity(0.7))
                    Text(" \u{00B7} ")
                        .foregroundStyle(RVColors.text.opacity(0.35))
                    Text(difficultyLabel(course.difficulty))
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(difficultyColor(course.difficulty))
                }

                Text(course.creatorNickname)
                    .font(.system(size: 12))
                    .foregroundStyle(RVColors.text.opacity(0.4))
                    .lineLimit(1)
            }
            .padding(.horizontal, RVSpacing.sm)
            .padding(.vertical, 6)
        }
        .frame(width: 160)
        .background(RVColors.card)
        .clipShape(RoundedRectangle(cornerRadius: RVRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .stroke(RVColors.border, lineWidth: 1)
        )
        // RN: SHADOWS.sm = {color:#1C1917, offset:{0,1}, opacity:0.03, radius:4}
        .shadow(color: Color(hex: "1C1917").opacity(0.03), radius: 4, y: 1)
    }

    // MARK: - Course Vertical List

    // RN: verticalList paddingHorizontal xxl (24), gap sm (8)
    private func courseList(_ courses: [Course]) -> some View {
        VStack(spacing: RVSpacing.sm) {
            ForEach(courses) { course in
                courseRow(course)
            }
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // RN: rowCard flexDirection row, bg card, borderRadius md (14), padding md (12), gap md (12), border 1, shadow sm
    // RN: rowThumb 56x56, borderRadius sm (10)
    // RN: rowTitle fontSize md (15), fontWeight 700
    // RN: vCardMeta fontSize sm (13), fontWeight 500, opacity 0.6
    // RN: rowCreator fontSize 12, fontWeight 400, opacity 0.4
    private func courseRow(_ course: Course) -> some View {
        HStack(spacing: RVSpacing.md) {
            // Thumbnail
            ZStack {
                RoundedRectangle(cornerRadius: RVRadius.sm)
                    .fill(RVColors.surface)
                    .frame(width: 56, height: 56)
                Image(systemName: "map")
                    .font(.system(size: 22))
                    .foregroundStyle(RVColors.textTertiary)
            }

            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(course.title)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)

                HStack(spacing: 0) {
                    Text(RunFormatters.formatDistanceWithUnit(meters: course.distanceMeters))
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.text.opacity(0.6))
                    Text(" \u{00B7} ")
                        .foregroundStyle(RVColors.text.opacity(0.25))
                    Text(difficultyLabel(course.difficulty))
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(difficultyColor(course.difficulty))
                    Text(" \u{00B7} ")
                        .foregroundStyle(RVColors.text.opacity(0.25))
                    Text("참여 \(RunFormatters.formatNumber(course.totalRuns))회")
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.text.opacity(0.6))
                }

                Text(course.creatorNickname)
                    .font(.system(size: 12))
                    .foregroundStyle(RVColors.text.opacity(0.4))
                    .lineLimit(1)
            }

            Spacer()
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
        .shadow(color: Color(hex: "1C1917").opacity(0.03), radius: 4, y: 1)
    }

    // MARK: - Empty Hint

    // RN: nearbyEmptyText fontSize sm (13), color textTertiary, fontWeight 500
    private func emptyHint(_ text: String) -> some View {
        Text(text)
            .font(.system(size: RVFontSize.sm, weight: .medium))
            .foregroundStyle(RVColors.textTertiary)
            .padding(.vertical, RVSpacing.md)
    }

    // MARK: - Difficulty Helpers

    private func difficultyLabel(_ difficulty: String?) -> String {
        switch difficulty {
        case "easy": return "쉬움"
        case "normal": return "보통"
        case "hard": return "어려움"
        case "expert": return "전문가"
        case "legend": return "레전드"
        default: return "보통"
        }
    }

    private func difficultyColor(_ difficulty: String?) -> Color {
        switch difficulty {
        case "easy": return Color(hex: "6EE7A0")
        case "normal": return Color(hex: "FBBF54")
        case "hard", "expert": return Color(hex: "F87171")
        case "legend": return Color(hex: "A78BFA")
        default: return RVColors.textSecondary
        }
    }
}

#Preview {
    CourseListView()
}
