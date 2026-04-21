import SwiftUI
import PhotosUI

struct PostCreateView: View {
    @Environment(\.dismiss) private var dismiss

    enum PostType: String, CaseIterable {
        case general = "일반"
        case crewPromo = "크루 홍보"
        case question = "질문"

        var icon: String {
            switch self {
            case .general: return "bubble.left"
            case .crewPromo: return "person.2"
            case .question: return "questionmark.circle"
            }
        }
    }

    @State private var postType: PostType = .general
    @State private var title = ""
    @State private var content = ""
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var imageCount = 0
    @State private var isSubmitting = false

    private let maxImages = 10
    private let titleMaxLength = 100

    private var canSubmit: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
            && !content.trimmingCharacters(in: .whitespaces).isEmpty
            && !isSubmitting
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                headerBar

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: RVSpacing.xxl) {
                        // Post type selector
                        postTypeSelector

                        // Title
                        titleSection

                        // Content
                        contentSection
                    }
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.huge)
                }
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(RVColors.text)
            }

            Spacer()

            Text("글 작성")
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button {
                isSubmitting = true
                DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
                    isSubmitting = false
                    dismiss()
                }
            } label: {
                if isSubmitting {
                    ProgressView()
                        .tint(RVColors.primary)
                } else {
                    Text("등록")
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(canSubmit ? RVColors.primary : RVColors.primary.opacity(0.35))
                }
            }
            .disabled(!canSubmit)
        }
        .padding(.horizontal, RVSpacing.xxl)
        .padding(.vertical, RVSpacing.md)
    }

    // MARK: - Post Type Selector

    private var postTypeSelector: some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text("게시글 유형")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            HStack(spacing: RVSpacing.sm) {
                ForEach(PostType.allCases, id: \.self) { type in
                    let isActive = postType == type
                    Button {
                        postType = type
                    } label: {
                        HStack(spacing: RVSpacing.xs) {
                            Image(systemName: type.icon)
                                .font(.system(size: 16))
                            Text(type.rawValue)
                                .font(.system(size: RVFontSize.sm, weight: isActive ? .bold : .semibold))
                        }
                        .foregroundStyle(isActive ? RVColors.white : RVColors.textSecondary)
                        .padding(.horizontal, RVSpacing.lg)
                        .padding(.vertical, RVSpacing.sm)
                        .background(
                            Capsule()
                                .fill(isActive ? RVColors.primary : RVColors.card)
                        )
                        .overlay(
                            Capsule()
                                .stroke(isActive ? RVColors.primary : RVColors.border, lineWidth: 1)
                        )
                    }
                }
            }
        }
    }

    // MARK: - Title Section

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text("제목")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            TextField("제목을 입력하세요", text: $title)
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
                .onChange(of: title) { _, newValue in
                    if newValue.count > titleMaxLength {
                        title = String(newValue.prefix(titleMaxLength))
                    }
                }

            Text("\(title.count)/\(titleMaxLength)")
                .font(.system(size: RVFontSize.xs, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
                .monospacedDigit()
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }

    // MARK: - Content Section

    private var contentSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.sm) {
            Text("내용")
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            TextEditor(text: $content)
                .font(.system(size: RVFontSize.md, weight: .medium))
                .foregroundStyle(RVColors.text)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 200)
                .lineSpacing(5)
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

            // Toolbar
            HStack(spacing: RVSpacing.sm) {
                PhotosPicker(selection: $selectedPhotos, maxSelectionCount: maxImages - imageCount, matching: .images) {
                    Image(systemName: "photo")
                        .font(.system(size: 22))
                        .foregroundStyle(imageCount > 0 ? RVColors.primary : RVColors.textTertiary)
                        .frame(width: 36, height: 36)
                        .background(RVColors.surface)
                        .clipShape(Circle())
                }

                if imageCount > 0 {
                    Text("\(imageCount)/\(maxImages)")
                        .font(.system(size: RVFontSize.xs, weight: .semibold))
                        .foregroundStyle(RVColors.textTertiary)
                }

                Spacer()
            }
            .padding(.top, RVSpacing.xs)
        }
    }
}

#Preview {
    PostCreateView()
}
