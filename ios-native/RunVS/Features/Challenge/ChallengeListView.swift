import SwiftUI

struct ChallengeListView: View {
    @Environment(\.dismiss) private var dismiss

    enum FilterTab: String, CaseIterable {
        case all = "전체"
        case individual = "개인"
        case crew = "크루"
    }

    struct Challenge: Identifiable {
        let id: String
        let title: String
        let description: String
        let goalType: String
        let goalValue: Double
        let currentValue: Double
        let challengeType: String // "individual" or "crew"
        let daysRemaining: Int
        let participantCount: Int
        let isJoined: Bool
    }

    @State private var filterTab: FilterTab = .all

    private let challenges: [Challenge] = [
        Challenge(id: "1", title: "4월 100km 달리기", description: "이번 달 100km를 달려보세요", goalType: "total_distance", goalValue: 100_000, currentValue: 42_000, challengeType: "individual", daysRemaining: 24, participantCount: 1256, isJoined: true),
        Challenge(id: "2", title: "주 5회 러닝 챌린지", description: "일주일에 5번 달리기", goalType: "total_runs", goalValue: 5, currentValue: 3, challengeType: "individual", daysRemaining: 3, participantCount: 834, isJoined: true),
        Challenge(id: "3", title: "크루 500km 돌파", description: "크루원 함께 500km 달성", goalType: "total_distance", goalValue: 500_000, currentValue: 280_000, challengeType: "crew", daysRemaining: 18, participantCount: 45, isJoined: false),
        Challenge(id: "4", title: "30일 연속 러닝", description: "매일 한 번 이상 달리기", goalType: "streak_days", goalValue: 30, currentValue: 12, challengeType: "individual", daysRemaining: 18, participantCount: 312, isJoined: false),
    ]

    private var filteredChallenges: [Challenge] {
        switch filterTab {
        case .all: return challenges
        case .individual: return challenges.filter { $0.challengeType == "individual" }
        case .crew: return challenges.filter { $0.challengeType == "crew" }
        }
    }

    private let goalIcons: [String: String] = [
        "total_distance": "figure.run",
        "total_runs": "arrow.trianglehead.2.counterclockwise",
        "total_duration": "clock",
        "streak_days": "flame",
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                // Filter tabs
                filterTabBar
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.md)

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: RVSpacing.md) {
                        ForEach(filteredChallenges) { challenge in
                            challengeCard(challenge)
                        }
                    }
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.xxxl)
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

            Text("챌린지")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Filter Tabs

    private var filterTabBar: some View {
        HStack(spacing: RVSpacing.sm) {
            ForEach(FilterTab.allCases, id: \.self) { tab in
                let isActive = filterTab == tab
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        filterTab = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(.system(size: RVFontSize.sm, weight: isActive ? .bold : .semibold))
                        .foregroundStyle(isActive ? RVColors.white : RVColors.textSecondary)
                        .padding(.vertical, RVSpacing.sm)
                        .padding(.horizontal, RVSpacing.lg)
                        .background(
                            Capsule()
                                .fill(isActive ? RVColors.primary : RVColors.surface)
                        )
                }
            }

            Spacer()
        }
    }

    // MARK: - Challenge Card

    private func challengeCard(_ challenge: Challenge) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            // Top row: icon + title + badge
            HStack(spacing: RVSpacing.md) {
                ZStack {
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(RVColors.primary.opacity(0.12))
                        .frame(width: 44, height: 44)
                    Image(systemName: goalIcons[challenge.goalType] ?? "star")
                        .font(.system(size: 20))
                        .foregroundStyle(RVColors.primary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(challenge.title)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)
                    Text(challenge.description)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                        .lineLimit(1)
                }

                Spacer()

                Text("D-\(challenge.daysRemaining)")
                    .font(.system(size: RVFontSize.xs, weight: .bold))
                    .foregroundStyle(challenge.daysRemaining <= 3 ? RVColors.error : RVColors.primary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        (challenge.daysRemaining <= 3 ? RVColors.error : RVColors.primary).opacity(0.12)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            // Progress bar
            if challenge.isJoined {
                let progress = min(challenge.currentValue / challenge.goalValue, 1.0)
                VStack(spacing: RVSpacing.xs) {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RVColors.surface)
                                .frame(height: 8)
                            RoundedRectangle(cornerRadius: 4)
                                .fill(RVColors.primary)
                                .frame(width: geo.size.width * progress, height: 8)
                        }
                    }
                    .frame(height: 8)

                    HStack {
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(RVColors.primary)
                            .monospacedDigit()

                        Spacer()

                        Text(formatGoalValue(challenge.goalType, value: challenge.currentValue) + " / " + formatGoalValue(challenge.goalType, value: challenge.goalValue))
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                            .monospacedDigit()
                    }
                }
            }

            // Bottom row
            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 12))
                    Text("\(challenge.participantCount)명 참여")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                }
                .foregroundStyle(RVColors.textTertiary)

                Spacer()

                if challenge.isJoined {
                    Text("참여 중")
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                } else {
                    Text("참여하기")
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.white)
                        .padding(.horizontal, RVSpacing.md)
                        .padding(.vertical, RVSpacing.xs + 1)
                        .background(RVColors.primary)
                        .clipShape(Capsule())
                }
            }
        }
        .padding(RVSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    private func formatGoalValue(_ goalType: String, value: Double) -> String {
        switch goalType {
        case "total_distance": return RunFormatters.formatDistanceWithUnit(meters: value)
        case "total_runs": return "\(Int(value))회"
        case "total_duration": return "\(Int(value / 60))분"
        case "streak_days": return "\(Int(value))일"
        default: return "\(Int(value))"
        }
    }
}

#Preview {
    ChallengeListView()
}
