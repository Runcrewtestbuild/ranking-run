import SwiftUI

struct RunDetailView: View {
    let runId: String

    init(runId: String = "mock-run-1") {
        self.runId = runId
    }

    @Environment(\.dismiss) private var dismiss

    // Mock detail data
    private let detail = RunDetailData(
        title: "Morning Run",
        dateLabel: "2026.04.06 AM 7:30",
        distanceMeters: 5_230,
        durationSeconds: 1620,
        avgPaceSecondsPerKm: 310,
        bestPaceSecondsPerKm: 285,
        calories: 314,
        elevationGainMeters: 42,
        heartRate: 148,
        cadence: 172,
        splits: [
            Split(kilometerIndex: 1, durationSeconds: 305, paceSecondsPerKm: 305, distanceMeters: 1000, elevationGainMeters: 8),
            Split(kilometerIndex: 2, durationSeconds: 312, paceSecondsPerKm: 312, distanceMeters: 1000, elevationGainMeters: 12),
            Split(kilometerIndex: 3, durationSeconds: 298, paceSecondsPerKm: 298, distanceMeters: 1000, elevationGainMeters: 5),
            Split(kilometerIndex: 4, durationSeconds: 320, paceSecondsPerKm: 320, distanceMeters: 1000, elevationGainMeters: 10),
            Split(kilometerIndex: 5, durationSeconds: 310, paceSecondsPerKm: 310, distanceMeters: 1000, elevationGainMeters: 7),
        ]
    )

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Date + title
                        VStack(alignment: .leading, spacing: RVSpacing.xs) {
                            Text(detail.dateLabel)
                                .font(.system(size: RVFontSize.sm, weight: .medium))
                                .foregroundStyle(RVColors.textSecondary)
                            Text(detail.title)
                                .font(.system(size: RVFontSize.xxl, weight: .heavy))
                                .tracking(-0.3)
                                .foregroundStyle(RVColors.text)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.md)

                        // Map
                        mapSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.lg)

                        // Hero distance
                        HStack(alignment: .firstTextBaseline, spacing: 4) {
                            Text(RunFormatters.formatDistance(meters: detail.distanceMeters))
                                .font(.system(size: 56, weight: .black))
                                .tracking(-2)
                                .foregroundStyle(RVColors.text)
                            Text("km")
                                .font(.system(size: RVFontSize.xl, weight: .bold))
                                .foregroundStyle(RVColors.textTertiary)
                        }
                        .padding(.top, RVSpacing.lg)

                        // Stats grid
                        statsGrid
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.lg)

                        // Splits
                        if !detail.splits.isEmpty {
                            splitsSection
                                .padding(.horizontal, RVSpacing.xxl)
                                .padding(.top, RVSpacing.xl)
                        }

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

            Text("러닝 상세")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            // Share button
            Button { } label: {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Map

    private var mapSection: some View {
        ZStack {
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
                .frame(height: 220)
            VStack(spacing: RVSpacing.sm) {
                Image(systemName: "map")
                    .font(.system(size: 28))
                    .foregroundStyle(RVColors.textTertiary)
                Text("경로 지도")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
        }
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                detailStatCell(value: RunFormatters.formatDuration(seconds: detail.durationSeconds), label: "시간")
                detailStatDivider
                detailStatCell(value: RunFormatters.formatPace(secondsPerKm: detail.avgPaceSecondsPerKm), label: "평균 페이스")
                detailStatDivider
                detailStatCell(value: "\(detail.calories)", label: "칼로리")
            }

            Rectangle().fill(RVColors.border).frame(height: 1).padding(.horizontal, RVSpacing.md)

            HStack(spacing: 0) {
                detailStatCell(
                    value: detail.heartRate > 0 ? "\(detail.heartRate)" : "--",
                    label: "심박수",
                    valueColor: detail.heartRate > 0 ? RVColors.error : RVColors.text
                )
                detailStatDivider
                detailStatCell(value: detail.cadence > 0 ? "\(detail.cadence)" : "--", label: "케이던스")
                detailStatDivider
                detailStatCell(
                    value: detail.elevationGainMeters > 0 ? "+\(Int(detail.elevationGainMeters))" : "--",
                    label: "고도 상승"
                )
            }
        }
        .padding(.vertical, RVSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    private func detailStatCell(value: String, label: String, valueColor: Color = RVColors.text) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(size: RVFontSize.lg, weight: .heavy, design: .monospaced))
                .foregroundStyle(valueColor)
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .semibold))
                .foregroundStyle(RVColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, RVSpacing.sm)
    }

    private var detailStatDivider: some View {
        Rectangle().fill(RVColors.border).frame(width: 1, height: 36)
    }

    // MARK: - Splits

    private var splitsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("구간 기록")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            VStack(spacing: 0) {
                HStack(spacing: 0) {
                    Text("구간").frame(maxWidth: .infinity, alignment: .leading)
                    Text("페이스").frame(maxWidth: .infinity)
                    Text("시간").frame(maxWidth: .infinity, alignment: .trailing)
                }
                .font(.system(size: RVFontSize.xs, weight: .bold))
                .foregroundStyle(RVColors.textTertiary)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.sm)

                ForEach(detail.splits) { split in
                    HStack(spacing: 0) {
                        HStack(spacing: 2) {
                            Text("\(split.kilometerIndex)")
                                .font(.system(size: RVFontSize.md, weight: .bold))
                                .foregroundStyle(RVColors.text)
                            Text("km")
                                .font(.system(size: RVFontSize.xs, weight: .medium))
                                .foregroundStyle(RVColors.textTertiary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)

                        Text(RunFormatters.formatPace(secondsPerKm: split.paceSecondsPerKm))
                            .font(.system(size: RVFontSize.md, weight: .bold, design: .monospaced))
                            .foregroundStyle(RVColors.text)
                            .frame(maxWidth: .infinity)

                        Text(RunFormatters.formatDuration(seconds: split.durationSeconds))
                            .font(.system(size: RVFontSize.sm, weight: .semibold, design: .monospaced))
                            .foregroundStyle(RVColors.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.sm + 2)
                    .background(
                        split.kilometerIndex % 2 == 0 ? RVColors.surfaceLight.opacity(0.5) : Color.clear
                    )
                }
            }
            .background(
                RoundedRectangle(cornerRadius: RVRadius.md)
                    .fill(RVColors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: RVRadius.md)
                            .stroke(RVColors.border, lineWidth: 1)
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: RVRadius.md))
        }
    }
}

// MARK: - View-local model

private struct RunDetailData {
    let title: String
    let dateLabel: String
    let distanceMeters: Double
    let durationSeconds: Int
    let avgPaceSecondsPerKm: Double
    let bestPaceSecondsPerKm: Double
    let calories: Int
    let elevationGainMeters: Double
    let heartRate: Int
    let cadence: Int
    let splits: [Split]
}

#Preview {
    RunDetailView()
}
