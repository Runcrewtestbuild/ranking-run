import SwiftUI

struct PostDetailView: View {
    let postId: String

    init(postId: String = "mock-post-1") {
        self.postId = postId
    }

    @Environment(\.dismiss) private var dismiss
    @State private var commentText: String = ""
    @State private var isLiked: Bool = false
    @State private var likeCount: Int = 24

    // Mock data
    private let post = Post(
        id: "mock-post-1",
        userId: "user-1",
        nickname: "speed_king",
        content: "오늘 한강 반포 코스에서 PB 달성했습니다!\n5km 21분 30초로 골인. 페이스 유지가 잘 되서 기분 좋네요.\n\n다음 목표는 20분 벽 깨기! 같이 달리실 분 모집합니다.",
        likeCount: 24,
        commentCount: 8,
        isLiked: false,
        createdAt: Date().addingTimeInterval(-3600)
    )

    private let comments: [(id: String, nickname: String, content: String, timeAgo: String)] = [
        ("c1", "marathon_queen", "축하해요! 대단하시네요", "32분 전"),
        ("c2", "park_runner", "한강 코스 진짜 좋죠 ㅎㅎ", "1시간 전"),
        ("c3", "night_owl", "같이 달리고 싶어요! 다음에 알려주세요", "2시간 전"),
    ]

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                // Header
                screenHeader

                ScrollView(.vertical, showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Post card
                        postCard
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.md)

                        // Comments
                        commentsSection
                            .padding(.horizontal, RVSpacing.xxl)
                            .padding(.top, RVSpacing.xl)

                        Color.clear.frame(height: 100)
                    }
                }

                // Comment input
                commentInput
            }
            .safeAreaPadding(.top)
        }
    }

    // MARK: - Header

    // RN: header flexDirection row, paddingHorizontal 16, paddingVertical 12
    private var screenHeader: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }

            Spacer()

            Text("게시글")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Button { } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 20))
                    .foregroundStyle(RVColors.text)
                    .frame(width: 44, height: 44)
            }
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Post Card

    // RN: postCard bg card, borderRadius lg (18), border 1, padding xl (20)
    private var postCard: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            // Author row
            HStack(spacing: RVSpacing.md) {
                // Avatar — RN: 40x40, borderRadius 20
                ZStack {
                    Circle()
                        .fill(RVColors.surfaceLight)
                        .frame(width: 40, height: 40)
                    Text(String(post.nickname.prefix(1)).uppercased())
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                }

                VStack(alignment: .leading, spacing: 1) {
                    Text(post.nickname)
                        .font(.system(size: RVFontSize.md, weight: .bold))
                        .foregroundStyle(RVColors.text)
                    Text(relativeTime(post.createdAt))
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }

                Spacer()
            }

            // Content
            Text(post.content)
                .font(.system(size: RVFontSize.md))
                .foregroundStyle(RVColors.text)
                .lineSpacing(4)

            // Action row: like + comment count
            HStack(spacing: RVSpacing.xl) {
                Button {
                    isLiked.toggle()
                    likeCount += isLiked ? 1 : -1
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: isLiked ? "heart.fill" : "heart")
                            .font(.system(size: 18))
                            .foregroundStyle(isLiked ? RVColors.error : RVColors.textSecondary)
                        Text("\(likeCount)")
                            .font(.system(size: RVFontSize.sm, weight: .semibold))
                            .foregroundStyle(RVColors.textSecondary)
                    }
                }

                HStack(spacing: 6) {
                    Image(systemName: "bubble.left")
                        .font(.system(size: 18))
                        .foregroundStyle(RVColors.textSecondary)
                    Text("\(post.commentCount)")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.textSecondary)
                }

                Spacer()
            }
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

    // MARK: - Comments

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: RVSpacing.md) {
            Text("댓글 \(comments.count)")
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(RVColors.text)

            ForEach(comments, id: \.id) { comment in
                commentRow(comment)
            }
        }
    }

    // RN: commentRow padding 12, gap 10
    // RN: commentAvatar 32x32, borderRadius 16
    private func commentRow(_ comment: (id: String, nickname: String, content: String, timeAgo: String)) -> some View {
        HStack(alignment: .top, spacing: RVSpacing.sm + 2) {
            // Avatar
            ZStack {
                Circle()
                    .fill(RVColors.surfaceLight)
                    .frame(width: 32, height: 32)
                Text(String(comment.nickname.prefix(1)).uppercased())
                    .font(.system(size: RVFontSize.sm, weight: .bold))
                    .foregroundStyle(RVColors.textSecondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: RVSpacing.sm) {
                    Text(comment.nickname)
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                        .foregroundStyle(RVColors.text)
                    Text(comment.timeAgo)
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }

                Text(comment.content)
                    .font(.system(size: RVFontSize.md))
                    .foregroundStyle(RVColors.text)
            }

            Spacer()
        }
        .padding(.vertical, RVSpacing.sm)
    }

    // MARK: - Comment Input

    // RN: inputBar bg card, borderTopWidth 1, padding 12, gap 8
    private var commentInput: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(RVColors.border)
                .frame(height: 1)

            HStack(spacing: RVSpacing.sm) {
                TextField("댓글을 입력하세요...", text: $commentText)
                    .font(.system(size: RVFontSize.md))
                    .foregroundStyle(RVColors.text)
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.sm + 2)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.xl)
                            .fill(RVColors.surface)
                    )

                Button {
                    commentText = ""
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundStyle(
                            commentText.trimmingCharacters(in: .whitespaces).isEmpty
                                ? RVColors.textTertiary
                                : RVColors.primary
                        )
                }
                .disabled(commentText.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.horizontal, RVSpacing.lg)
            .padding(.vertical, RVSpacing.sm)
            .background(RVColors.card)
        }
    }

    // MARK: - Helpers

    private func relativeTime(_ date: Date?) -> String {
        guard let date else { return "" }
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "방금 전" }
        if interval < 3600 { return "\(Int(interval / 60))분 전" }
        if interval < 86400 { return "\(Int(interval / 3600))시간 전" }
        return "\(Int(interval / 86400))일 전"
    }
}

#Preview {
    PostDetailView()
}
