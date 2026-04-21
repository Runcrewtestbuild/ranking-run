import SwiftUI

struct CourseSearchView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var activeSortKey: SortKey = .popular
    @State private var activeDistanceFilter: DistanceFilterKey = .all

    enum SortKey: String, CaseIterable {
        case popular = "인기순"
        case newest = "최신순"
        case distance = "거리순"
    }

    enum DistanceFilterKey: String, CaseIterable {
        case all = "전체"
        case threeK = "~3km"
        case fiveK = "3~7km"
        case tenK = "7~15km"
        case half = "15km+"
    }

    // Mock data
    private let courses: [Course] = [
        Course(id: "1", title: "한강 반포 코스", distanceMeters: 5200, difficulty: "easy", totalRuns: 342, creatorNickname: "runner_kim"),
        Course(id: "2", title: "남산 순환 코스", distanceMeters: 8100, difficulty: "hard", totalRuns: 128, creatorNickname: "mountain_lover"),
        Course(id: "3", title: "올림픽공원 한 바퀴", distanceMeters: 3800, difficulty: "easy", totalRuns: 567, creatorNickname: "park_runner"),
        Course(id: "4", title: "청계천 야경 코스", distanceMeters: 4500, difficulty: "normal", totalRuns: 12, creatorNickname: "night_run"),
        Course(id: "5", title: "여의도 벚꽃길", distanceMeters: 6300, difficulty: "normal", totalRuns: 45, creatorNickname: "cherry_blossom"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header: back + search bar
                headerBar

                // Distance filter chips
                distanceFilters
                    .padding(.bottom, RVSpacing.sm)

                // Sort chips
                sortChips
                    .padding(.bottom, RVSpacing.md)

                // Results list
                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.sm) {
                        ForEach(filteredCourses) { course in
                            courseRow(course)
                        }
                    }
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.xxxl)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    private var filteredCourses: [Course] {
        var result = courses
        if !searchText.isEmpty {
            result = result.filter { $0.title.localizedCaseInsensitiveContains(searchText) }
        }
        return result
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack(spacing: RVSpacing.sm) {
            Button { dismiss() } label: {
                Image(systemName: "arrow.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 40, height: 40)
            }

            HStack(spacing: RVSpacing.sm) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18))
                    .foregroundStyle(RVColors.textTertiary)

                TextField("코스 이름 검색", text: $searchText)
                    .font(.system(size: RVFontSize.md))
                    .foregroundStyle(RVColors.text)

                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                }
            }
            .padding(.horizontal, RVSpacing.lg)
            .padding(.vertical, RVSpacing.md)
            .background(RVColors.surface)
            .clipShape(RoundedRectangle(cornerRadius: RVRadius.lg))
        }
        .padding(.horizontal, RVSpacing.lg)
        .padding(.vertical, RVSpacing.md)
    }

    // MARK: - Distance Filters

    private var distanceFilters: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RVSpacing.sm) {
                ForEach(DistanceFilterKey.allCases, id: \.self) { filter in
                    let isActive = activeDistanceFilter == filter
                    Button {
                        activeDistanceFilter = filter
                    } label: {
                        Text(filter.rawValue)
                            .font(.system(size: RVFontSize.xs, weight: isActive ? .bold : .semibold))
                            .foregroundStyle(isActive ? RVColors.primary : RVColors.textSecondary)
                            .padding(.vertical, RVSpacing.xs + 2)
                            .padding(.horizontal, RVSpacing.lg)
                            .background(
                                Capsule()
                                    .fill(isActive ? RVColors.primary.opacity(0.08) : RVColors.surface)
                            )
                            .overlay(
                                Capsule()
                                    .stroke(isActive ? RVColors.primary : Color.clear, lineWidth: 1)
                            )
                    }
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    // MARK: - Sort Chips

    private var sortChips: some View {
        HStack(spacing: RVSpacing.sm) {
            ForEach(SortKey.allCases, id: \.self) { sort in
                let isActive = activeSortKey == sort
                Button {
                    activeSortKey = sort
                } label: {
                    Text(sort.rawValue)
                        .font(.system(size: RVFontSize.sm, weight: isActive ? .bold : .semibold))
                        .foregroundStyle(isActive ? RVColors.white : RVColors.textSecondary)
                        .padding(.vertical, RVSpacing.sm)
                        .padding(.horizontal, RVSpacing.lg)
                        .background(
                            Capsule()
                                .fill(isActive ? RVColors.primary : RVColors.background)
                        )
                        .overlay(
                            Capsule()
                                .stroke(isActive ? RVColors.primary : RVColors.border, lineWidth: 1)
                        )
                }
            }

            Spacer()
        }
        .padding(.horizontal, RVSpacing.xxl)
    }

    // MARK: - Course Row

    private func courseRow(_ course: Course) -> some View {
        HStack(spacing: RVSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: RVRadius.sm)
                    .fill(RVColors.surface)
                    .frame(width: 72, height: 72)
                Image(systemName: "map")
                    .font(.system(size: 28))
                    .foregroundStyle(RVColors.textTertiary)
            }

            VStack(alignment: .leading, spacing: RVSpacing.xs) {
                Text(course.title)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)

                HStack(spacing: RVSpacing.xs) {
                    Text(RunFormatters.formatDistanceWithUnit(meters: course.distanceMeters))
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textSecondary)
                    Text("\u{00B7}")
                        .foregroundStyle(RVColors.textTertiary)
                    Image(systemName: "person.2")
                        .font(.system(size: 13))
                        .foregroundStyle(RVColors.textTertiary)
                    Text(RunFormatters.formatNumber(course.totalRuns))
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textTertiary)
                }
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
    }
}

#Preview {
    CourseSearchView()
}
