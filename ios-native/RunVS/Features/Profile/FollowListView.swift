import SwiftUI

struct FollowListView: View {
    @Environment(\.dismiss) private var dismiss

    enum Tab: String, CaseIterable {
        case followers = "팔로워"
        case following = "팔로잉"
    }

    struct FollowItem: Identifiable {
        let id: String
        let nickname: String
        let bio: String?
        var isFollowing: Bool
    }

    @State private var activeTab: Tab = .followers
    @State private var followers: [FollowItem] = [
        FollowItem(id: "1", nickname: "marathon_queen", bio: "매일 달리는 마라토너", isFollowing: true),
        FollowItem(id: "2", nickname: "speed_king", bio: "빠르게 달리기", isFollowing: false),
        FollowItem(id: "3", nickname: "park_runner", bio: nil, isFollowing: true),
        FollowItem(id: "4", nickname: "night_owl", bio: "야간 러닝 전문", isFollowing: false),
    ]

    @State private var following: [FollowItem] = [
        FollowItem(id: "1", nickname: "marathon_queen", bio: "매일 달리는 마라토너", isFollowing: true),
        FollowItem(id: "3", nickname: "park_runner", bio: nil, isFollowing: true),
        FollowItem(id: "5", nickname: "morning_bird", bio: "새벽 러너", isFollowing: true),
    ]

    private var items: [FollowItem] {
        activeTab == .followers ? followers : following
    }

    var body: some View {
        ZStack {
            RVColors.background.ignoresSafeArea()

            VStack(spacing: 0) {
                screenHeader

                // Tab bar
                tabBar
                    .padding(.horizontal, RVSpacing.xxl)
                    .padding(.bottom, RVSpacing.md)

                ScrollView(.vertical, showsIndicators: false) {
                    LazyVStack(spacing: 0) {
                        ForEach(items) { item in
                            followRow(item)
                        }
                    }
                    .padding(.horizontal, RVSpacing.xl)
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

            Text(activeTab == .followers ? "팔로워" : "팔로잉")
                .font(.system(size: RVFontSize.lg, weight: .bold))
                .foregroundStyle(RVColors.text)

            Spacer()

            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, RVSpacing.sm)
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(Tab.allCases, id: \.self) { tab in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        activeTab = tab
                    }
                } label: {
                    Text(tab.rawValue)
                        .font(.system(size: RVFontSize.sm, weight: activeTab == tab ? .bold : .semibold))
                        .foregroundStyle(activeTab == tab ? RVColors.text : RVColors.textTertiary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, RVSpacing.sm + 2)
                        .background(activeTab == tab ? RVColors.card : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: RVRadius.md - 2))
                        .shadow(color: activeTab == tab ? .black.opacity(0.08) : .clear, radius: 2, y: 1)
                }
            }
        }
        .padding(3)
        .background(
            RoundedRectangle(cornerRadius: RVRadius.md)
                .fill(RVColors.surface)
        )
    }

    // MARK: - Follow Row

    private func followRow(_ item: FollowItem) -> some View {
        HStack(spacing: RVSpacing.md) {
            ZStack {
                Circle()
                    .fill(RVColors.surfaceLight)
                    .frame(width: 44, height: 44)
                Text(String(item.nickname.prefix(1)).uppercased())
                    .font(.system(size: RVFontSize.md, weight: .heavy))
                    .foregroundStyle(RVColors.textSecondary)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(item.nickname)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
                    .lineLimit(1)
                if let bio = item.bio {
                    Text(bio)
                        .font(.system(size: RVFontSize.sm, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                        .lineLimit(1)
                }
            }

            Spacer()

            Button { } label: {
                Text(item.isFollowing ? "팔로잉" : "팔로우")
                    .font(.system(size: RVFontSize.xs, weight: .bold))
                    .foregroundStyle(item.isFollowing ? RVColors.textSecondary : RVColors.white)
                    .padding(.horizontal, RVSpacing.md)
                    .padding(.vertical, RVSpacing.xs + 2)
                    .background(
                        Capsule()
                            .fill(item.isFollowing ? RVColors.surface : RVColors.primary)
                    )
                    .overlay(
                        Capsule()
                            .stroke(item.isFollowing ? RVColors.border : Color.clear, lineWidth: 1)
                    )
            }
        }
        .padding(.vertical, RVSpacing.md)
        .overlay(
            Rectangle()
                .fill(RVColors.border)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }
}

#Preview {
    FollowListView()
}
