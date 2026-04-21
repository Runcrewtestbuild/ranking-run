import SwiftUI
import UIKit

struct WorldMapView: View {
    @Environment(AppState.self) private var appState

    // MARK: - State

    /// Welcome overlay visible (RN: welcomeVisible)
    @State private var welcomeVisible = true
    /// Tour mode — hides welcome, shows map markers (RN: touring)
    @State private var isTourMode = false
    /// Full-screen running view
    @State private var showRunning = false
    /// Settings sheet
    @State private var showSettings = false
    /// Goal sheet
    @State private var showGoal = false
    /// Run goal
    @State private var runGoal = RunGoal.none

    // MARK: - Computed

    private var topInset: CGFloat {
        guard let window = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first?.windows.first else { return 59 }
        return window.safeAreaInsets.top
    }

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 6 { return "늦은 밤이에요" }
        if hour < 12 { return "좋은 아침이에요" }
        if hour < 18 { return "좋은 오후에요" }
        return "좋은 저녁이에요"
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            // 1. Mapbox map
            MapboxMapView()

            // 2. Welcome overlay — dark backdrop + greeting + tour button
            if welcomeVisible && !isTourMode {
                welcomeOverlay
                    .transition(.opacity)
            }

            // 3. Start overlay — always visible when idle & not touring
            // RN: visible={phase === 'idle' && !selectedMarker && !is3DMode && !navigatingToStart && !touring}
            if !isTourMode && !welcomeVisible {
                startOverlay
            }

            // 4. Tour mode buttons
            if isTourMode {
                tourModeOverlay
            }

