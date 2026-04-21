import SwiftUI

struct CrewSearchView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var searchText = ""
    @State private var selectedRegion: String?

    private let regions = ["전체", "서울", "경기", "인천", "부산", "대구", "대전", "광주"]

    private let crews: [Crew] = [
        Crew(id: "1", name: "서울 러너스", description: "서울에서 함께 달리는 모임", badgeColor: "FF7A33", memberCount: 128, level: 5, region: "서울"),
        Crew(id: "2", name: "한강 크루", description: "한강 코스 전문 크루", badgeColor: "10B981", memberCount: 56, level: 3, region: "서울"),
        Crew(id: "3", name: "새벽 러닝 클럽", description: "새벽 5시 기상 러닝", badgeColor: "8B5CF6", memberCount: 34, level: 2, region: "경기"),
        Crew(id: "4", name: "부산 달리기", description: "해운대 러닝 크루", badgeColor: "3B82F6", memberCount: 72, level: 4, region: "부산"),
        Crew(id: "5", name: "대전 러너스", description: "대전 갑천변 런닝", badgeColor: "EF4444", memberCount: 28, level: 2, region: "대전"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                headerBar

                // Search bar
                searchBar
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.md)

                // Region filter
                regionFilter
                    .padding(.bottom, RVSpacing.md)

                // Results
                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: RVSpacing.md) {
                        ForEach(filteredCrews) { crew in
                            crewCard(crew)
                        }
                    }
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.xxxl)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    private var filteredCrews: [Crew] {
        var result = crews
        if !searchText.isEmpty {
            result = result.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
        if let region = selectedRegion, region != "전체" {
            result = result.filter { $0.region == region }
        }
        return result
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }

            Spacer()

            Text("크루 탐색")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: RVSpacing.sm) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 18))
                .foregroundStyle(RVColors.textTertiary)

            TextField("크루 이름 검색", text: $searchText)
                .font(.system(size: RVFontSize.md))
                .foregroundStyle(RVColors.text)

            if !searchText.isEmpty {
                Button { searchText = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(RVColors.textTertiary)
                }
            }
        }
        .padding(.horizontal, RVSpacing.lg)
        .padding(.vertical, RVSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.surface)
        )
    }

    // MARK: - Region Filter

    private var regionFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: RVSpacing.sm) {
                ForEach(regions, id: \.self) { region in
                    let isActive = selectedRegion == region || (selectedRegion == nil && region == "전체")
                    Button {
                        selectedRegion = region == "전체" ? nil : region
                    } label: {
                        Text(region)
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

    // MARK: - Crew Card

    private func crewCard(_ crew: Crew) -> some View {
        HStack(spacing: RVSpacing.md) {
            ZStack {
                RoundedRectangle(cornerRadius: RVRadius.md)
                    .fill(Color(hex: crew.badgeColor ?? "FF7A33").opacity(0.15))
                    .frame(width: 52, height: 52)
                Image(systemName: "person.3.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Color(hex: crew.badgeColor ?? "FF7A33"))
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: RVSpacing.sm) {
                    Text("Lv.\(crew.level)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(RVColors.primary.opacity(0.15))
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                    Text(crew.name)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)
                }

                if let desc = crew.description {
                    Text(desc)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                        .lineLimit(1)
                }

                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 12))
                    Text("\(crew.memberCount)명")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                    if let region = crew.region {
                        Text("\u{00B7}")
                        Text(region)
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                    }
                }
                .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundStyle(RVColors.textTertiary)
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
    CrewSearchView()
}
