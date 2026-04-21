import SwiftUI

struct FindFriendsView: View {
    @Environment(\.dismiss) private var dismiss

    @State private var codeInput = ""
    @State private var isSearching = false
    @State private var searchResult: User?
    @State private var hasSearched = false
    @State private var codeCopied = false

    private let myUserCode = "RUNVS-A1B2C3"

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xxl) {
                        // My code section
                        myCodeSection

                        // Search by code
                        searchSection

                        // Search result
                        if hasSearched {
                            searchResultSection
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

            Text("친구 찾기")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - My Code Section

    private var myCodeSection: some View {
        VStack(spacing: RVSpacing.md) {
            Text("내 코드")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack {
                Text(myUserCode)
                    .font(.system(size: RVFontSize.xl, weight: .heavy))
                    .foregroundStyle(RVColors.text)
                    .monospacedDigit()

                Spacer()

                Button {
                    codeCopied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        codeCopied = false
                    }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: codeCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 14))
                        Text(codeCopied ? "복사됨" : "복사")
                            .font(.system(size: RVFontSize.sm, weight: .semibold))
                    }
                    .foregroundStyle(codeCopied ? RVColors.success : RVColors.primary)
                    .padding(.horizontal, RVSpacing.md)
                    .padding(.vertical, RVSpacing.sm)
                    .background(
                        Capsule()
                            .fill((codeCopied ? RVColors.success : RVColors.primary).opacity(0.12))
                    )
                }
            }
            .padding(RVSpacing.lg)
            .background(
                RoundedRectangle(cornerRadius: RVRadius.lg)
                    .fill(RVColors.card)
                    .overlay(
                        RoundedRectangle(cornerRadius: RVRadius.lg)
                            .stroke(RVColors.border, lineWidth: 1)
                    )
            )

            Text("친구에게 코드를 공유하면 서로를 찾을 수 있어요")
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.top, RVSpacing.lg)
    }

    // MARK: - Search Section

    private var searchSection: some View {
        VStack(spacing: RVSpacing.md) {
            Text("코드로 친구 찾기")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: RVSpacing.sm) {
                TextField("친구 코드 입력", text: $codeInput)
                    .font(.system(size: RVFontSize.md))
                    .foregroundStyle(RVColors.text)
                    .textInputAutocapitalization(.characters)
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

                Button {
                    isSearching = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                        searchResult = User.mock(id: "99", nickname: "found_runner", bio: "달리기를 사랑하는 러너", level: 7, totalDistanceMeters: 456_000, totalRunCount: 120)
                        hasSearched = true
                        isSearching = false
                    }
                } label: {
                    if isSearching {
                        ProgressView()
                            .tint(RVColors.white)
                    } else {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(RVColors.white)
                    }
                }
                .frame(width: 48, height: 48)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.md)
                        .fill(RVColors.primary)
                )
                .disabled(codeInput.trimmingCharacters(in: .whitespaces).isEmpty || isSearching)
            }
        }
    }

    // MARK: - Search Result

    private var searchResultSection: some View {
        Group {
            if let user = searchResult {
                HStack(spacing: RVSpacing.md) {
                    ZStack {
                        Circle()
                            .fill(RVColors.surfaceLight)
                            .frame(width: 52, height: 52)
                        Image(systemName: "person.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(RVColors.textTertiary)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text(user.nickname)
                            .font(.system(size: RVFontSize.md, weight: .bold))
                            .foregroundStyle(RVColors.text)
                        if let bio = user.bio {
                            Text(bio)
                                .font(.system(size: RVFontSize.sm, weight: .medium))
                                .foregroundStyle(RVColors.textSecondary)
                                .lineLimit(1)
                        }
                        Text("Lv.\(user.level) \u{00B7} \(RunFormatters.formatDistanceWithUnit(meters: user.totalDistanceMeters))")
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                    }

                    Spacer()

                    Button { } label: {
                        Text("팔로우")
                            .font(.system(size: RVFontSize.sm, weight: .bold))
                            .foregroundStyle(RVColors.white)
                            .padding(.horizontal, RVSpacing.lg)
                            .padding(.vertical, RVSpacing.sm)
                            .background(RVColors.primary)
                            .clipShape(Capsule())
                    }
                }
                .padding(RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.lg)
                        .fill(RVColors.card)
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.lg)
                                .stroke(RVColors.border, lineWidth: 1)
                        )
                )
            } else {
                VStack(spacing: RVSpacing.md) {
                    Image(systemName: "person.slash")
                        .font(.system(size: 32))
                        .foregroundStyle(RVColors.textTertiary)
                    Text("사용자를 찾을 수 없습니다")
                        .font(.system(size: RVFontSize.md, weight: .semibold))
                        .foregroundStyle(RVColors.textTertiary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.xxl)
            }
        }
    }
}

#Preview {
    FindFriendsView()
}
