import SwiftUI

struct TermsOfServiceView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                HStack {
                    Button { dismiss() } label: {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 20, weight: .semibold))
                            .foregroundStyle(RVColors.text)
                            .frame(width: 44, height: 44)
                    }

                    Spacer()

                    Text("이용약관")
                        .font(.system(size: RVFontSize.lg, weight: .bold))
                        .foregroundStyle(RVColors.text)

                    Spacer()

                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.horizontal, RVSpacing.sm)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RVSpacing.xl) {
                        legalSection(
                            title: "제1조 (목적)",
                            content: "이 약관은 RunVS(이하 \"서비스\")의 이용 조건 및 절차, 이용자와 회사의 권리, 의무, 책임사항 등을 규정함을 목적으로 합니다."
                        )

                        legalSection(
                            title: "제2조 (정의)",
                            content: "\"서비스\"란 RunVS 앱을 통해 제공되는 런닝 기록, 코스 공유, 소셜 기능 등 일체의 서비스를 말합니다.\n\"이용자\"란 이 약관에 따라 서비스를 이용하는 회원을 말합니다."
                        )

                        legalSection(
                            title: "제3조 (서비스의 제공)",
                            content: "서비스는 다음과 같은 기능을 제공합니다:\n- GPS 기반 런닝 트래킹\n- 코스 제작 및 공유\n- 코스별 랭킹\n- 크루 활동\n- 챌린지 참여\n- 소셜 커뮤니티"
                        )

                        legalSection(
                            title: "제4조 (회원가입)",
                            content: "회원가입은 소셜 로그인(카카오, Apple)을 통해 진행되며, 가입 시 이 약관 및 개인정보처리방침에 동의한 것으로 간주합니다."
                        )

                        legalSection(
                            title: "제5조 (이용자의 의무)",
                            content: "이용자는 서비스를 이용함에 있어 타인의 권리를 침해하거나 부정한 방법으로 서비스를 이용해서는 안 됩니다. GPS 데이터를 조작하거나 랭킹을 부정하게 조작하는 행위는 금지됩니다."
                        )

                        legalSection(
                            title: "제6조 (서비스 변경 및 중단)",
                            content: "회사는 서비스의 내용을 변경하거나 중단할 수 있으며, 이 경우 사전에 공지합니다."
                        )

                        legalSection(
                            title: "제7조 (면책)",
                            content: "회사는 천재지변, 전쟁 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다."
                        )
                    }
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.vertical, RVSpacing.xl)
                    .padding(.bottom, RVSpacing.xxxl)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    private func legalSection(title: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text(title)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)

            Text(content)
                .font(.system(size: RVFontSize.sm, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
                .lineSpacing(6)
        }
    }
}

#Preview {
    TermsOfServiceView()
}
