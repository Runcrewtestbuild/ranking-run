import SwiftUI

struct CourseCreateView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var description = ""
    @State private var isPublic = true
    @State private var isSubmitting = false

    // Mock run data (would come from a completed run)
    private let distanceMeters: Double = 5230
    private let elevationGainMeters: Double = 42

    private var isDisabled: Bool {
        isSubmitting || title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xl) {
                        // Map preview placeholder
                        mapPreview

                        // Route info summary
                        routeInfoRow

                        // Title input
                        inputGroup(
                            label: "코스 이름",
                            placeholder: "예: 한강 반포 코스",
                            text: $title,
                            maxLength: 30
                        )

                        // Description input
                        VStack(alignment: .leading, spacing: RVSpacing.sm) {
                            Text("설명")
                                .font(.system(size: RVFontSize.sm, weight: .semibold))
                                .foregroundStyle(RVColors.textSecondary)

                            TextEditor(text: $description)
                                .font(.system(size: RVFontSize.lg))
                                .foregroundStyle(RVColors.text)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 88)
                                .padding(.horizontal, RVSpacing.xs)
                                .padding(.vertical, RVSpacing.md)
                                .background(RVColors.card)
                                .overlay(
                                    Rectangle()
                                        .fill(RVColors.border)
                                        .frame(height: 2),
                                    alignment: .bottom
                                )
                        }

                        // Public toggle
                        publicToggle

                        // Submit button
                        submitButton
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
                Text("<")
                    .font(.system(size: RVFontSize.xxl, weight: .light))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 40, height: 40)
            }

            Spacer()

            Text("코스 만들기")
                .font(.system(size: RVFontSize.xl, weight: .heavy))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 40, height: 40)
        }
        .padding(.horizontal, RVSpacing.sm)
        .padding(.top, RVSpacing.md)
        .padding(.bottom, RVSpacing.sm)
    }

    // MARK: - Map Preview

    private var mapPreview: some View {
        ZStack {
            RVColors.surface
            Image(systemName: "map")
                .font(.system(size: 40))
                .foregroundStyle(RVColors.textTertiary)
        }
        .frame(height: 200)
        .clipShape(RoundedRectangle(cornerRadius: RVRadius.xl))
    }

    // MARK: - Route Info

    private var routeInfoRow: some View {
        HStack {
            VStack(spacing: RVSpacing.xs) {
                Text(RunFormatters.formatDistanceWithUnit(meters: distanceMeters))
                    .font(.system(size: RVFontSize.xxl, weight: .heavy))
                    .foregroundStyle(RVColors.text)
                    .monospacedDigit()
                Text("거리")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .frame(maxWidth: .infinity)

            Rectangle()
                .fill(RVColors.divider)
                .frame(width: 1, height: 32)

            VStack(spacing: RVSpacing.xs) {
                Text("+\(Int(elevationGainMeters))m")
                    .font(.system(size: RVFontSize.xxl, weight: .heavy))
                    .foregroundStyle(RVColors.text)
                    .monospacedDigit()
                Text("고도 상승")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }
            .frame(maxWidth: .infinity)
        }
        .padding(.vertical, RVSpacing.xl)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.surface)
        )
    }

    // MARK: - Input Group

    private func inputGroup(label: String, placeholder: String, text: Binding<String>, maxLength: Int) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text(label)
                .font(.system(size: RVFontSize.sm, weight: .semibold))
                .foregroundStyle(RVColors.textSecondary)

            TextField(placeholder, text: text)
                .font(.system(size: RVFontSize.lg, weight: .medium))
                .foregroundStyle(RVColors.text)
                .padding(.vertical, RVSpacing.md)
                .padding(.horizontal, RVSpacing.xs)
                .background(RVColors.card)
                .overlay(
                    Rectangle()
                        .fill(RVColors.border)
                        .frame(height: 2),
                    alignment: .bottom
                )
                .onChange(of: text.wrappedValue) { _, newValue in
                    if newValue.count > maxLength {
                        text.wrappedValue = String(newValue.prefix(maxLength))
                    }
                }

            Text("\(text.wrappedValue.count)/\(maxLength)")
                .font(.system(size: RVFontSize.xs))
                .foregroundStyle(RVColors.textTertiary)
                .monospacedDigit()
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    // MARK: - Public Toggle

    private var publicToggle: some View {
        HStack {
            VStack(alignment: .leading, spacing: RVSpacing.xs) {
                Text("공개 코스")
                    .font(.system(size: RVFontSize.lg, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text("다른 러너들이 이 코스를 검색하고 달릴 수 있습니다")
                    .font(.system(size: RVFontSize.sm))
                    .foregroundStyle(RVColors.textSecondary)
                    .lineSpacing(5)
            }

            Spacer()

            Toggle("", isOn: $isPublic)
                .tint(RVColors.primary)
                .labelsHidden()
        }
        .padding(.vertical, RVSpacing.lg)
        .overlay(
            Rectangle().fill(RVColors.divider).frame(height: 1),
            alignment: .top
        )
        .overlay(
            Rectangle().fill(RVColors.divider).frame(height: 1),
            alignment: .bottom
        )
    }

    // MARK: - Submit Button

    private var submitButton: some View {
        Button {
            isSubmitting = true
            // Mock submit
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                isSubmitting = false
                dismiss()
            }
        } label: {
            Text(isSubmitting ? "등록 중..." : "코스 등록")
                .font(.system(size: RVFontSize.xl, weight: .heavy))
                .tracking(0.5)
                .foregroundStyle(isDisabled ? RVColors.textTertiary : RVColors.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg + 2)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(isDisabled ? RVColors.surfaceLight : RVColors.primary)
                )
        }
        .disabled(isDisabled)
    }
}

#Preview {
    CourseCreateView()
}
