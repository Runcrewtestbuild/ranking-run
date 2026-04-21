import SwiftUI

struct NotificationInboxView: View {
    @Environment(\.dismiss) private var dismiss

    struct NotificationItem: Identifiable {
        let id: String
        let type: String
        let actorName: String
        let message: String
        let timeAgo: String
        var isRead: Bool
    }

    private static let iconConfig: [String: (icon: String, color: Color)] = [
        "post_comment": ("bubble.fill", Color(hex: "3B82F6")),
        "post_like": ("heart.fill", Color(hex: "EF4444")),
        "crew_join_request": ("person.badge.plus", RVColors.primary),
        "follow": ("person.badge.plus", Color(hex: "10B981")),
        "friend_request": ("person.2.fill", Color(hex: "8B5CF6")),
        "run_completed": ("figure.run", RVColors.primary),
    ]

    @State private var notifications: [NotificationItem] = [
        NotificationItem(id: "1", type: "post_like", actorName: "marathon_queen", message: "marathon_queen님이 게시글을 좋아합니다", timeAgo: "2분 전", isRead: false),
        NotificationItem(id: "2", type: "follow", actorName: "speed_king", message: "speed_king님이 팔로우했습니다", timeAgo: "15분 전", isRead: false),
        NotificationItem(id: "3", type: "post_comment", actorName: "park_runner", message: "park_runner님이 댓글을 남겼습니다", timeAgo: "1시간 전", isRead: true),
        NotificationItem(id: "4", type: "crew_join_request", actorName: "new_runner", message: "new_runner님이 크루 가입을 신청했습니다", timeAgo: "3시간 전", isRead: true),
        NotificationItem(id: "5", type: "run_completed", actorName: "morning_bird", message: "morning_bird님이 런닝을 완료했습니다", timeAgo: "어제", isRead: true),
    ]

    private var hasUnread: Bool {
        notifications.contains { !$0.isRead }
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                headerBar

                if notifications.isEmpty {
                    emptyState
                } else {
                    ScrollView(.vertical, showsIndicators: false) {
                        LazyVStack(spacing: 0) {
                            ForEach(notifications) { item in
                                notificationRow(item)
                            }
                        }
                        .padding(.horizontal, RVSpacing.lg)
                        .padding(.bottom, RVSpacing.xxxl)
                    }
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

            Text("알림")
                .font(.system(size: RVFontSize.lg, weight: .heavy))
                .foregroundStyle(RVColors.text)

            Spacer()

            if hasUnread {
                Button {
                    for i in notifications.indices {
                        notifications[i].isRead = true
                    }
                } label: {
                    Text("모두 읽음")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.primary)
                }
            } else {
                Color.clear.frame(width: 60)
            }
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.vertical, RVSpacing.md)
    }

    // MARK: - Notification Row

    private func notificationRow(_ item: NotificationItem) -> some View {
        let config = Self.iconConfig[item.type] ?? ("bell.fill", RVColors.textTertiary)

        return HStack(spacing: RVSpacing.sm) {
            // Unread dot
            Circle()
                .fill(item.isRead ? Color.clear : RVColors.primary)
                .frame(width: 8, height: 8)

            // Avatar placeholder
            ZStack {
                Circle()
                    .fill(RVColors.surfaceLight)
                    .frame(width: 40, height: 40)
                Text(String(item.actorName.prefix(1)).uppercased())
                    .font(.system(size: RVFontSize.sm, weight: .heavy))
                    .foregroundStyle(RVColors.textSecondary)
            }

            // Message
            VStack(alignment: .leading, spacing: 2) {
                Text(item.message)
                    .font(.system(size: RVFontSize.sm, weight: item.isRead ? .regular : .semibold))
                    .foregroundStyle(item.isRead ? RVColors.textSecondary : RVColors.text)
                    .lineSpacing(3)
                    .lineLimit(2)

                Text(item.timeAgo)
                    .font(.system(size: RVFontSize.xs, weight: .medium))
                    .foregroundStyle(RVColors.textTertiary)
            }

            Spacer()

            // Type icon
            ZStack {
                Circle()
                    .fill(config.color.opacity(0.1))
                    .frame(width: 28, height: 28)
                Image(systemName: config.icon)
                    .font(.system(size: 14))
                    .foregroundStyle(config.color)
            }
        }
        .padding(.vertical, RVSpacing.md)
        .padding(.horizontal, RVSpacing.xs)
        .background(item.isRead ? Color.clear : RVColors.primary.opacity(0.03))
        .overlay(
            Rectangle()
                .fill(RVColors.border)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: RVSpacing.md) {
            Spacer()
            Image(systemName: "bell.slash")
                .font(.system(size: 48))
                .foregroundStyle(RVColors.textTertiary)
            Text("알림이 없습니다")
                .font(.system(size: RVFontSize.md, weight: .semibold))
                .foregroundStyle(RVColors.textTertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview {
    NotificationInboxView()
}
