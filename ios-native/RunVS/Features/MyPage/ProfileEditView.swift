import SwiftUI

struct ProfileEditView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var nickname = "runner_kim"
    @State private var bio = ""
    @State private var heightCm = ""
    @State private var weightKg = ""
    @State private var isSaving = false

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xxl) {
                        // Avatar section
                        avatarSection

                        // Nickname
                        fieldGroup(label: "닉네임", placeholder: "닉네임 입력", text: $nickname, maxLength: 20)

                        // Bio
                        VStack(alignment: .leading, spacing: RVSpacing.sm) {
                            Text("소개")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.textSecondary)

                            TextEditor(text: $bio)
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

                        // Body measurements
                        bodySection

                        // Save button
                        saveButton
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

            Text("프로필 편집")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        VStack(spacing: RVSpacing.md) {
            ZStack(alignment: .bottomTrailing) {
                Circle()
                    .fill(RVColors.surface)
                    .frame(width: 96, height: 96)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(RVColors.textTertiary)
                    )

                Button { } label: {
                    Image(systemName: "camera.fill")
                        .font(.system(size: 14))
                        .foregroundStyle(RVColors.white)
                        .frame(width: 32, height: 32)
                        .background(RVColors.primary)
                        .clipShape(Circle())
                        .overlay(
                            Circle()
                                .stroke(RVColors.background, lineWidth: 3)
                        )
                }
            }

            Text("사진 변경")
                .font(.system(size: RVFontSize.sm, weight: .semibold))
                .foregroundStyle(RVColors.primary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, RVSpacing.lg)
    }

    // MARK: - Field Group

    private func fieldGroup(label: String, placeholder: String, text: Binding<String>, maxLength: Int) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text(label)
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            TextField(placeholder, text: text)
                .font(.system(size: RVFontSize.md, weight: .semibold))
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
                    if newValue.count > maxLength {
                        text.wrappedValue = String(newValue.prefix(maxLength))
                    }
                }

            Text("\(text.wrappedValue.count)/\(maxLength)")
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
                .monospacedDigit()
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    // MARK: - Body Section

    private var bodySection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("신체 정보")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            HStack(spacing: RVSpacing.md) {
                numericField(label: "키 (cm)", text: $heightCm, placeholder: "170")
                numericField(label: "몸무게 (kg)", text: $weightKg, placeholder: "65")
            }
        }
    }

    private func numericField(label: String, text: Binding<String>, placeholder: String) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.xs) {
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)

            TextField(placeholder, text: text)
                .keyboardType(.numberPad)
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)
                .monospacedDigit()
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

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            isSaving = true
            DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                isSaving = false
                dismiss()
            }
        } label: {
            Text(isSaving ? "저장 중..." : "저장")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(RVColors.primary)
                )
        }
        .disabled(isSaving)
    }
}

#Preview {
    ProfileEditView()
}
