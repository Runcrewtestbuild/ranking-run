import SwiftUI

struct ActivityFeedView: View {
    @Environment(\.dismiss) private var dismiss

    struct FeedItem: Identifiable {
        let id: String
        let nickname: String
        let type: String // "run_completed" or "course_created"
        let distanceMeters: Double
        let durationSeconds: Int
        let paceSecondsPerKm: Double?
        let courseName: String?
        let timeAgo: String
    }

    private let feedItems: [FeedItem] = [
        FeedItem(id: "1", nickname: "marathon_queen", type: "run_completed", distanceMeters: 10_500, durationSeconds: 3420, paceSecondsPerKm: 326, courseName: "한강 반포 코스", timeAgo: "5분 전"),
        FeedItem(id: "2", nickname: "speed_king", type: "run_completed", distanceMeters: 5_200, durationSeconds: 1560, paceSecondsPerKm: 300, courseName: nil, timeAgo: "20분 전"),
        FeedItem(id: "3", nickname: "park_runner", type: "course_created", distanceMeters: 3_800, durationSeconds: 0, paceSecondsPerKm: nil, courseName: "올림픽공원 코스", timeAgo: "1시간 전"),
        FeedItem(id: "4", nickname: "night_owl", type: "run_completed", distanceMeters: 7_300, durationSeconds: 2628, paceSecondsPerKm: 360, courseName: nil, timeAgo: "2시간 전"),
        FeedItem(id: "5", nickname: "morning_bird", type: "run_completed", distanceMeters: 12_000, durationSeconds: 4200, paceSecondsPerKm: 350, courseName: "남산 순환 코스", timeAgo: "3시간 전"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: RVSpacing.md) {
                        ForEach(feedItems) { item in
                            feedCard(item)
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

            Text("활동 피드")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Feed Card

    private func feedCard(_ item: FeedItem) -> some View {
        let isRun = item.type == "run_completed"

        return VStack(alignment: .leading, spacing: RVSpacing.md) {
            // Header: avatar + name + time + badge
            HStack(spacing: RVSpacing.sm) {
                ZStack {
                    Circle()
                        .fill(RVColors.surfaceLight)
                        .frame(width: 44, height: 44)
                    Image(systemName: "person.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(RVColors.textTertiary)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.nickname)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)
                    Text(item.timeAgo)
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                }

                Spacer()

                ZStack {
                    RoundedRectangle(cornerRadius: 6)
                        .fill((isRun ? RVColors.primary : Color(hex: "3B82F6")).opacity(0.12))
                        .frame(width: 28, height: 28)
                    Image(systemName: isRun ? "figure.run" : "map")
                        .font(.system(size: 14))
                        .foregroundStyle(isRun ? RVColors.primary : Color(hex: "3B82F6"))
                }
            }

            // Stats
            if isRun {
                HStack(spacing: RVSpacing.xl) {
                    statColumn(value: RunFormatters.formatDistanceWithUnit(meters: item.distanceMeters), label: "거리")
                    statColumn(value: RunFormatters.formatDuration(seconds: item.durationSeconds), label: "시간")
                    statColumn(value: RunFormatters.formatPace(secondsPerKm: item.paceSecondsPerKm), label: "페이스")
                }
                .padding(.vertical, RVSpacing.sm)
            }

            // Course name
            if let course = item.courseName {
                HStack(spacing: RVSpacing.xs) {
                    Image(systemName: "map")
                        .font(.system(size: 12))
                        .foregroundStyle(RVColors.textTertiary)
                    Text(course)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }
        }
        .padding(RVSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.surface)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    private func statColumn(value: String, label: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: RVFontSize.md, weight: .heavy))
                .foregroundStyle(RVColors.text)
                .monospacedDigit()
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
        }
    }
}

#Preview {
    ActivityFeedView()
}
