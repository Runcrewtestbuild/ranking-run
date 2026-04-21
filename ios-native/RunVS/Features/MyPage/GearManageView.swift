import SwiftUI

struct GearManageView: View {
    @Environment(\.dismiss) private var dismiss

    struct GearItem: Identifiable {
        let id: String
        var brand: String
        var modelName: String
        var totalDistanceMeters: Double
        var isActive: Bool
    }

    @State private var gearList: [GearItem] = [
        GearItem(id: "1", brand: "Nike", modelName: "Pegasus 41", totalDistanceMeters: 342_000, isActive: true),
        GearItem(id: "2", brand: "Asics", modelName: "Gel-Nimbus 26", totalDistanceMeters: 128_000, isActive: true),
        GearItem(id: "3", brand: "Hoka", modelName: "Clifton 9", totalDistanceMeters: 560_000, isActive: false),
    ]

    @State private var showAddSheet = false

    private let brandNames = ["Nike", "Adidas", "New Balance", "Asics", "Hoka", "Brooks", "Saucony", "On", "Mizuno", "Puma", "Salomon", "Altra", "기타"]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.md) {
                        ForEach(gearList) { gear in
                            gearCard(gear)
                        }

                        // Add button
                        addGearButton
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

            Text("장비 관리")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { showAddSheet = true } label: {
                Image(systemName: "plus")
                    .font(.system(size: 20))
                    .foregroundStyle(RVColors.primary)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Gear Card

    private func gearCard(_ gear: GearItem) -> some View {
        HStack(spacing: RVSpacing.md) {
            // Shoe icon
            ZStack {
                RoundedRectangle(cornerRadius: RVRadius.md)
                    .fill(RVColors.primary.opacity(0.1))
                    .frame(width: 52, height: 52)
                Image(systemName: "shoe.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(gear.isActive ? RVColors.primary : RVColors.textTertiary)
            }

            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: RVSpacing.sm) {
                    Text(gear.brand)
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(RVColors.primary.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 4))

                    Text(gear.modelName)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                        .lineLimit(1)
                }

                HStack(spacing: RVSpacing.sm) {
                    Text(RunFormatters.formatDistanceWithUnit(meters: gear.totalDistanceMeters))
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textSecondary)
                        .monospacedDigit()

                    if !gear.isActive {
                        Text("은퇴")
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(RVColors.textTertiary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(RVColors.surfaceLight)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                    }
                }
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.system(size: 14))
                .foregroundStyle(RVColors.textTertiary)
        }
        .padding(RVSpacing.md)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Add Button

    private var addGearButton: some View {
        Button { showAddSheet = true } label: {
            HStack(spacing: RVSpacing.sm) {
                Image(systemName: "plus.circle.fill")
                    .font(.system(size: 20))
                Text("장비 추가")
                    .font(.system(size: RVFontSize.md, weight: .bold))
            }
            .foregroundStyle(RVColors.primary)
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.lg)
            .background(
                RoundedRectangle(cornerRadius: RVRadius.lg)
                    .fill(RVColors.primary.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .stroke(RVColors.primary.opacity(0.2), lineWidth: 1)
                    )
            )
        }
    }
}

#Preview {
    GearManageView()
}
