import SwiftUI

struct GroupRunCreateView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var maxParticipants = "10"
    @State private var selectedDate = Date()
    @State private var selectedCourse: String?
    @State private var isSubmitting = false

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty && !isSubmitting
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xl) {
                        // Title
                        formField(label: "그룹 런 제목", placeholder: "예: 한강 야간 러닝", text: $title, maxLength: 30)

                        // Date picker
                        VStack(alignment: .leading, spacing: RVSpacing.sm) {
                            Text("일시")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.textSecondary)

                            DatePicker("", selection: $selectedDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                                .datePickerStyle(.compact)
                                .tint(RVColors.primary)
                                .colorScheme(.dark)
                        }

                        // Max participants
                        formField(label: "최대 참가자", placeholder: "10", text: $maxParticipants, keyboardType: .numberPad)

                        // Course selection (mock)
                        VStack(alignment: .leading, spacing: RVSpacing.sm) {
                            Text("코스 선택 (선택)")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.textSecondary)

                            Button { } label: {
                                HStack {
                                    Image(systemName: "map")
                                        .font(.system(size: 18))
                                        .foregroundStyle(RVColors.textTertiary)
                                    Text(selectedCourse ?? "코스를 선택하세요")
                                        .font(.system(size: RVFontSize.md, weight: .medium))
                                        .foregroundStyle(selectedCourse != nil ? RVColors.text : RVColors.textTertiary)

                                    Spacer()

                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 14))
                                        .foregroundStyle(RVColors.textTertiary)
                                }
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
                            }
                        }

                        // Submit
                        Button {
                            isSubmitting = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                                isSubmitting = false
                                dismiss()
                            }
                        } label: {
                            Text(isSubmitting ? "생성 중..." : "그룹 런 만들기")
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

            Text("그룹 런 만들기")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
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
}

#Preview {
    GroupRunCreateView()
}
