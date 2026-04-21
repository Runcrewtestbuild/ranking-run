import SwiftUI

struct PointHistoryView: View {
    @Environment(\.dismiss) private var dismiss

    struct PointTransaction: Identifiable {
        let id: String
        let txType: String
        let amount: Int
        let date: String
    }

    private static let txConfig: [String: (icon: String, color: Color, label: String)] = [
        "run_earn": ("figure.walk", Color(hex: "34C759"), "런닝 적립"),
        "course_bonus": ("trophy", Color(hex: "FF9500"), "코스 보너스"),
        "crew_create": ("person.2", Color(hex: "FF3B30"), "크루 생성"),
        "daily_checkin": ("calendar", Color(hex: "5856D6"), "출석 체크"),
        "course_create": ("map", Color(hex: "007AFF"), "코스 생성"),
    ]

    private let currentPoints = 2_450

    private let transactions: [PointTransaction] = [
        PointTransaction(id: "1", txType: "run_earn", amount: 50, date: "2026.04.06"),
        PointTransaction(id: "2", txType: "daily_checkin", amount: 10, date: "2026.04.06"),
        PointTransaction(id: "3", txType: "course_bonus", amount: 100, date: "2026.04.05"),
        PointTransaction(id: "4", txType: "run_earn", amount: 35, date: "2026.04.05"),
        PointTransaction(id: "5", txType: "crew_create", amount: -500, date: "2026.04.04"),
        PointTransaction(id: "6", txType: "course_create", amount: 200, date: "2026.04.03"),
        PointTransaction(id: "7", txType: "run_earn", amount: 45, date: "2026.04.03"),
        PointTransaction(id: "8", txType: "daily_checkin", amount: 10, date: "2026.04.02"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                // Current points banner
                pointsBanner
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.xl)

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 0) {
                        ForEach(transactions) { tx in
                            transactionRow(tx)
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

            Text("포인트 내역")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Points Banner

    private var pointsBanner: some View {
        HStack {
            VStack(alignment: .leading, spacing: RVSpacing.xs) {
                Text("보유 포인트")
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)
                HStack(spacing: RVSpacing.sm) {
                    Image(systemName: "star.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(RVColors.gold)
                    Text(RunFormatters.formatNumber(currentPoints))
                        .font(.system(size: RVFontSize.xxl, weight: .heavy))
                        .foregroundStyle(RVColors.text)
                        .monospacedDigit()
                }
            }

            Spacer()
        }
        .padding(RVSpacing.xl)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Transaction Row

    private func transactionRow(_ tx: PointTransaction) -> some View {
        let config = Self.txConfig[tx.txType] ?? Self.txConfig["run_earn"]!
        let isPositive = tx.amount > 0

        return HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(config.color.opacity(0.1))
                    .frame(width: 36, height: 36)
                Image(systemName: config.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(config.color)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(config.label)
                    .font(.system(size: RVFontSize.md, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                Text(tx.date)
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()

            Text("\(isPositive ? "+" : "")\(tx.amount)")
                .font(.system(size: RVFontSize.md, weight: .heavy))
                .foregroundStyle(isPositive ? RVColors.success : RVColors.error)
                .monospacedDigit()
        }
        .padding(.vertical, RVSpacing.md)
        .overlay(
            Rectangle()
                .fill(RVColors.border)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }
}

#Preview {
    PointHistoryView()
}
