import SwiftUI

struct RunHistoryView: View {
    @Environment(\.dismiss) private var dismiss

    // Mock grouped data
    private let groupedRuns: [(date: String, runs: [RunHistoryItem])] = [
        (
            date: "2026.04.06",
            runs: [
                RunHistoryItem(id: "1", title: "Morning Run", distanceMeters: 5_230, durationSeconds: 1620, avgPaceSecondsPerKm: 310, finishedAt: "2026-04-06T07:30:00Z"),
                RunHistoryItem(id: "2", title: "한강 반포 코스", distanceMeters: 8_100, durationSeconds: 2880, avgPaceSecondsPerKm: 356, finishedAt: "2026-04-06T18:00:00Z", isCourse: true),
            ]
        ),
        (
            date: "2026.04.04",
            runs: [
                RunHistoryItem(id: "3", title: "자유 러닝", distanceMeters: 3_200, durationSeconds: 1140, avgPaceSecondsPerKm: 356, finishedAt: "2026-04-04T06:45:00Z"),
            ]
        ),
        (
            date: "2026.04.02",
            runs: [
                RunHistoryItem(id: "4", title: "Recovery Run", distanceMeters: 4_500, durationSeconds: 1800, avgPaceSecondsPerKm: 400, finishedAt: "2026-04-02T17:30:00Z"),
                RunHistoryItem(id: "5", title: "인터벌 3x(3분/1분)", distanceMeters: 2_800, durationSeconds: 960, avgPaceSecondsPerKm: 343, finishedAt: "2026-04-02T07:00:00Z", goalType: "interval"),
            ]
        ),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                        ForEach(groupedRuns, id: \.date) { group in
                            Section {
                                VStack(spacing: 0) {
                                    ForEach(Array(group.runs.enumerated()), id: \.element.id) { index, run in
                                        runCard(run, isLast: index == group.runs.count - 1)
                                    }
                                }
                                .padding(.horizontal, RVSpacing.xxl)
                                .background(
                                    RoundedRectangle(cornerRadius: RVRadius.lg)
                                        .fill(RVColors.card)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: RVRadius.lg)
                                                .stroke(RVColors.border, lineWidth: 1)
                                        )
                                        .padding(.horizontal, RVSpacing.xxl)
                                )
                            } header: {
                                Text(group.date)
                                    .font(.system(size: RVFontSize.sm, weight: .bold))
                                    .foregroundStyle(RVColors.textSecondary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, RVSpacing.xxl + RVSpacing.xs)
                                    .padding(.vertical, RVSpacing.sm)
                                    .background(RVColors.background)
                            }
                        }
                    }
                    .padding(.top, RVSpacing.md)

                    Color.clear.frame(height: RVSpacing.huge)
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

            Text("러닝 기록")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Run Card

    // RN: runCard padding 16, border-bottom if not last
    private func runCard(_ run: RunHistoryItem, isLast: Bool) -> some View {
        VStack(spacing: 0) {
            HStack(spacing: RVSpacing.md) {
                // Route thumbnail placeholder
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(RVColors.surfaceLight)
                        .frame(width: 56, height: 56)
                    Image(systemName: "footsteps")
                        .font(.system(size: 18))
                        .foregroundStyle(RVColors.textTertiary)
                }

                VStack(alignment: .leading, spacing: RVSpacing.xs) {
                    // Title + time
                    HStack {
                        Text(run.title)
                            .font(.system(size: RVFontSize.md, weight: .bold))
                            .foregroundStyle(RVColors.text)
                            .lineLimit(1)
                        Spacer()
                        Text(run.timeLabel)
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                    }

                    // Stats row
                    HStack(spacing: RVSpacing.md) {
                        miniStat(value: RunFormatters.formatDistance(meters: run.distanceMeters), label: "거리")
                        miniStatDivider
                        miniStat(value: RunFormatters.formatPace(secondsPerKm: run.avgPaceSecondsPerKm), label: "페이스")
                        miniStatDivider
                        miniStat(value: RunFormatters.formatDuration(seconds: run.durationSeconds), label: "시간")
                    }

                    // Goal tag
                    if let goalType = run.goalType {
                        Text(goalType == "interval" ? "인터벌" : goalType == "distance" ? "거리 목표" : "자유 러닝")
                            .font(.system(size: RVFontSize.xs, weight: .semibold))
                            .foregroundStyle(RVColors.primary)
                    }
                }
            }
            .padding(.vertical, RVSpacing.lg)

            if !isLast {
                Rectangle()
                    .fill(RVColors.divider)
                    .frame(height: 1)
            }
        }
    }

    private func miniStat(value: String, label: String) -> some View {
        VStack(spacing: 1) {
            Text(value)
                .font(.system(size: RVFontSize.sm, weight: .bold, design: .monospaced))
                .foregroundStyle(RVColors.text)
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
        }
    }

    private var miniStatDivider: some View {
        Rectangle()
            .fill(RVColors.border)
            .frame(width: 1, height: 20)
    }
}

// MARK: - Run History Item (View-local model)

struct RunHistoryItem: Identifiable {
    let id: String
    let title: String
    let distanceMeters: Double
    let durationSeconds: Int
    let avgPaceSecondsPerKm: Double
    let finishedAt: String
    var isCourse: Bool = false
    var goalType: String? = nil

    var timeLabel: String {
        let d = ISO8601DateFormatter().date(from: finishedAt) ?? Date()
        let h = Calendar.current.component(.hour, from: d)
        let m = Calendar.current.component(.minute, from: d)
        let period = h < 12 ? "AM" : "PM"
        let h12 = h % 12 == 0 ? 12 : h % 12
        return "\(period) \(h12):\(String(format: "%02d", m))"
    }
}

#Preview {
    RunHistoryView()
}
