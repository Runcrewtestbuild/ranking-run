import SwiftUI

struct HomeView: View {
    @Environment(AppState.self) private var appState

    // Mock data for display
    private let weeklySummary = WeeklySummary(
        totalDistanceMeters: 23_540,
        runCount: 4,
        totalDurationSeconds: 7200,
        avgPaceSecondsPerKm: 340,
        comparedToLastWeekPercent: 12.5
    )

    private let recentRuns: [RecentRun] = [
        RecentRun(id: "1", startedAt: .now.addingTimeInterval(-3600), distanceMeters: 5230, durationSeconds: 1620, avgPaceSecondsPerKm: 310, title: "Morning Run"),
        RecentRun(id: "2", startedAt: .now.addingTimeInterval(-86400), distanceMeters: 8100, durationSeconds: 2880, avgPaceSecondsPerKm: 356, courseTitle: "Han River Loop"),
        RecentRun(id: "3", startedAt: .now.addingTimeInterval(-172800), distanceMeters: 3200, durationSeconds: 1140, avgPaceSecondsPerKm: 356, title: "Recovery Run"),
    ]

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 6 { return "Good Night" }
        if hour < 12 { return "Good Morning" }
        if hour < 18 { return "Good Afternoon" }
        return "Good Evening"
    }

    private var todayLabel: String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "M월 d일 EEEE"
        return formatter.string(from: Date())
    }

    var body: some View {
        ZStack {
            RVColors.background
                .ignoresSafeArea()

            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // Header: RUNVS + icons — RN: paddingHorizontal 24, paddingTop 8, paddingBottom 8
                    header
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.sm)
                        .padding(.bottom, RVSpacing.sm)

                    // Greeting — RN: paddingTop 12 (md), paddingBottom 16 (lg)
                    greetingSection
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.top, RVSpacing.md)
                        .padding(.bottom, RVSpacing.lg)

                    // Weekly Summary Card — RN: marginHorizontal 24, marginBottom 12
                    weeklySummaryCard
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.bottom, RVSpacing.md)

                    // Start Running CTA — RN: marginHorizontal 24, marginBottom 12
                    ctaButton
                        .padding(.horizontal, RVSpacing.xxl)
                        .padding(.bottom, RVSpacing.md)

                    // Recent Runs
                    recentRunsSection

                    // Bottom padding for tab bar
                    Color.clear.frame(height: 100)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    // RN: logoText fontSize 28 (title), fontWeight 900, letterSpacing 1.5
    // RN: headerRight gap md (12), icons size 24
    private var header: some View {
        HStack {
            Text("RUNVS")
                .font(.system(size: RVFontSize.title, weight: .black))
                .tracking(1.5)
                .foregroundStyle(RVColors.text)

            Spacer()

            // RN: headerRight gap md (12)
            HStack(spacing: RVSpacing.md) {
                Button { } label: {
                    Image(systemName: "person.2")
                        .font(.system(size: 24))
                        .foregroundStyle(RVColors.text)
                }

                Button { } label: {
                    Image(systemName: "bell")
                        .font(.system(size: 24))
                        .foregroundStyle(RVColors.text)
                }
            }
        }
    }

    // MARK: - Greeting

    // RN: greetingText fontSize 24 (xxl), fontWeight 800, letterSpacing -0.3
    // RN: greetingSubText fontSize 13, fontWeight 500, marginTop 4
    private var greetingSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.xs) {
            Text("\(greeting), \(appState.currentUser?.nickname ?? appState.nickname)")
                .font(.system(size: RVFontSize.xxl, weight: .heavy))
                .tracking(-0.3)
                .foregroundStyle(RVColors.text)

            Text(todayLabel)
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Weekly Summary Card

    // RN: card borderRadius 18, padding 20, gap 12, overlaid on hero image with dark overlay
    private var weeklySummaryCard: some View {
        VStack(spacing: RVSpacing.md) {
            // Title row
            HStack {
                HStack(spacing: RVSpacing.xs) {
                    Image(systemName: "calendar")
                        .font(.system(size: 14))
                        .foregroundStyle(.white)
                    Text("이번 주 요약")
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(.white)
                }

                Spacer()

                if let change = weeklySummary.comparedToLastWeekPercent, change != 0 {
                    Text("\(change > 0 ? "+" : "")\(Int(change))%")
                        .font(.system(size: RVFontSize.sm, weight: .heavy))
                        .foregroundStyle(change > 0 ? RVColors.success : RVColors.error)
                }
            }

            // Hero distance — RN: fontSize 48, fontWeight 900, letterSpacing -1
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(RunFormatters.metersToKm(weeklySummary.totalDistanceMeters, decimals: 1))
                    .font(.system(size: 48, weight: .black))
                    .tracking(-1)
                    .foregroundStyle(.white)
                Text("km")
                    .font(.system(size: RVFontSize.lg, weight: .semibold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Mini stats row
            HStack(spacing: 0) {
                miniStat(icon: "flag", value: "\(weeklySummary.runCount)", label: "\(weeklySummary.runCount)회")
                miniDivider
                miniStat(icon: "clock", value: RunFormatters.formatDuration(seconds: weeklySummary.totalDurationSeconds), label: "시간")
                miniDivider
                miniStat(icon: "speedometer", value: RunFormatters.formatPace(secondsPerKm: weeklySummary.avgPaceSecondsPerKm), label: "평균 페이스")
            }
        }
        .padding(RVSpacing.xl) // 20
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg) // 18
                .fill(
                    LinearGradient(
                        colors: [RVColors.primary, RVColors.primaryDark],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }

    private func miniStat(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.7))
            Text(value)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(.white)
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(.white.opacity(0.6))
        }
        .frame(maxWidth: .infinity)
    }

    // RN: height 28, bg white 0.2
    private var miniDivider: some View {
        Rectangle()
            .fill(.white.opacity(0.2))
            .frame(width: 1, height: 28)
    }

    // MARK: - CTA Button
    // RN: borderRadius 18 (lg), paddingVertical 16 (lg), gap 8, shadow glow

    private var ctaButton: some View {
        Button { } label: {
            HStack(spacing: RVSpacing.sm) {
                Image(systemName: "play.fill")
                    .font(.system(size: 18)) // RN: Ionicons "play" size 18
                Text("달리기 시작하기")
                    .font(.system(size: RVFontSize.md, weight: .heavy))
                    .tracking(0.3)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.lg) // 16
            .background(RVColors.primary)
            .clipShape(RoundedRectangle(cornerRadius: RVRadius.lg)) // 18
            .shadow(color: Color(hex: "FF7A33").opacity(0.3), radius: 12, y: 4) // glow shadow
        }
    }

    // MARK: - Recent Runs

    // RN: card marginHorizontal 24, bg card, borderRadius 18 (lg), padding 20 (xl), gap 12, border 1
    private var recentRunsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            HStack {
                HStack(spacing: RVSpacing.xs) {
                    Image(systemName: "clock.arrow.circlepath")
                        .font(.system(size: 14))
                        .foregroundStyle(RVColors.primary)
                    Text("최근 러닝")
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                }

                Spacer()

                // RN: seeAllText color primary, fontSize 13, fontWeight 600
                Button { } label: {
                    Text("더 보기")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.primary)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)

            VStack(spacing: RVSpacing.sm) {
                ForEach(recentRuns) { run in
                    recentRunRow(run)
                }
            }
            .padding(.horizontal, RVSpacing.xxl)
        }
    }

    // RN: 80x80 thumbnail, borderRadius 10
    private func recentRunRow(_ run: RecentRun) -> some View {
        HStack(spacing: RVSpacing.md) {
            // Thumbnail placeholder — RN: 80x80, borderRadius 10
            ZStack {
                RoundedRectangle(cornerRadius: RVRadius.sm) // 10
                    .fill(RVColors.surface)
                    .frame(width: 80, height: 80)
                Image(systemName: "figure.run")
                    .font(.system(size: 24))
                    .foregroundStyle(RVColors.primary)
            }

            // Info
            VStack(alignment: .leading, spacing: 2) {
                Text(run.title ?? run.courseTitle ?? "자유 러닝")
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)
                Text("\(RunFormatters.formatDistanceWithUnit(meters: run.distanceMeters)) \u{00B7} \(RunFormatters.formatPace(secondsPerKm: run.avgPaceSecondsPerKm))")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
            }

            Spacer()

            // Duration
            Text(RunFormatters.formatDuration(seconds: run.durationSeconds))
                .font(.system(size: RVFontSize.sm, weight: .semibold, design: .monospaced))
                .foregroundStyle(RVColors.textSecondary)
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
    HomeView()
        .environment(AppState())
}
