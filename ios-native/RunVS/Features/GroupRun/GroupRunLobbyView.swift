import SwiftUI

struct GroupRunLobbyView: View {
    @Environment(\.dismiss) private var dismiss

    struct Participant: Identifiable {
        let id: String
        let nickname: String
        let isReady: Bool
        let isHost: Bool
    }

    private let title = "한강 야간 러닝"
    private let courseName: String? = "한강 반포 코스"
    private let scheduledAt = "오늘 19:00"

    @State private var participants: [Participant] = [
        Participant(id: "1", nickname: "captain_kim", isReady: true, isHost: true),
        Participant(id: "2", nickname: "marathon_queen", isReady: true, isHost: false),
        Participant(id: "3", nickname: "speed_king", isReady: false, isHost: false),
        Participant(id: "4", nickname: "park_runner", isReady: true, isHost: false),
        Participant(id: "5", nickname: "night_owl", isReady: false, isHost: false),
    ]

    private var readyCount: Int {
        participants.filter(\.isReady).count
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xxl) {
                        // Run info
                        runInfoSection

                        // Participants
                        participantsSection

                        // Actions
                        actionButtons
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

            Text("대기실")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Run Info

    private var runInfoSection: some View {
        VStack(spacing: RVSpacing.lg) {
            Text(title)
                .font(.system(size: RVFontSize.xxl, weight: .heavy))
                .foregroundStyle(RVColors.text)

            HStack(spacing: RVSpacing.xl) {
                if let course = courseName {
                    HStack(spacing: 4) {
                        Image(systemName: "map")
                            .font(.system(size: 14))
                        Text(course)
                            .font(.system(size: RVFontSize.sm, weight: .medium))
                    }
                    .foregroundStyle(RVColors.textSecondary)
                }

                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 14))
                    Text(scheduledAt)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                }
                .foregroundStyle(RVColors.textSecondary)
            }

            Text("\(readyCount)/\(participants.count) 준비 완료")
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(readyCount == participants.count ? RVColors.success : RVColors.warning)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RVSpacing.xxl)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Participants

    private var participantsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("참가자")
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .foregroundStyle(RVColors.text)

            VStack(spacing: RVSpacing.sm) {
                ForEach(participants) { p in
                    participantRow(p)
                }
            }
        }
    }

    private func participantRow(_ p: Participant) -> some View {
        HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(RVColors.surfaceLight)
                    .frame(width: 40, height: 40)
                Image(systemName: "person.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(RVColors.textTertiary)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: RVSpacing.xs) {
                    Text(p.nickname)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)

                    if p.isHost {
                        Text("호스트")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(RVColors.gold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(RVColors.gold.opacity(0.15))
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }
            }

            Spacer()

            Circle()
                .fill(p.isReady ? RVColors.success : RVColors.surfaceLight)
                .frame(width: 12, height: 12)
                .overlay(
                    Circle()
                        .stroke(p.isReady ? RVColors.success : RVColors.textTertiary, lineWidth: 1)
                )
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

    // MARK: - Actions

    private var actionButtons: some View {
        VStack(spacing: RVSpacing.md) {
            Button { } label: {
                Text("준비 완료")
                    .font(.system(size: RVFontSize.lg, weight: .bold))
                    .foregroundStyle(RVColors.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .fill(RVColors.success)
                    )
            }

            Button { dismiss() } label: {
                Text("나가기")
                    .font(.system(size: RVFontSize.md, weight: .semibold))
                    .foregroundStyle(RVColors.error)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.md)
            }
        }
    }
}

#Preview {
    GroupRunLobbyView()
}
