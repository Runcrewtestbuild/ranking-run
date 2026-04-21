import SwiftUI

struct PrivacyPolicyView: View {
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

                    Text("개인정보처리방침")
                        .font(.system(size: RVFontSize.lg, weight: .bold))
                        .foregroundStyle(RVColors.text)

                    Spacer()

                    Color.clear.frame(width: 44, height: 44)
                }
                .padding(.horizontal, RVSpacing.sm)

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(alignment: .leading, spacing: RVSpacing.xl) {
                        legalSection(
                            title: "1. 개인정보의 수집 및 이용 목적",
                            content: "RunVS는 서비스 제공을 위해 필요한 최소한의 개인정보를 수집합니다. 수집된 개인정보는 회원 관리, 서비스 제공, 통계 분석 등의 목적으로만 이용됩니다."
                        )

                        legalSection(
                            title: "2. 수집하는 개인정보 항목",
                            content: "필수 항목: 소셜 로그인 식별자, 닉네임\n선택 항목: 프로필 사진, 키, 몸무게, 소개글\n자동 수집: GPS 위치 정보 (런닝 시), 기기 정보"
                        )

                        legalSection(
                            title: "3. 개인정보의 보유 및 이용 기간",
                            content: "회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다. 다만, 관련 법령에 따라 일정 기간 보존이 필요한 정보는 해당 기간 동안 보관합니다."
                        )

                        legalSection(
                            title: "4. 개인정보의 제3자 제공",
                            content: "RunVS는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 법령에 의한 경우는 예외입니다."
                        )

                        legalSection(
                            title: "5. 위치 정보",
                            content: "런닝 기록 및 코스 생성을 위해 GPS 위치 정보를 수집합니다. 위치 정보는 런닝 중에만 수집되며, 사용자가 직접 종료할 수 있습니다."
                        )

                        legalSection(
                            title: "6. 문의처",
                            content: "개인정보 관련 문의: support@runvs.run"
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
    PrivacyPolicyView()
}
