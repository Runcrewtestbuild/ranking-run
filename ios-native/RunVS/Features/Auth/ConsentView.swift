import SwiftUI

struct ConsentView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var checked: [String: Bool] = [
        "terms": false,
        "privacy": false,
        "location": false,
        "contacts": false,
        "marketing": false,
    ]
    @State private var expandedKey: String? = nil

    private let consentItems: [ConsentItem] = [
        ConsentItem(key: "terms", label: "서비스 이용약관", required: true),
        ConsentItem(key: "privacy", label: "개인정보 처리방침", required: true),
        ConsentItem(key: "location", label: "위치정보 이용 동의", required: true, expandable: true, expandedText: "러닝 중 GPS 위치 정보를 수집하여 경로를 기록합니다. 위치 정보는 러닝 기록 및 코스 생성에 사용됩니다."),
        ConsentItem(key: "contacts", label: "연락처 접근 동의", required: false, description: "친구 찾기에 사용됩니다"),
        ConsentItem(key: "marketing", label: "마케팅 수신 동의", required: false, description: "이벤트 및 혜택 알림을 받습니다"),
    ]

    private var allRequiredChecked: Bool {
        consentItems.filter(\.required).allSatisfy { checked[$0.key] == true }
    }

    private var allChecked: Bool {
        consentItems.allSatisfy { checked[$0.key] == true }
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                VStack(alignment: .leading, spacing: RVSpacing.sm) {
                    Text("약관 동의")
                        .font(.system(size: RVFontSize.title, weight: .heavy))
                        .tracking(-0.5)
                        .foregroundStyle(RVColors.text)
                    Text("서비스 이용을 위해 약관에 동의해주세요")
                        .font(.system(size: RVFontSize.md, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, RVSpacing.xxl)
                .padding(.top, RVSpacing.xxxl)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.lg) {
                        // All agree card
                        allAgreeCard
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xxl)

                        // Individual items
                        itemsCard
                            .padding(.horizontal, RVSpacing.xxl)
                    }
                }

                Spacer()

                // Submit button
                submitButton
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - All Agree Card

    // RN: allAgreeCard bg card, borderRadius lg, border 1, padding xl
    private var allAgreeCard: some View {
        Button {
            let newVal = !allChecked
            for item in consentItems {
                checked[item.key] = newVal
            }
        } label: {
            HStack(spacing: RVSpacing.lg) {
                checkboxCircle(isChecked: allChecked, size: 26)

                VStack(alignment: .leading, spacing: 2) {
                    Text("전체 동의")
                        .font(.system(size: RVFontSize.lg, weight: .bold))
                        .foregroundStyle(RVColors.text)
                    Text("필수 및 선택 항목을 모두 동의합니다")
                        .font(.system(size: RVFontSize.sm))
                        .foregroundStyle(RVColors.textTertiary)
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
    }

    // MARK: - Items Card

    // RN: itemsCard bg card, borderRadius lg, border 1, overflow hidden
    private var itemsCard: some View {
        VStack(spacing: 0) {
            ForEach(Array(consentItems.enumerated()), id: \.element.key) { index, item in
                VStack(spacing: 0) {
                    HStack(spacing: 0) {
                        // Checkbox
                        Button {
                            checked[item.key]?.toggle()
                        } label: {
                            checkboxCircle(isChecked: checked[item.key] == true)
                        }
                        .padding(.trailing, RVSpacing.md)

                        // Label
                        VStack(alignment: .leading, spacing: 1) {
                            HStack(spacing: RVSpacing.xs) {
                                Text(item.required ? "[필수]" : "[선택]")
                                    .font(.system(size: RVFontSize.xs, weight: .bold))
                                    .foregroundStyle(item.required ? RVColors.primary : RVColors.textTertiary)
                                Text(item.label)
                                    .font(.system(size: RVFontSize.md, weight: .semibold))
                                    .foregroundStyle(RVColors.text)
                            }
                            if let desc = item.description {
                                Text(desc)
                                    .font(.system(size: RVFontSize.xs))
                                    .foregroundStyle(RVColors.textTertiary)
                            }
                        }

                        Spacer()

                        // Expand / navigate chevron
                        if item.expandable {
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    expandedKey = expandedKey == item.key ? nil : item.key
                                }
                            } label: {
                                Image(systemName: expandedKey == item.key ? "chevron.up" : "chevron.down")
                                    .font(.system(size: 14))
                                    .foregroundStyle(RVColors.textTertiary)
                            }
                        } else if item.required {
                            Image(systemName: "chevron.right")
                                .font(.system(size: 14))
                                .foregroundStyle(RVColors.textTertiary)
                        }
                    }
                    .padding(.horizontal, RVSpacing.xl)
                    .padding(.vertical, RVSpacing.lg)

                    // Expanded text
                    if item.expandable && expandedKey == item.key, let text = item.expandedText {
                        Text(text)
                            .font(.system(size: RVFontSize.sm))
                            .foregroundStyle(RVColors.textSecondary)
                            .lineSpacing(4)
                            .padding(.horizontal, RVSpacing.xl + 22 + RVSpacing.md) // Aligned with label
                            .padding(.bottom, RVSpacing.lg)
                    }

                    if index < consentItems.count - 1 {
                        Rectangle()
                            .fill(RVColors.divider)
                            .frame(height: 1)
                            .padding(.horizontal, RVSpacing.xl)
                    }
                }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: RVRadius.lg)
                .fill(RVColors.card)
                .overlay(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .stroke(RVColors.border, lineWidth: 1)
                )
        )
    }

    // MARK: - Submit Button

    private var submitButton: some View {
        Button { } label: {
            Text("동의하고 계속하기")
                .font(.system(size: RVFontSize.md, weight: .heavy))
                .foregroundStyle(allRequiredChecked ? .white : RVColors.textTertiary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(allRequiredChecked ? RVColors.primary : RVColors.surface)
                )
        }
        .disabled(!allRequiredChecked)
        .padding(.horizontal, RVSpacing.xxl)
        .padding(.bottom, RVSpacing.xxxl)
    }

    // MARK: - Checkbox

    // RN: checkbox width/height, borderRadius half, border 2
    private func checkboxCircle(isChecked: Bool, size: CGFloat = 22) -> some View {
        ZStack {
            Circle()
                .fill(isChecked ? RVColors.primary : Color.clear)
                .frame(width: size, height: size)
                .overlay(
                    Circle()
                        .stroke(isChecked ? RVColors.primary : RVColors.border, lineWidth: 2)
                )
            if isChecked {
                Image(systemName: "checkmark")
                    .font(.system(size: size - 8, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
    }
}

// MARK: - Consent Item Model

private struct ConsentItem {
    let key: String
    let label: String
    let required: Bool
    var description: String? = nil
    var expandable: Bool = false
    var expandedText: String? = nil
}

#Preview {
    ConsentView()
}
