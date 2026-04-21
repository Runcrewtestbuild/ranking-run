import SwiftUI
import UIKit

// MARK: - Tab Definition

enum AppTab: Int, CaseIterable {
    case home = 0, course, world, community, myPage

    var label: String {
        switch self {
        case .home: "홈"
        case .course: "코스"
        case .world: "월드"
        case .community: "소셜"
        case .myPage: "마이"
        }
    }

    var iconInactive: String {
        switch self {
        case .home: "house"
        case .course: "map"
        case .world: "globe"
        case .community: "bubble.left.and.bubble.right"
        case .myPage: "person"
        }
    }

    var iconActive: String {
        switch self {
        case .home: "house.fill"
        case .course: "map.fill"
        case .world: "globe"
        case .community: "bubble.left.and.bubble.right.fill"
        case .myPage: "person.fill"
        }
    }
}

// MARK: - Root View

struct ContentView: View {
    @Environment(AppState.self) private var appState
    @State private var selectedTab: AppTab = .world

    var body: some View {
        if appState.isAuthenticated {
            ZStack(alignment: .bottom) {
                // Tab content — world is full screen, others respect safe area
                Group {
                    switch selectedTab {
                    case .world:
                        WorldMapView().ignoresSafeArea()
                    case .home:
                        HomeView()
                    case .course:
                        CourseListView()
                    case .community:
                        CommunityFeedView()
                    case .myPage:
                        ProfileView()
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)

                // Tab bar — pinned to absolute bottom of screen
                CustomTabBar(selectedTab: $selectedTab)
            }
            .ignoresSafeArea(.container, edges: .bottom)
        } else {
            LoginView()
                .ignoresSafeArea()
        }
    }
}

// MARK: - Custom Tab Bar
// RN: bg #050505, borderTop #1E1E1E hairline
// height: 60 + max(insets.bottom, 8), paddingTop: 10
// paddingBottom: max(insets.bottom, 8)
// icon 24pt, label 10pt semibold, active #F5F5F5, inactive #808080

struct CustomTabBar: View {
    @Binding var selectedTab: AppTab

    private var bottomInset: CGFloat {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.windows.first else { return 34 }
        return max(window.safeAreaInsets.bottom, 8)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Border top
            Rectangle()
                .fill(Color(hex: "1E1E1E"))
                .frame(height: 1.0 / UIScreen.main.scale)

            // Tab icons + labels
            HStack(spacing: 0) {
                ForEach(AppTab.allCases, id: \.self) { tab in
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        selectedTab = tab
                    } label: {
                        VStack(spacing: 3) {
                            Image(systemName: selectedTab == tab ? tab.iconActive : tab.iconInactive)
                                .font(.system(size: 24))
                            Text(tab.label)
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(0.1)
                        }
                        .foregroundStyle(
                            selectedTab == tab
                                ? Color(hex: "F5F5F5")
                                : Color(hex: "808080")
                        )
                        .frame(width: 60)
                        .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding(.top, 10)
            .frame(height: 50)

            // Bottom safe area fill — slightly less than full inset
            // so tab icons sit above home indicator gesture area
            Color(hex: "050505")
                .frame(height: max(bottomInset - 4, 0))
        }
        .background(Color(hex: "050505"))
        .shadow(color: .black.opacity(0.03), radius: 4, y: -1)
    }
}

#Preview {
    ContentView()
        .environment(AppState())
}
