import SwiftUI

struct ChallengeDetailView: View {
    @Environment(\.dismiss) private var dismiss

    // Mock data
    private let title = "4월 100km 달리기"
    private let description = "이번 달 동안 총 100km를 달려보세요. 꾸준히 달리면 충분히 달성할 수 있습니다!"
    private let goalType = "total_distance"
    private let goalValue: Double = 100_000
    private let currentValue: Double = 42_000
    private let startDate = "2026.04.01"
    private let endDate = "2026.04.30"
    private let daysRemaining = 24
    private let participantCount = 1256
    private let isJoined = true

    private let leaderboard: [(rank: Int, nickname: String, value: Double)] = [
        (1, "speed_king", 78_500),
        (2, "marathon_queen", 65_200),
        (3, "morning_bird", 55_800),
        (4, "park_runner", 48_300),
        (5, "night_owl", 42_000),
    ]

    private var progress: Double {
        min(currentValue / goalValue, 1.0)
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xxl) {
                        // Hero
                        heroSection

                        // Progress
                        progressSection

                        // Info
                        infoSection

                        // Leaderboard
                        leaderboardSection

                        // Action button
                        if !isJoined {
                            joinButton
                        }
                    }
                    .padding(.horizontal, RVSpacing.xxl)
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

            Text("챌린지")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Hero

    private var heroSection: some View {
        VStack(spacing: RVSpacing.lg) {
            ZStack {
                Circle()
                    .fill(RVColors.primary.opacity(0.12))
                    .frame(width: 72, height: 72)
                Image(systemName: "figure.run")
                    .font(.system(size: 32))
                    .foregroundStyle(RVColors.primary)
            }

            Text(title)
                .font(.system(size: RVFontSize.xxl, weight: .heavy))
                .foregroundStyle(RVColors.text)
                .multilineTextAlignment(.center)

            Text(description)
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)

            HStack(spacing: RVSpacing.lg) {
                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 13))
                    Text("\(participantCount)명")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                }
                .foregroundStyle(RVColors.textTertiary)

                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 13))
                    Text("D-\(daysRemaining)")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                }
                .foregroundStyle(daysRemaining <= 3 ? RVColors.error : RVColors.primary)
            }
        }
        .padding(.top, RVSpacing.lg)
    }

    // MARK: - Progress

    private var progressSection: some View {
        VStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .trim(from: 0, to: 1)
                    .stroke(RVColors.surface, lineWidth: 12)
                    .frame(width: 140, height: 140)

                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(RVColors.primary, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                    .frame(width: 140, height: 140)
                    .rotationEffect(.degrees(-90))

                VStack(spacing: 2) {
                    Text("\(Int(progress * 100))%")
                        .font(.system(size: RVFontSize.xxl, weight: .heavy))
                        .foregroundStyle(RVColors.primary)
                        .monospacedDigit()
                    Text("달성")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
            }

            Text("\(RunFormatters.formatDistanceWithUnit(meters: currentValue)) / \(RunFormatters.formatDistanceWithUnit(meters: goalValue))")
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RVSpacing.xl)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Info

    private var infoSection: some View {
        HStack(spacing: 0) {
            VStack(spacing: RVSpacing.xs) {
                Text(startDate)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text("시작")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .frame(maxWidth: .infinity)

            Rectangle()
                .fill(RVColors.divider)
                .frame(width: 1, height: 28)

            VStack(spacing: RVSpacing.xs) {
                Text(endDate)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text("종료")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .frame(maxWidth: .infinity)
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

    // MARK: - Leaderboard

    private var leaderboardSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("리더보드")
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .foregroundStyle(RVColors.text)

            VStack(spacing: RVSpacing.sm) {
                ForEach(leaderboard, id: \.rank) { entry in
                    leaderboardRow(rank: entry.rank, nickname: entry.nickname, value: entry.value)
                }
            }
        }
    }

    private func leaderboardRow(rank: Int, nickname: String, value: Double) -> some View {
        let medalColors: [Color] = [RVColors.gold, Color(hex: "9CA3AF"), Color(hex: "CD7F32")]
        let isMedal = rank <= 3

        return HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(isMedal ? medalColors[rank - 1] : RVColors.surface)
                    .frame(width: 28, height: 28)
                Text("\(rank)")
                    .font(.system(size: RVFontSize.xs, weight: .heavy))
                    .foregroundStyle(isMedal ? .white : RVColors.textSecondary)
            }

            Text(nickname)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)
                .lineLimit(1)

            Spacer()

            Text(RunFormatters.formatDistanceWithUnit(meters: value))
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

    // MARK: - Join Button

    private var joinButton: some View {
        Button { } label: {
            Text("챌린지 참여하기")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(RVColors.primary)
                )
        }
    }
}

#Preview {
    ChallengeDetailView()
}
