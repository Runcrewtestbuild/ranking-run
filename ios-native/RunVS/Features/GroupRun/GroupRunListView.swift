import SwiftUI

struct GroupRunListView: View {
    @Environment(\.dismiss) private var dismiss

    struct GroupRun: Identifiable {
        let id: String
        let title: String
        let hostNickname: String
        let participantCount: Int
        let maxParticipants: Int
        let scheduledAt: String
        let courseName: String?
        let status: String // "waiting", "in_progress", "completed"
    }

    private let groupRuns: [GroupRun] = [
        GroupRun(id: "1", title: "한강 야간 러닝", hostNickname: "captain_kim", participantCount: 5, maxParticipants: 10, scheduledAt: "오늘 19:00", courseName: "한강 반포 코스", status: "waiting"),
        GroupRun(id: "2", title: "주말 롱런", hostNickname: "marathon_queen", participantCount: 8, maxParticipants: 15, scheduledAt: "내일 07:00", courseName: "남산 순환 코스", status: "waiting"),
        GroupRun(id: "3", title: "새벽 조깅", hostNickname: "morning_bird", participantCount: 3, maxParticipants: 5, scheduledAt: "진행 중", courseName: nil, status: "in_progress"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: RVSpacing.md) {
                        ForEach(groupRuns) { run in
                            groupRunCard(run)
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

            Text("그룹 런")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { } label: {
                Image(systemName: "plus")
                    .font(.system(size: 20))
                    .foregroundStyle(RVColors.primary)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Card

    private func groupRunCard(_ run: GroupRun) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            HStack {
                Text(run.title)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)

                Spacer()

                statusBadge(run.status)
            }

            HStack(spacing: RVSpacing.xs) {
                Image(systemName: "person.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(RVColors.textTertiary)
                Text(run.hostNickname)
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }

            if let course = run.courseName {
                HStack(spacing: RVSpacing.xs) {
                    Image(systemName: "map")
                        .font(.system(size: 12))
                        .foregroundStyle(RVColors.textTertiary)
                    Text(course)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }

            HStack {
                HStack(spacing: 4) {
                    Image(systemName: "person.2")
                        .font(.system(size: 13))
                    Text("\(run.participantCount)/\(run.maxParticipants)")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .monospacedDigit()
                }
                .foregroundStyle(RVColors.textTertiary)

                Spacer()

                HStack(spacing: 4) {
                    Image(systemName: "clock")
                        .font(.system(size: 13))
                    Text(run.scheduledAt)
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                }
                .foregroundStyle(run.status == "in_progress" ? RVColors.success : RVColors.textSecondary)
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

    private func statusBadge(_ status: String) -> some View {
        let (label, color): (String, Color) = {
            switch status {
            case "waiting": return ("대기 중", RVColors.warning)
            case "in_progress": return ("진행 중", RVColors.success)
            case "completed": return ("완료", RVColors.textTertiary)
            default: return ("대기 중", RVColors.warning)
            }
        }()

        return Text(label)
            .font(.system(size: RVFontSize.xs, weight: .bold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}

#Preview {
    GroupRunListView()
}
