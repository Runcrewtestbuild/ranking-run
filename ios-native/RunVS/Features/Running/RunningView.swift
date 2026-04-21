import SwiftUI
import UIKit

struct RunningView: View {
    @State private var viewModel = RunningViewModel()
    @Environment(\.dismiss) private var dismiss

    /// When true, skip idle screen and start countdown immediately
    var autoStart: Bool = false
    /// Goal passed from WorldMapView
    var goal: RunGoal = .none

    // Split panel expand state
    @State private var splitPanelExpanded = false

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            switch viewModel.phase {
            case .idle:
                idleContent
            case .countdown:
                countdownContent
            case .running, .paused:
                runningHUD
            case .completed:
                Color.clear
            }
        }
        .onAppear {
            if autoStart && viewModel.phase == .idle {
                viewModel.countdownValue = RunSettings.shared.countdownSeconds
                viewModel.startCountdown()
            }
        }
        .onChange(of: viewModel.phase) { _, newPhase in
            if newPhase == .completed {
                dismiss()
            }
        }
    }

    // MARK: - Idle

    // RN: idleContainer flex:1, justifyContent center, alignItems center, gap xxxl(32)
    // RN: startButton 180x180, borderRadius 90, bg primary, shadow
    // RN: startButtonText fontSize 36, fontWeight 900, letterSpacing 3
    private var idleContent: some View {
        VStack(spacing: 0) {
            Spacer()

            // Header: mode label + title
            VStack(spacing: RVSpacing.md) {
                Text(viewModel.isCourseRunning ? "코스 러닝" : "자유 러닝")
                    .font(.system(size: RVFontSize.md, weight: .semibold))
                    .foregroundStyle(RVColors.textSecondary)
                    .tracking(1)
                    .textCase(.uppercase)

                Text(viewModel.isCourseRunning ? "코스를 따라 달려보세요" : "자유롭게 달려보세요")
                    .font(.system(size: RVFontSize.xxl, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }

            Spacer()
                .frame(height: RVSpacing.xxxl)

            // GPS chip
            gpsChip

            Spacer()
                .frame(height: RVSpacing.xxxl)

            // START button -- RN: 180x180 circle, primary bg, shadow
            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                viewModel.startCountdown()
            } label: {
                Text("START")
                    .font(.system(size: 36, weight: .black))
                    .tracking(3)
                    .foregroundStyle(.white)
                    .frame(width: 180, height: 180)
                    .background(
                        Circle()
                            .fill(RVColors.primary)
                            .shadow(color: RVColors.primary.opacity(0.5), radius: 30, y: 0)
                    )
            }

            Text("GPS가 안정되면 시작하세요")
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
                .padding(.top, RVSpacing.lg)

            Spacer()
        }
        .safeAreaPadding(.top)
    }

    // MARK: - Countdown

    // RN: countdownContainer flex:1, center, gap xl(20)
    // RN: countdownLabel fontSize xxl(24), fontWeight 700, textSecondary -- text "준비하세요"
    // RN: countdownNumber fontSize 160, fontWeight 900, color text, lineHeight 180
    // RN: countdownBarTrack width 220, height 4, bg surfaceLight, borderRadius 2
    // RN: countdownBarFill bg primary
    private var countdownContent: some View {
        VStack(spacing: RVSpacing.xl) {
            Spacer()

            Text("준비하세요")
                .font(.system(size: RVFontSize.xxl, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            Text("\(viewModel.countdownValue)")
                .font(.system(size: 160, weight: .black))
                .foregroundStyle(RVColors.text)
                .monospacedDigit()
                .contentTransition(.numericText())
                .animation(.easeInOut(duration: 0.3), value: viewModel.countdownValue)

            // Progress bar -- RN: width 220, height 4, borderRadius 2
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(RVColors.surfaceLight)
                    .frame(width: 220, height: 4)
                RoundedRectangle(cornerRadius: 2)
                    .fill(RVColors.primary)
                    .frame(
                        width: 220 * CGFloat(RunSettings.shared.countdownSeconds + 1 - viewModel.countdownValue) / CGFloat(max(1, RunSettings.shared.countdownSeconds)),
                        height: 4
                    )
                    .animation(.easeInOut(duration: 0.8), value: viewModel.countdownValue)
            }
            .padding(.top, RVSpacing.lg)

            Spacer()
        }
    }

    // MARK: - Running HUD

    // RN: hudContainer flex:1, paddingHorizontal xl(20)
    private var runningHUD: some View {
        VStack(spacing: 0) {
            // Top bar: GPS chip + mode chip + watch chip + metronome chip
            topBar
                .padding(.top, RVSpacing.xs)

            // Mini map -- RN: flex:1, minHeight 100, marginTop sm(8)
            miniMapArea
                .padding(.top, RVSpacing.sm)

            // Hero distance -- RN: heroSection paddingVertical xs(4), center
            heroDistance
                .padding(.top, RVSpacing.xs)

            // Dashboard grid 2x3
            statsGrid
                .padding(.horizontal, RVSpacing.xl)

            // Split history panel
            splitHistoryPanel
                .padding(.horizontal, RVSpacing.xl)

            // Control buttons -- RN: controls paddingVertical md(12), gap xxl(24)
            controlButtons
                .padding(.top, RVSpacing.md)
                .padding(.bottom, RVSpacing.md)
        }
        .safeAreaPadding(.top)
        .padding(.horizontal, RVSpacing.xl)
    }

    // MARK: - Top Bar

    // RN: hudTopBar flexDirection row, justifyContent space-between, alignItems center
    //     paddingVertical sm(8), marginTop xs(4)
    private var topBar: some View {
        HStack(spacing: RVSpacing.sm) {
            gpsChip

            // Mode chip -- RN: bg surface, borderRadius full, paddingHorizontal md(12), paddingVertical xs+2(6)
            Text(viewModel.isCourseRunning ? "코스 러닝" : "자유 러닝")
                .font(.system(size: RVFontSize.xs, weight: .semibold))
                .foregroundStyle(RVColors.textSecondary)
                .padding(.horizontal, RVSpacing.md)
                .padding(.vertical, RVSpacing.xs + 2)
                .background(
                    Capsule().fill(RVColors.surface)
                )

            // Watch chip -- RN: if watchConnected, padding xs+2(6), borderRadius full, bg surface
            // ViewModel does not expose watchConnected yet; show if Watch HR > 0
            if viewModel.heartRate > 0 {
                Image(systemName: "applewatch")
                    .font(.system(size: 12))
                    .foregroundStyle(RVColors.success)
                    .padding(RVSpacing.xs + 2)
                    .background(
                        Circle().fill(RVColors.surface)
                    )
            }

            // Metronome chip -- RN: if program goal + cadenceBPM > 0
            if let bpm = viewModel.goalBPM, bpm > 0 {
                HStack(spacing: 4) {
                    Image(systemName: "metronome")
                        .font(.system(size: 12))
                        .foregroundStyle(RVColors.primary)
                    Text("\(bpm)")
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.textSecondary)
                        .monospacedDigit()
                }
                .padding(.horizontal, RVSpacing.sm)
                .padding(.vertical, RVSpacing.xs + 2)
                .background(
                    Capsule().fill(RVColors.surface)
                )
            }

            Spacer()
        }
    }

    // MARK: - Mini Map

    // RN: miniMapContainer flex:1, minHeight 100, marginTop sm(8)
    // RN: miniMap flex:1, borderRadius lg(18), overflow hidden
    // RN: pausedBanner position absolute, bottom sm(8), alignSelf center
    //     flexDirection row, gap 5, bg #FFD60A, paddingHorizontal 14, paddingVertical 6, borderRadius 20
    // RN: pausedText fontSize 12, fontWeight 900, color #000, letterSpacing 1
    private var miniMapArea: some View {
        ZStack {
            // Map placeholder -- RN: fills flex:1 area
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.surface)
                .overlay(
                    Image(systemName: "map")
                        .font(.system(size: 32))
                        .foregroundStyle(RVColors.textTertiary)
                )

            // Paused banner overlay -- RN: absolute bottom, capsule, yellow bg
            if viewModel.phase == .paused || viewModel.isAutoPaused {
                VStack {
                    Spacer()
                    HStack(spacing: 5) {
                        Image(systemName: "pause.fill")
                            .font(.system(size: 12))
                        Text(viewModel.isAutoPaused && viewModel.phase != .paused ? "AUTO PAUSED" : "PAUSED")
                            .font(.system(size: 12, weight: .black))
                            .tracking(1)
                    }
                    .foregroundStyle(Color.black)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 6)
                    .background(
                        Capsule().fill(Color(hex: "FFD60A"))
                    )
                    .padding(.bottom, RVSpacing.sm)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(maxHeight: .infinity)
    }

    // MARK: - Hero Distance

    // RN: heroSection alignItems center, paddingVertical xs(4)
    // RN: heroValue fontSize 72, fontWeight 900, color text, fontVariant tabular-nums, lineHeight 80
    // RN: heroUnit fontSize xxl(24), fontWeight 700, color textSecondary
    // RN: heroValueRow flexDirection row, alignItems baseline, gap 6
    private var heroDistance: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(RunFormatters.formatDistance(meters: viewModel.distanceMeters))
                .font(.system(size: 72, weight: .black))
                .monospacedDigit()
                .foregroundStyle(RVColors.text)
                .lineSpacing(-8)
            Text("km")
                .font(.system(size: RVFontSize.xxl, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)
        }
        .padding(.vertical, RVSpacing.xs)
    }

    // MARK: - Stats Grid

    // RN: dashboardGrid bg surface, borderRadius lg(18), paddingVertical md(12), paddingHorizontal sm(8)
    // RN: dashboardRow flexDirection row, alignItems center, paddingVertical sm(8)
    // RN: dashboardRowDivider height 1, bg divider, marginHorizontal lg(16)
    // RN: dashboardCell flex:1, alignItems center, gap 3
    // RN: dashboardLabel fontSize xs(11), fontWeight 500, color textSecondary
    // RN: dashboardValue fontSize 22, fontWeight 800, color text, fontVariant tabular-nums
    // RN: dashboardDivider width 1, height 32, bg divider
    // RN: Time turns #FFD60A when paused or isAutoPaused
    // RN: Heart rate turns error color when heartRate > 0
    private var statsGrid: some View {
        VStack(spacing: 0) {
            // Row 1: Time | Avg Pace | Calories
            HStack(spacing: 0) {
                statCell(
                    label: "시간",
                    value: RunFormatters.formatDuration(seconds: viewModel.durationSeconds),
                    valueColor: (viewModel.isPaused || viewModel.isAutoPaused) ? Color(hex: "FFD60A") : RVColors.text
                )
                statDivider
                statCell(label: "평균 페이스", value: RunFormatters.formatPace(secondsPerKm: viewModel.avgPaceSecondsPerKm))
                statDivider
                statCell(label: "칼로리", value: "\(viewModel.calories)")
            }
            .padding(.vertical, RVSpacing.sm)

            // Row divider
            Rectangle()
                .fill(RVColors.divider)
                .frame(height: 1)
                .padding(.horizontal, RVSpacing.lg)

            // Row 2: Heart Rate | Cadence | Elevation
            HStack(spacing: 0) {
                statCell(
                    label: "심박수",
                    value: viewModel.heartRate > 0 ? "\(viewModel.heartRate)" : "--",
                    valueColor: viewModel.heartRate > 0 ? RVColors.error : RVColors.text
                )
                statDivider
                statCell(label: "케이던스", value: viewModel.cadence > 0 ? "\(viewModel.cadence)" : "--")
                statDivider
                statCell(
                    label: "고도",
                    value: viewModel.elevationGainMeters > 0 ? "+\(Int(viewModel.elevationGainMeters))" : "--"
                )
            }
            .padding(.vertical, RVSpacing.sm)
        }
        .padding(.vertical, RVSpacing.md)
        .padding(.horizontal, RVSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.surface)
        )
    }

    private func statCell(label: String, value: String, valueColor: Color = RVColors.text) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
            Text(value)
                .font(.system(size: 22, weight: .heavy))
                .monospacedDigit()
                .foregroundStyle(valueColor)
        }
        .frame(maxWidth: .infinity)
    }

    private var statDivider: some View {
        Rectangle()
            .fill(RVColors.divider)
            .frame(width: 1, height: 32)
    }

    // MARK: - Split History Panel

    // RN: SplitHistoryPanel -- bg surface, borderRadius md(14), marginTop sm(8)
    // Header: height 36, row, icon + "스플릿" + badge + preview pace + chevron
    // Expanded: scrollable list of splits (km | pace | elevation)
    private var splitHistoryPanel: some View {
        Group {
            if viewModel.splitCount > 0 {
                VStack(spacing: 0) {
                    // Header toggle
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            splitPanelExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "list.bullet")
                                .font(.system(size: 14))
                                .foregroundStyle(RVColors.primary)
                            Text("스플릿")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.text)

                            // Count badge
                            Text("\(viewModel.splitCount)")
                                .font(.system(size: RVFontSize.xs, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(RVColors.primary)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(
                                    RoundedRectangle(cornerRadius: RVRadius.xs)
                                        .fill(RVColors.primary.opacity(0.125))
                                )

                            Spacer()

                            // Preview pace when collapsed
                            if !splitPanelExpanded, let lastSplit = viewModel.lastSplit {
                                Text("\(lastSplit.kilometerIndex)km \(RunFormatters.formatPace(secondsPerKm: lastSplit.paceSecondsPerKm))")
                                    .font(.system(size: RVFontSize.xs, weight: .semibold))
                                    .monospacedDigit()
                                    .foregroundStyle(RVColors.textSecondary)
                            }

                            Image(systemName: splitPanelExpanded ? "chevron.down" : "chevron.up")
                                .font(.system(size: 14))
                                .foregroundStyle(RVColors.textTertiary)
                        }
                        .frame(height: 36)
                        .padding(.horizontal, RVSpacing.md)
                    }
                    .buttonStyle(.plain)

                    // Expandable split list
                    if splitPanelExpanded {
                        splitListContent
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .fill(RVColors.surface)
                )
                .clipShape(RoundedRectangle(cornerRadius: RVRadius.md))
                .padding(.top, RVSpacing.sm)
            }
        }
    }

    private var splitListContent: some View {
        VStack(spacing: 0) {
            // Column headers
            HStack(spacing: 0) {
                Text("km")
                    .frame(width: 36)
                Text("페이스")
                    .frame(maxWidth: .infinity)
                Text("고도")
                    .frame(width: 56, alignment: .trailing)
            }
            .font(.system(size: 10, weight: .medium))
            .foregroundStyle(RVColors.textTertiary)
            .textCase(.uppercase)
            .frame(height: 20)
            .padding(.horizontal, RVSpacing.md)

            Divider()
                .background(RVColors.divider)

            // Split rows (reversed, most recent on top)
            ForEach(viewModel.visibleSplits.reversed()) { split in
                HStack(spacing: 0) {
                    Text("\(split.kilometerIndex)")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                        .monospacedDigit()
                        .foregroundStyle(RVColors.textSecondary)
                        .frame(width: 36)

                    Text(RunFormatters.formatPace(secondsPerKm: split.paceSecondsPerKm))
                        .font(.system(size: RVFontSize.md, weight: .heavy))
                        .monospacedDigit()
                        .foregroundStyle(RVColors.text)
                        .frame(maxWidth: .infinity)

                    Text(formatElevation(split.elevationGainMeters))
                        .font(.system(size: RVFontSize.xs, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(RVColors.textTertiary)
                        .frame(width: 56, alignment: .trailing)
                }
                .frame(height: 32)
                .padding(.horizontal, RVSpacing.md)

                Divider()
                    .background(RVColors.divider)
            }
        }
    }

    private func formatElevation(_ meters: Double) -> String {
        if meters > 0 { return "+\(Int(meters.rounded()))m" }
        if meters < 0 { return "\(Int(meters.rounded()))m" }
        return "0m"
    }

    // MARK: - Control Buttons

    // RN: controls flexDirection row, justifyContent center, gap xxl(24), paddingVertical md(12)
    // RN: pauseButton 84x84, borderRadius 42, bg surfaceLight, gap xs(4)
    // RN: pauseLabel fontSize xs(11), fontWeight 600, color textSecondary
    // RN: resumeButton 84x84, borderRadius 42, bg primary, shadow
    // RN: resumeLabel fontSize xs(11), fontWeight 700, color white
    // RN: stopButton 84x84, borderRadius 42, bg primary, shadow
    // RN: stopLabel fontSize xs(11), fontWeight 700, color white
    private var controlButtons: some View {
        HStack(spacing: RVSpacing.xxl) {
            if viewModel.phase == .paused {
                // Resume button -- RN: bg primary, 84x84, shadow
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    viewModel.resume()
                } label: {
                    VStack(spacing: RVSpacing.xs) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 84, height: 84)
                    .background(
                        Circle()
                            .fill(RVColors.primary)
                            .shadow(color: RVColors.primary.opacity(0.4), radius: 16, y: 4)
                    )
                }

                // Stop button -- RN: bg primary, 84x84, shadow
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    _ = viewModel.stop()
                } label: {
                    VStack(spacing: RVSpacing.xs) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 84, height: 84)
                    .background(
                        Circle()
                            .fill(RVColors.primary)
                            .shadow(color: RVColors.primary.opacity(0.3), radius: 12, y: 4)
                    )
                }
            } else {
                // Pause button -- RN: bg surfaceLight, 84x84
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    viewModel.pause()
                } label: {
                    VStack(spacing: RVSpacing.xs) {
                        Image(systemName: "pause.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(RVColors.text)
                    }
                    .frame(width: 84, height: 84)
                    .background(
                        Circle().fill(RVColors.surfaceLight)
                    )
                }

                // Stop button -- RN: bg primary, 84x84, shadow
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    _ = viewModel.stop()
                } label: {
                    VStack(spacing: RVSpacing.xs) {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 28))
                            .foregroundStyle(.white)
                    }
                    .frame(width: 84, height: 84)
                    .background(
                        Circle()
                            .fill(RVColors.primary)
                            .shadow(color: RVColors.primary.opacity(0.3), radius: 12, y: 4)
                    )
                }
            }
        }
    }

    // MARK: - GPS Chip

    // RN: gpsChip flexDirection row, alignItems center, gap 6
    //     bg surface, paddingHorizontal md(12), paddingVertical xs+2(6), borderRadius full
    // RN: gpsDot 8x8 circle
    // RN: gpsChipText fontSize xs(11), fontWeight 600, color textSecondary
    private var gpsChip: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(viewModel.gpsStatus.color)
                .frame(width: 8, height: 8)
            Text(viewModel.gpsStatus.label)
                .font(.system(size: RVFontSize.xs, weight: .semibold))
                .foregroundStyle(RVColors.textSecondary)
        }
        .padding(.horizontal, RVSpacing.md)
        .padding(.vertical, RVSpacing.xs + 2)
        .background(
            Capsule().fill(RVColors.surface)
        )
    }
}

#Preview {
    RunningView()
}
