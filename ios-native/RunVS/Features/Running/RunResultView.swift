import SwiftUI

struct RunResultView: View {
    let run: Run

    init(run: Run? = nil) {
        self.run = run ?? Self.mockRun
    }

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header label
                    headerSection
                        .padding(.top, RVSpacing.xl)

                    // Hero distance
                    heroDistance
                        .padding(.top, RVSpacing.lg)

                    // Stats grid
                    statsGrid
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xl)

                    // Route map placeholder
                    mapPlaceholder
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xl)

                    // Split times table
                    if !run.splits.isEmpty {
                        splitsSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)
                    }

                    // Action buttons
                    actionButtons
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.xxxl)

                    Color.clear.frame(height: RVSpacing.huge)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    // RN: headerLabel fontSize 15 (md), fontWeight 700, textSecondary, textAlign center
    private var headerSection: some View {
        Text(run.courseId != nil ? "코스 러닝 완료!" : "자유 러닝 완료!")
            .font(.system(size: RVFontSize.md, weight: .bold))
            .foregroundStyle(RVColors.textSecondary)
    }

    // MARK: - Hero Distance

    // RN: heroDistance fontSize 72, fontWeight 900, letterSpacing -2
    // RN: heroUnit fontSize 24 (xxl), fontWeight 700, textTertiary, paddingBottom 4
    private var heroDistance: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(RunFormatters.formatDistance(meters: run.distanceMeters))
                .font(.system(size: 72, weight: .black))
                .tracking(-2)
                .foregroundStyle(RVColors.text)
            Text("km")
                .font(.system(size: RVFontSize.xxl, weight: .bold))
                .foregroundStyle(RVColors.textTertiary)
        }
    }

    // MARK: - Stats Grid

    // RN: GlassCard wrapping 2x3 grid, borderRadius 14, bg surface
    private var statsGrid: some View {
        VStack(spacing: 0) {
            // Row 1: Duration / Avg Pace / Calories
            HStack(spacing: 0) {
                resultStatCell(
                    value: RunFormatters.formatDuration(seconds: run.durationSeconds),
                    label: "시간"
                )
                resultStatDivider
                resultStatCell(
                    value: RunFormatters.formatPace(secondsPerKm: run.avgPaceSecondsPerKm),
                    label: "평균 페이스"
                )
                resultStatDivider
                resultStatCell(
                    value: "\(run.estimatedCalories)",
                    label: "칼로리"
                )
            }

            Rectangle()
                .fill(RVColors.border)
                .frame(height: 1)
                .padding(.horizontal, RVSpacing.md)

            // Row 2: HR / Cadence / Elevation
            HStack(spacing: 0) {
                resultStatCell(value: "--", label: "심박수", valueColor: RVColors.text)
                resultStatDivider
                resultStatCell(value: "--", label: "케이던스")
                resultStatDivider
                resultStatCell(
                    value: run.elevationGainMeters > 0 ? "+\(Int(run.elevationGainMeters))" : "--",
                    label: "고도 상승"
                )
            }
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

    private func resultStatCell(value: String, label: String, valueColor: Color = RVColors.text) -> some View {
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

    private var resultStatDivider: some View {
        Rectangle()
            .fill(RVColors.border)
            .frame(width: 1, height: 36)
    }

    // MARK: - Map Placeholder

    // RN: mapContainer height 200, borderRadius 14, overflow hidden
    private var mapPlaceholder: some View {
        ZStack {
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
                .frame(height: 200)
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

    // MARK: - Splits Section

    // RN: splitsTable bg surface, borderRadius 14 (md), border 1, overflow hidden
    private var splitsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("구간 기록")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            VStack(spacing: 0) {
                // Header row
                HStack(spacing: 0) {
                    Text("구간")
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text("페이스")
                        .frame(maxWidth: .infinity)
                    Text("편차")
                        .frame(maxWidth: .infinity)
                    Text("시간")
                        .frame(maxWidth: .infinity, alignment: .trailing)
                }
                .font(.system(size: RVFontSize.xs, weight: .bold))
                .foregroundStyle(RVColors.textTertiary)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.sm)

                let avgPace = run.splits.map(\.paceSecondsPerKm).reduce(0, +)
                    / Double(max(run.splits.count, 1))

                ForEach(run.splits) { split in
                    let delta = split.paceSecondsPerKm - avgPace
                    let deltaColor: Color = delta < -1 ? RVColors.success
                        : delta > 3 ? RVColors.error
                        : RVColors.textSecondary
                    let deltaStr = abs(delta) < 1 ? "-"
                        : "\(delta > 0 ? "+" : "-")\(Int(abs(delta)))s"

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

                        Text(deltaStr)
                            .font(.system(size: RVFontSize.sm, weight: .semibold, design: .monospaced))
                            .foregroundStyle(deltaColor)
                            .frame(maxWidth: .infinity)

                        Text(RunFormatters.formatDuration(seconds: split.durationSeconds))
                            .font(.system(size: RVFontSize.sm, weight: .semibold, design: .monospaced))
                            .foregroundStyle(RVColors.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.sm + 2)
                    .background(
                        split.kilometerIndex % 2 == 0
                            ? RVColors.surfaceLight.opacity(0.5)
                            : Color.clear
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

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: RVSpacing.md) {
            // Save / Go Home — RN: primary bg, borderRadius lg (18), paddingVertical lg (16)
            Button { dismiss() } label: {
                Text("홈으로 돌아가기")
                    .font(.system(size: RVFontSize.md, weight: .heavy))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .fill(RVColors.primary)
                    )
            }

            // Run again — RN: bg surface, borderRadius lg (18)
            Button { } label: {
                Text("다시 달리기")
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, RVSpacing.lg)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .fill(RVColors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: RVRadius.lg)
                                    .stroke(RVColors.border, lineWidth: 1)
                            )
                    )
            }
        }
    }

    // MARK: - Mock Data

    private static let mockRun = Run(
        userId: "mock",
        startedAt: Date().addingTimeInterval(-1800),
        endedAt: .now,
        distanceMeters: 5_230,
        durationSeconds: 1620,
        avgPaceSecondsPerKm: 310,
        bestPaceSecondsPerKm: 285,
        elevationGainMeters: 42,
        estimatedCalories: 314,
        splits: [
            Split(kilometerIndex: 1, durationSeconds: 305, paceSecondsPerKm: 305, distanceMeters: 1000, elevationGainMeters: 8),
            Split(kilometerIndex: 2, durationSeconds: 312, paceSecondsPerKm: 312, distanceMeters: 1000, elevationGainMeters: 12),
            Split(kilometerIndex: 3, durationSeconds: 298, paceSecondsPerKm: 298, distanceMeters: 1000, elevationGainMeters: 5),
            Split(kilometerIndex: 4, durationSeconds: 320, paceSecondsPerKm: 320, distanceMeters: 1000, elevationGainMeters: 10),
            Split(kilometerIndex: 5, durationSeconds: 310, paceSecondsPerKm: 310, distanceMeters: 1000, elevationGainMeters: 7),
        ]
    )
}

#Preview {
    RunResultView()
}