            // 5. Weather bar — top, safe area (always visible, except in tour mode back button area)
            VStack {
                weatherBar
                Spacer()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: welcomeVisible)
        .animation(.easeInOut(duration: 0.3), value: isTourMode)
        .fullScreenCover(isPresented: $showRunning) {
            RunningView(autoStart: true, goal: runGoal)
        }
        .sheet(isPresented: $showSettings) {
            RunSettingsSheet()
        }
        .sheet(isPresented: $showGoal) {
            RunGoalSheet(goal: $runGoal)
        }
    }

    // MARK: - Welcome Overlay

    private var welcomeOverlay: some View {
        ZStack {
            // Dark backdrop — RN: rgba(15,15,15,0.92)
            Color(hex: "0F0F0F").opacity(0.92)
                .allowsHitTesting(false)

            // Welcome text — upper-center (RN: ~40% from top)
            VStack(spacing: 0) {
                Spacer().frame(maxHeight: .infinity)

                Text(greeting)
                    .font(.system(size: 17, weight: .semibold))
                    .tracking(1.5)
                    .foregroundStyle(RVColors.primary)
                    .padding(.bottom, 12)

                Text(appState.currentUser?.nickname ?? "러너")
                    .font(.system(size: 38, weight: .black))
                    .tracking(-0.5)
                    .foregroundStyle(RVColors.text)
                    .padding(.bottom, 20)

                // Divider — RN: 40x2, white 12% opacity
                RoundedRectangle(cornerRadius: 1)
                    .fill(Color.white.opacity(0.12))
                    .frame(width: 40, height: 2)
                    .padding(.bottom, 20)

                Text("\"하프마라톤은 풀마라톤의 맛보기라고 들었다\"")
                    .font(.system(size: 17, weight: .medium))
                    .italic()
                    .foregroundStyle(Color.white.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)

                Spacer().frame(maxHeight: .infinity)
                Spacer().frame(maxHeight: .infinity)
            }

            // Tour button — RN: absolute, bottom: 200
            VStack {
                Spacer()
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    // RN: onTour={() => { setTouring(true); setWelcomeVisible(false); setFollowUser(false); }}
                    isTourMode = true
                    welcomeVisible = false
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "safari")
                            .font(.system(size: 16))
                        Text("코스 둘러보기")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .foregroundStyle(Color.white.opacity(0.8))
                    .padding(.horizontal, 20)
                    .padding(.vertical, 11)
                    .background(Color.white.opacity(0.15))
                    .clipShape(Capsule())
                }
                // RN bottom: 200 from screen bottom (absolute positioned)
                .padding(.bottom, 285) // 200 + tabBar(85)
            }
        }
        .onTapGesture {
            // Tap anywhere on welcome to dismiss and show start overlay
            withAnimation {
                welcomeVisible = false
            }
        }
    }

    // MARK: - Tour Mode Overlay

    private var tourModeOverlay: some View {
        ZStack {
            // Back button — top-left, capsule
            VStack {
                HStack {
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        isTourMode = false
                        welcomeVisible = true
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.left")
                                .font(.system(size: 14, weight: .semibold))
                            Text("돌아가기")
                                .font(.system(size: 14, weight: .semibold))
                        }
                        .foregroundStyle(RVColors.text)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(
                            Capsule()
                                .fill(RVColors.card)
                                .shadow(color: .black.opacity(0.2), radius: 8, y: 2)
                        )
                    }
                    Spacer()
                }
                .padding(.leading, RVSpacing.xl)
                .padding(.top, topInset + 36) // Below weather bar
                Spacer()
            }

            // Recenter button — bottom-right, 44x44 circle
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    Button {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        // Recenter map to user location (future: integrate with MapboxMapView)
                    } label: {
                        Image(systemName: "location.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(RVColors.text)
                            .frame(width: 44, height: 44)
                            .background(
                                Circle()
                                    .fill(RVColors.card)
                                    .shadow(color: .black.opacity(0.2), radius: 8, y: 2)
                            )
                    }
                    .padding(.trailing, RVSpacing.xl)
                    // Above tab bar
                    .padding(.bottom, 100)
                }
            }
        }
    }

    // MARK: - Start Overlay

    /// Bottom controls: settings, start, goal
    /// RN: RunStartOverlay — absolute, bottom: 50, gap: 32
    private var startOverlay: some View {
        VStack {
            Spacer()

            // Goal label chip (when a goal is set)
            if runGoal.type != nil {
                Text(runGoal.goalLabel)
                    .font(.system(size: RVFontSize.sm, weight: .bold))
                    .foregroundStyle(RVColors.primary)
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.sm)
                    .background(
                        Capsule()
                            .fill(RVColors.primary.opacity(0.12))
                            .overlay(
                                Capsule()
                                    .stroke(RVColors.primary.opacity(0.3), lineWidth: 1)
                            )
                    )
                    .padding(.bottom, RVSpacing.md)
            }

            HStack(spacing: 32) {
                // Settings — RN: 50x50 circle, gear icon
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showSettings = true
                } label: {
                    Image(systemName: "gearshape")
                        .font(.system(size: 24))
                        .foregroundStyle(RVColors.textSecondary)
                        .frame(width: 50, height: 50)
                        .background(RVColors.card)
                        .clipShape(Circle())
                        .shadow(color: Color(hex: "1C1917").opacity(0.05), radius: 12, y: 4)
                }

                // Start — RN: 110x110 circle, primary bg
                Button {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    // RN: handleStartFreeRun → handleStartRun(null) → beginCountdownAndRun
                    showRunning = true
                } label: {
                    Text("시작")
                        .font(.system(size: RVFontSize.xxl, weight: .black))
                        .tracking(2)
                        .foregroundStyle(.white)
                        .frame(width: 110, height: 110)
                        .background(RVColors.primary)
                        .clipShape(Circle())
                        .shadow(color: RVColors.primary.opacity(0.4), radius: 20, y: 8)
                }

                // Goal — RN: 50x50 circle, flag icon
                Button {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    showGoal = true
                } label: {
                    Image(systemName: "flag")
                        .font(.system(size: 24))
                        .foregroundStyle(runGoal.type != nil ? RVColors.primary : RVColors.textSecondary)
                        .frame(width: 50, height: 50)
                        .background(RVColors.card)
                        .clipShape(Circle())
                        .shadow(color: Color(hex: "1C1917").opacity(0.05), radius: 12, y: 4)
                }
            }
            // Tab bar total height: ~85pt (1 border + 10 padTop + 50 icons + 34 safeArea)
            // RN bottom: 50 above tab bar = 50 + 85 = 135 from screen bottom
            .padding(.bottom, 135)
        }
    }

    // MARK: - Weather Bar

    private var weatherBar: some View {
        HStack(spacing: 6) {
            Image(systemName: "cloud.fill")
                .font(.system(size: 14))
                .foregroundStyle(RVColors.textSecondary)
            Text("3\u{00B0}")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(RVColors.text)
            Text("맑음")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(RVColors.textSecondary)
            Circle().fill(RVColors.textTertiary.opacity(0.5)).frame(width: 3, height: 3)
            Image(systemName: "drop.fill")
                .font(.system(size: 12))
                .foregroundStyle(RVColors.textTertiary)
            Text("81%")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
            Circle().fill(RVColors.textTertiary.opacity(0.5)).frame(width: 3, height: 3)
            Image(systemName: "leaf.fill")
                .font(.system(size: 12))
                .foregroundStyle(RVColors.textTertiary)
            Text("나쁨")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(RVColors.textTertiary)
            Spacer()
        }
        .padding(.horizontal, RVSpacing.xl)
        .padding(.top, topInset + 4)
    }
}
