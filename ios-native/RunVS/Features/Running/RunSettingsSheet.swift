import SwiftUI
import UIKit

// MARK: - Run Settings

/// Persisted run settings matching RN settingsStore
@Observable
class RunSettings {
    static let shared = RunSettings()

    var autoPause: Bool {
        get { UserDefaults.standard.bool(forKey: "runSettings.autoPause") }
        set { UserDefaults.standard.set(newValue, forKey: "runSettings.autoPause") }
    }

    var voiceGuidance: Bool {
        get {
            // Default to true on first launch
            if UserDefaults.standard.object(forKey: "runSettings.voiceGuidance") == nil {
                return true
            }
            return UserDefaults.standard.bool(forKey: "runSettings.voiceGuidance")
        }
        set { UserDefaults.standard.set(newValue, forKey: "runSettings.voiceGuidance") }
    }

    var countdownSeconds: Int {
        get {
            let stored = UserDefaults.standard.integer(forKey: "runSettings.countdownSeconds")
            return stored > 0 ? stored : 3
        }
        set { UserDefaults.standard.set(newValue, forKey: "runSettings.countdownSeconds") }
    }

    var isIndoor: Bool {
        get { UserDefaults.standard.bool(forKey: "runSettings.isIndoor") }
        set { UserDefaults.standard.set(newValue, forKey: "runSettings.isIndoor") }
    }

    var strideLengthCm: Int? {
        get {
            let stored = UserDefaults.standard.integer(forKey: "runSettings.strideLengthCm")
            return stored > 0 ? stored : nil
        }
        set {
            if let v = newValue {
                UserDefaults.standard.set(v, forKey: "runSettings.strideLengthCm")
            } else {
                UserDefaults.standard.removeObject(forKey: "runSettings.strideLengthCm")
            }
        }
    }

    private init() {}
}

// MARK: - RunSettingsSheet

struct RunSettingsSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var settings = RunSettings.shared

    // Force refresh when toggling
    @State private var refreshId = UUID()

    private func hapticTap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Section: Measurement (RN: sectionMeasure)
                    settingsSection(title: "측정") {
                        HStack(spacing: 0) {
                            settingTile(
                                icon: settings.isIndoor ? "building.2" : "location",
                                label: "환경",
                                value: settings.isIndoor ? "실내" : "실외"
                            ) {
                                hapticTap()
                                settings.isIndoor.toggle()
                                refreshId = UUID()
                            }

                            settingTile(
                                icon: "pause",
                                label: "자동 일시정지",
                                value: settings.autoPause ? "켜짐" : "꺼짐"
                            ) {
                                hapticTap()
                                settings.autoPause.toggle()
                                refreshId = UUID()
                            }
                        }
                    }

                    // Section: Display & Voice (RN: sectionDisplayVoice)
                    settingsSection(title: "표시 및 음성") {
                        HStack(spacing: 0) {
                            settingTile(
                                icon: settings.voiceGuidance ? "speaker.wave.3" : "speaker.slash",
                                label: "음성 안내",
                                value: settings.voiceGuidance ? "켜짐" : "꺼짐"
                            ) {
                                hapticTap()
                                settings.voiceGuidance.toggle()
                                refreshId = UUID()
                            }

                            settingTile(
                                icon: "timer",
                                label: "카운트다운",
                                value: "\(settings.countdownSeconds)초"
                            ) {
                                hapticTap()
                                cycleCountdown()
                            }
                        }
                    }

                    // Section: Device (RN: sectionDevice)
                    settingsSection(title: "기기") {
                        HStack(spacing: 0) {
                            settingTile(
                                icon: "heart",
                                label: "심박수 표시",
                                value: "설정"
                            ) {
                                hapticTap()
                                // Navigate to heart rate settings (future)
                            }

                            settingTile(
                                icon: "applewatch",
                                label: "Apple Watch",
                                value: "설정"
                            ) {
                                hapticTap()
                                // Navigate to watch settings (future)
                            }
                        }
                    }
                }
                .id(refreshId)
            }
            .background(RVColors.background)
            .navigationTitle("러닝 설정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("완료") {
                        dismiss()
                    }
                    .foregroundStyle(RVColors.primary)
                    .fontWeight(.bold)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
        .presentationBackground(RVColors.background)
    }

    // MARK: - Section

    private func settingsSection(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Spacer()
                Text(title)
                    .font(.system(size: RVFontSize.sm, weight: .semibold))
                    .foregroundStyle(RVColors.textTertiary)
                Spacer()
            }
            .padding(.vertical, RVSpacing.sm)
            .background(RVColors.surface)

            // Tiles
            content()
        }
    }

    // MARK: - Tile (matches RN 50% width, centered, icon + value + label)

    private func settingTile(icon: String, label: String, value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: RVSpacing.sm) {
                Image(systemName: icon)
                    .font(.system(size: 26))
                    .foregroundStyle(RVColors.text)

                Text(value)
                    .font(.system(size: RVFontSize.sm, weight: .medium))
                    .foregroundStyle(RVColors.textSecondary)

                Text(label)
                    .font(.system(size: RVFontSize.md, weight: .bold))
                    .foregroundStyle(RVColors.text)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.xxl)
        }
    }

    // MARK: - Actions

    private func cycleCountdown() {
        let options = [3, 5, 10]
        if let idx = options.firstIndex(of: settings.countdownSeconds) {
            settings.countdownSeconds = options[(idx + 1) % options.count]
        } else {
            settings.countdownSeconds = 3
        }
        refreshId = UUID()
    }
}
