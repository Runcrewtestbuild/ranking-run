import SwiftUI

struct CrewCreateView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var name = ""
    @State private var description = ""
    @State private var region = ""
    @State private var recurringSchedule = ""
    @State private var meetingPoint = ""
    @State private var maxMembers = ""
    @State private var selectedColor = "FF7A33"
    @State private var requiresApproval = false
    @State private var isSubmitting = false

    private let badgeColors = ["FF7A33", "FF5252", "34C759", "007AFF", "AF52DE", "FF9500"]
    private let creationCost = 500

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !region.trimmingCharacters(in: .whitespaces).isEmpty
            && !isSubmitting
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xl) {
                        // Cost info
                        costBanner

                        // Name
                        formField(label: "크루 이름 *", placeholder: "크루 이름 입력", text: $name, maxLength: 20)

                        // Region
                        formField(label: "활동 지역 *", placeholder: "서울, 경기 등", text: $region)

                        // Description
                        VStack(alignment: .leading, spacing: RVSpacing.sm) {
                            Text("소개")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.textSecondary)

                            TextEditor(text: $description)
                                .font(.system(size: RVFontSize.md))
                                .foregroundStyle(RVColors.text)
                                .scrollContentBackground(.hidden)
                                .frame(minHeight: 80)
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

                        // Schedule
                        formField(label: "정기 런닝 일정", placeholder: "매주 수요일 저녁 7시", text: $recurringSchedule)

                        // Meeting point
                        formField(label: "모임 장소", placeholder: "한강공원 여의도 입구", text: $meetingPoint)

                        // Max members
                        formField(label: "최대 멤버 수", placeholder: "비워두면 제한 없음", text: $maxMembers, keyboardType: .numberPad)

                        // Badge color
                        colorPicker

                        // Approval toggle
                        approvalToggle

                        // Submit
                        submitButton
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

            Text("크루 만들기")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Cost Banner

    private var costBanner: some View {
        HStack(spacing: RVSpacing.md) {
            Image(systemName: "star.fill")
                .font(.system(size: 20))
                .foregroundStyle(RVColors.gold)

            VStack(alignment: .leading, spacing: 2) {
                Text("크루 생성 비용")
                    .font(.system(size: RVFontSize.sm, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text("\(creationCost) 포인트가 차감됩니다")
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()
        }
        .padding(RVSpacing.lg)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.gold.opacity(0.08))
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .stroke(RVColors.gold.opacity(0.2), lineWidth: 1)
                )
        )
    }

    // MARK: - Form Field

    private func formField(
        label: String,
        placeholder: String,
        text: Binding<String>,
        maxLength: Int? = nil,
        keyboardType: UIKeyboardType = .default
    ) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text(label)
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            TextField(placeholder, text: text)
                .keyboardType(keyboardType)
                .font(.system(size: RVFontSize.md, weight: .medium))
                .foregroundStyle(RVColors.text)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .fill(RVColors.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.md)
                                .stroke(RVColors.border, lineWidth: 1)
                        )
                )
                .onChange(of: text.wrappedValue) { _, newValue in
                    if let maxLength, newValue.count > maxLength {
                        text.wrappedValue = String(newValue.prefix(maxLength))
                    }
                }

            if let maxLength {
                Text("\(text.wrappedValue.count)/\(maxLength)")
                    .font(.system(size: RVFontSize.xs))
                    .foregroundStyle(RVColors.textTertiary)
                    .monospacedDigit()
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    // MARK: - Color Picker

    private var colorPicker: some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text("배지 색상")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            HStack(spacing: RVSpacing.md) {
                ForEach(badgeColors, id: \.self) { hex in
                    Button {
                        selectedColor = hex
                    } label: {
                        Circle()
                            .fill(Color(hex: hex))
                            .frame(width: 36, height: 36)
                            .overlay(
                                Circle()
                                    .stroke(RVColors.white, lineWidth: selectedColor == hex ? 3 : 0)
                            )
                            .overlay(
                                Circle()
                                    .stroke(Color(hex: hex).opacity(0.5), lineWidth: selectedColor == hex ? 1 : 0)
                                    .padding(-2)
                            )
                    }
                }

                Spacer()
            }
        }
    }

    // MARK: - Approval Toggle

    private var approvalToggle: some View {
        HStack {
            VStack(alignment: .leading, spacing: RVSpacing.xs) {
                Text("가입 승인 필요")
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                Text("관리자가 가입을 승인해야 멤버가 됩니다")
                    .font(.system(size: RVFontSize.sm))
                    .foregroundStyle(RVColors.textSecondary)
            }

            Spacer()

            Toggle("", isOn: $requiresApproval)
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

    // MARK: - Submit

    private var submitButton: some View {
        Button {
            isSubmitting = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                isSubmitting = false
                dismiss()
            }
        } label: {
            Text(isSubmitting ? "생성 중..." : "크루 만들기")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(canSubmit ? RVColors.white : RVColors.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(canSubmit ? RVColors.primary : RVColors.surfaceLight)
                )
        }
        .disabled(!canSubmit)
    }
}

#Preview {
    CrewCreateView()
}
