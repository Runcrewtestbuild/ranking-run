import SwiftUI
import UIKit

// MARK: - Run Goal Model

enum RunGoalType: String, CaseIterable, Identifiable {
    case distance
    case time
    case program
    case interval

    var id: String { rawValue }

    var label: String {
        switch self {
        case .distance: "거리"
        case .time: "시간"
        case .program: "프로그램 러닝"
        case .interval: "인터벌"
        }
    }

    var icon: String {
        switch self {
        case .distance: "flag"
        case .time: "timer"
        case .program: "trophy"
        case .interval: "repeat"
        }
    }
}

struct RunGoal: Equatable {
    var type: RunGoalType?
    var value: Double?                // meters for distance, seconds for time
    var targetTime: Int?              // program: target time in seconds
    var cadenceBPM: Int?              // program: metronome BPM
    var adaptiveMetronome: Bool?      // program: auto-adjust BPM based on pace status
    var intervalRunSeconds: Int?      // interval: run phase
    var intervalWalkSeconds: Int?     // interval: walk phase
    var intervalSets: Int?            // interval: number of sets

    static let none = RunGoal()

    var goalLabel: String {
        guard let type else { return "목표 없음" }
        switch type {
        case .distance:
            guard let v = value, v > 0 else { return "거리 목표" }
            let km = v / 1000.0
            if km == km.rounded() {
                return "\(Int(km))km"
            }
            return String(format: "%.1fkm", km)
        case .time:
            guard let v = value, v > 0 else { return "시간 목표" }
            let totalSec = Int(v)
            let h = totalSec / 3600
            let m = (totalSec % 3600) / 60
            if h > 0 {
                return m > 0 ? "\(h)시간 \(m)분" : "\(h)시간"
            }
            return "\(m)분"
        case .program:
            return "프로그램 러닝"
        case .interval:
            guard let sets = intervalSets else { return "인터벌" }
            return "인터벌 \(sets)세트"
        }
    }
}

// MARK: - Distance Preset

private struct DistancePreset: Identifiable {
    let id = UUID()
    let label: String
    let value: Double // meters
}

private let distancePresets: [DistancePreset] = [
    .init(label: "3km", value: 3000),
    .init(label: "5km", value: 5000),
    .init(label: "10km", value: 10000),
    .init(label: "21km", value: 21097),
    .init(label: "42km", value: 42195),
]

private let programDistancePresets: [DistancePreset] = [
    .init(label: "3km", value: 3000),
    .init(label: "5km", value: 5000),
    .init(label: "10km", value: 10000),
    .init(label: "21km", value: 21097),
]

// MARK: - Time Preset

private struct TimePreset: Identifiable {
    let id = UUID()
    let label: String
    let value: Double // seconds
}

private let timePresets: [TimePreset] = [
    .init(label: "30분", value: 30 * 60),
    .init(label: "1시간", value: 60 * 60),
    .init(label: "1시간 30분", value: 90 * 60),
    .init(label: "2시간", value: 120 * 60),
]

// MARK: - Interval Presets

private let intervalRunPresets = [30, 60, 120, 180, 300]
private let intervalWalkPresets = [30, 60, 90, 120, 180]
private let intervalSetPresets = [3, 5, 7, 10]

// MARK: - Stride / BPM Helpers

/// Get effective stride length in meters.
/// Running stride ~ height x 0.52
private func getStrideLengthM(customStrideCm: Int?, heightCm: Int?) -> Double {
    if let cm = customStrideCm, cm >= 40, cm <= 200 {
        return Double(cm) / 100.0
    }
    if let h = heightCm, h >= 100, h <= 230 {
        return (Double(h) * 0.52) / 100.0
    }
    return 0.88 // default ~170cm x 0.52
}

/// Compute recommended BPM from pace (sec/km) and base stride length.
private func computeRecommendedBPM(paceSecPerKm: Double, baseStrideM: Double) -> Int {
    let paceAdjustment = 1 + (420 - paceSecPerKm) * 0.002
    let adjustedStride = baseStrideM * max(0.85, min(1.45, paceAdjustment))
    let stepsPerKm = 1000.0 / adjustedStride
    let raw = Int((stepsPerKm / paceSecPerKm * 60).rounded())
    return max(100, min(210, raw))
}

/// Format seconds as M'SS" pace string
private func formatPaceValue(_ secondsPerKm: Double) -> String {
    let m = Int(secondsPerKm) / 60
    let s = Int(secondsPerKm) % 60
    return "\(m)'\(String(format: "%02d", s))\""
}

// MARK: - RunGoalSheet

struct RunGoalSheet: View {
    @Binding var goal: RunGoal
    @Environment(\.dismiss) private var dismiss

    // Local editing state
    @State private var selectedType: RunGoalType?
    @State private var selectedValue: Double?
    @State private var customInput: String = ""

    // Interval
    @State private var intervalRunSec: Int = 180
    @State private var intervalWalkSec: Int = 60
    @State private var intervalSets: Int = 5

    // Program
    @State private var programDistance: Double?
    @State private var programDistanceCustom: String = ""
    @State private var programTimeHours: Int = 0
    @State private var programTimeMinutes: Int = 0
    @State private var programTimeSeconds: Int = 0
    @State private var selectedCadence: Int = 0
    @State private var manualBpmInput: String = ""
    @State private var adaptiveMetronome: Bool = false
    @State private var isAutoCadence: Bool = true

    // Stride
    @State private var localStrideCm: Int? = nil
    @State private var strideInput: String = ""

    // Computed
    private var programTargetTime: Int {
        programTimeHours * 3600 + programTimeMinutes * 60 + programTimeSeconds
    }
    private var computedPace: Double? {
        guard let dist = programDistance, dist > 0, programTargetTime > 0 else { return nil }
        return Double(programTargetTime) / (dist / 1000.0)
    }
    private var isProgramComplete: Bool {
        selectedType == .program && (programDistance ?? 0) > 0 && programTargetTime > 0
    }
    private var effectiveStride: Double {
        getStrideLengthM(customStrideCm: localStrideCm, heightCm: nil)
    }
    private var recommendedBPM: Int? {
        guard let pace = computedPace else { return nil }
        return computeRecommendedBPM(paceSecPerKm: pace, baseStrideM: effectiveStride)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: RVSpacing.xxl) {
                    // Goal type selector
                    goalTypeSelector

                    // Type-specific content
                    if let type = selectedType {
                        switch type {
                        case .distance:
                            distanceContent
                        case .time:
                            timeContent
                        case .program:
                            programContent
                        case .interval:
                            intervalContent
                        }
                    }
                }
                .padding(.horizontal, RVSpacing.xl)
                .padding(.top, RVSpacing.lg)
                .padding(.bottom, RVSpacing.huge)
            }
            .scrollDismissesKeyboard(.interactively)
            .background(RVColors.background)
            .navigationTitle("목표 설정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("초기화") {
                        resetAll()
                    }
                    .foregroundStyle(RVColors.textTertiary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("확인") {
                        confirmGoal()
                        dismiss()
                    }
                    .foregroundStyle(RVColors.primary)
                    .fontWeight(.bold)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationBackground(RVColors.background)
        .onAppear {
            syncFromGoal()
        }
        .onChange(of: computedPace) { _, _ in
            updateAutoBPM()
        }
    }

    // MARK: - Goal Type Selector

    private var goalTypeSelector: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 4), spacing: RVSpacing.sm) {
            ForEach(RunGoalType.allCases) { type in
                goalTypeButton(type)
            }
        }
    }

    private func goalTypeButton(_ type: RunGoalType) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            withAnimation(.easeInOut(duration: 0.2)) {
                if selectedType == type {
                    selectedType = nil
                    selectedValue = nil
                } else {
                    selectedType = type
                    selectedValue = nil
                    customInput = ""
                    if type == .program {
                        programDistance = nil
                        programDistanceCustom = ""
                        programTimeHours = 0
                        programTimeMinutes = 0
                        programTimeSeconds = 0
                        selectedCadence = 0
                        manualBpmInput = ""
                        isAutoCadence = true
                    }
                    if type == .interval {
                        intervalRunSec = 180
                        intervalWalkSec = 60
                        intervalSets = 5
                    }
                }
            }
        } label: {
            VStack(spacing: RVSpacing.sm) {
                Image(systemName: type.icon)
                    .font(.system(size: 22))
                Text(type.label)
                    .font(.system(size: RVFontSize.xs, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, RVSpacing.lg)
            .foregroundStyle(selectedType == type ? RVColors.primary : RVColors.textSecondary)
            .background(
                RoundedRectangle(cornerRadius: RVRadius.md)
                    .fill(selectedType == type ? RVColors.primary.opacity(0.12) : RVColors.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: RVRadius.md)
                            .stroke(selectedType == type ? RVColors.primary.opacity(0.3) : Color.clear, lineWidth: 1)
                    )
            )
        }
    }

    // MARK: - Distance Content

    private var distanceContent: some View {
        VStack(spacing: RVSpacing.lg) {
            sectionHeader("거리 선택")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 3), spacing: RVSpacing.sm) {
                ForEach(distancePresets) { preset in
                    presetButton(label: preset.label, isSelected: selectedValue == preset.value && customInput.isEmpty) {
                        selectedValue = preset.value
                        customInput = ""
                    }
                }
            }

            // Custom input
            HStack(spacing: RVSpacing.sm) {
                TextField("직접 입력 (km)", text: $customInput)
                    .keyboardType(.decimalPad)
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.text)
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(RVColors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: RVRadius.sm)
                                    .stroke(RVColors.border, lineWidth: 1)
                            )
                    )

                Button("적용") {
                    applyCustomDistance()
                }
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(RVColors.primary)
                )
            }
        }
    }

    // MARK: - Time Content

    private var timeContent: some View {
        VStack(spacing: RVSpacing.lg) {
            sectionHeader("시간 선택")

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 2), spacing: RVSpacing.sm) {
                ForEach(timePresets) { preset in
                    presetButton(label: preset.label, isSelected: selectedValue == preset.value && customInput.isEmpty) {
                        selectedValue = preset.value
                        customInput = ""
                    }
                }
            }

            // Custom input
            HStack(spacing: RVSpacing.sm) {
                TextField("직접 입력 (분)", text: $customInput)
                    .keyboardType(.numberPad)
                    .font(.system(size: RVFontSize.md, weight: .medium))
                    .foregroundStyle(RVColors.text)
                    .padding(.horizontal, RVSpacing.lg)
                    .padding(.vertical, RVSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(RVColors.surface)
                            .overlay(
                                RoundedRectangle(cornerRadius: RVRadius.sm)
                                    .stroke(RVColors.border, lineWidth: 1)
                            )
                    )

                Button("적용") {
                    applyCustomTime()
                }
                .font(.system(size: RVFontSize.sm, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, RVSpacing.lg)
                .padding(.vertical, RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(RVColors.primary)
                )
            }
        }
    }

    // MARK: - Program Content (RN: distance picker + time wheel + pace + metronome + stride)

    private var programContent: some View {
        VStack(spacing: RVSpacing.xxl) {
            // 1) Target distance
            VStack(spacing: RVSpacing.lg) {
                programSectionHeader(badge: 1, icon: "flag", title: "목표 거리")

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 4), spacing: RVSpacing.sm) {
                    ForEach(programDistancePresets) { preset in
                        presetButton(label: preset.label, isSelected: programDistance == preset.value && programDistanceCustom.isEmpty) {
                            programDistance = preset.value
                            programDistanceCustom = ""
                        }
                    }
                }

                // Custom distance input
                HStack(spacing: RVSpacing.sm) {
                    TextField("직접 입력", text: $programDistanceCustom)
                        .keyboardType(.decimalPad)
                        .font(.system(size: RVFontSize.md, weight: .medium))
                        .foregroundStyle(RVColors.text)
                        .padding(.horizontal, RVSpacing.lg)
                        .padding(.vertical, RVSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: RVRadius.sm)
                                .fill(RVColors.surface)
                                .overlay(
                                    RoundedRectangle(cornerRadius: RVRadius.sm)
                                        .stroke(RVColors.border, lineWidth: 1)
                                )
                        )
                        .onChange(of: programDistanceCustom) { _, newVal in
                            let cleaned = newVal.filter { $0.isNumber || $0 == "." }
                            if cleaned != newVal { programDistanceCustom = cleaned }
                            if let km = Double(cleaned), km > 0 {
                                programDistance = (km * 1000).rounded()
                            }
                        }
                    Text("km")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                        .foregroundStyle(RVColors.textSecondary)
                }
            }

            // 2) Target time — wheel pickers
            VStack(spacing: RVSpacing.lg) {
                HStack(spacing: RVSpacing.sm) {
                    programSectionHeader(badge: 2, icon: "timer", title: "목표 시간")
                    Spacer()
                    if programTargetTime > 0 {
                        Text(formatTimeInput(programTargetTime))
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(RVColors.primary)
                            .padding(.horizontal, RVSpacing.sm)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: RVRadius.xs)
                                    .fill(RVColors.primary.opacity(0.12))
                            )
                    }
                }

                HStack(spacing: RVSpacing.md) {
                    wheelColumn(label: "시", value: $programTimeHours, range: 0...5)
                    Text(":")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(RVColors.textSecondary)
                    wheelColumn(label: "분", value: $programTimeMinutes, range: 0...59)
                    Text(":")
                        .font(.system(size: 22, weight: .bold))
                        .foregroundStyle(RVColors.textSecondary)
                    wheelColumn(label: "초", value: $programTimeSeconds, range: 0...59)
                }
                .frame(height: 150)

                // Computed pace banner
                if let pace = computedPace {
                    HStack(spacing: RVSpacing.xl) {
                        HStack(spacing: RVSpacing.sm) {
                            Image(systemName: "speedometer")
                                .font(.system(size: 18))
                                .foregroundStyle(RVColors.primary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("필요 페이스")
                                    .font(.system(size: RVFontSize.xs, weight: .medium))
                                    .foregroundStyle(RVColors.textSecondary)
                                Text("\(formatPaceValue(pace)) /km")
                                    .font(.system(size: RVFontSize.md, weight: .bold))
                                    .foregroundStyle(RVColors.text)
                            }
                        }
                        if let bpm = recommendedBPM {
                            HStack(spacing: RVSpacing.sm) {
                                Image(systemName: "music.note.list")
                                    .font(.system(size: 18))
                                    .foregroundStyle(RVColors.primary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("추천 BPM")
                                        .font(.system(size: RVFontSize.xs, weight: .medium))
                                        .foregroundStyle(RVColors.textSecondary)
                                    Text("\(bpm)")
                                        .font(.system(size: RVFontSize.md, weight: .bold))
                                        .foregroundStyle(RVColors.text)
                                }
                            }
                        }
                        Spacer()
                    }
                    .padding(RVSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(RVColors.surface)
                    )
                }
            }

            // Stride length setting (shown when pace is computed)
            if computedPace != nil {
                VStack(spacing: RVSpacing.sm) {
                    HStack(spacing: RVSpacing.sm) {
                        Image(systemName: "shoe.2")
                            .font(.system(size: 16))
                            .foregroundStyle(RVColors.primary)
                        Text("보폭 설정")
                            .font(.system(size: RVFontSize.sm, weight: .semibold))
                            .foregroundStyle(RVColors.text)
                        Spacer()
                        Text(localStrideCm != nil ? "커스텀" : "자동")
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(localStrideCm != nil ? RVColors.primary : RVColors.textTertiary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill((localStrideCm != nil ? RVColors.primary : RVColors.textTertiary).opacity(0.12))
                            )
                        Text("\(Int(effectiveStride * 100))cm")
                            .font(.system(size: RVFontSize.sm, weight: .semibold))
                            .foregroundStyle(RVColors.text)
                    }

                    HStack(spacing: RVSpacing.sm) {
                        TextField("보폭 입력", text: $strideInput)
                            .keyboardType(.numberPad)
                            .font(.system(size: RVFontSize.md, weight: .medium))
                            .foregroundStyle(RVColors.text)
                            .padding(.horizontal, RVSpacing.lg)
                            .padding(.vertical, RVSpacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: RVRadius.sm)
                                    .fill(RVColors.surface)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: RVRadius.sm)
                                            .stroke(RVColors.border, lineWidth: 1)
                                    )
                            )
                            .onChange(of: strideInput) { _, newVal in
                                if newVal.isEmpty {
                                    localStrideCm = nil
                                    updateAutoBPM()
                                } else if let num = Int(newVal), num >= 30, num <= 180 {
                                    localStrideCm = num
                                    isAutoCadence = true
                                    updateAutoBPM()
                                }
                            }
                        Text("cm")
                            .font(.system(size: RVFontSize.sm, weight: .bold))
                            .foregroundStyle(RVColors.textSecondary)
                        if localStrideCm != nil {
                            Button("초기화") {
                                strideInput = ""
                                localStrideCm = nil
                                updateAutoBPM()
                            }
                            .font(.system(size: RVFontSize.sm, weight: .semibold))
                            .foregroundStyle(RVColors.primary)
                        }
                    }

                    Text(localStrideCm != nil
                         ? "직접 설정 \(localStrideCm!)cm 적용 중 · 자동 추정 미사용"
                         : "프로필에 키를 입력하면 자동 추정됩니다")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }
            }

            // 3) Cadence metronome
            VStack(spacing: RVSpacing.sm) {
                HStack(spacing: RVSpacing.sm) {
                    programSectionHeader(badge: 3, icon: "music.note.list", title: "메트로놈")
                    if isAutoCadence, recommendedBPM != nil {
                        Text(localStrideCm != nil ? "보폭 기반" : "자동")
                            .font(.system(size: RVFontSize.xs, weight: .bold))
                            .foregroundStyle(RVColors.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 4)
                                    .fill(RVColors.primary.opacity(0.12))
                            )
                    }
                    Spacer()
                    Toggle("", isOn: Binding(
                        get: { selectedCadence > 0 },
                        set: { on in
                            if on {
                                if let bpm = recommendedBPM {
                                    selectedCadence = bpm
                                    isAutoCadence = true
                                } else {
                                    let manual = Int(manualBpmInput) ?? 170
                                    selectedCadence = (manual >= 100 && manual <= 220) ? manual : 170
                                    manualBpmInput = "\(selectedCadence)"
                                    isAutoCadence = false
                                }
                            } else {
                                selectedCadence = 0
                                isAutoCadence = false
                            }
                        }
                    ))
                    .tint(RVColors.primary)
                    .labelsHidden()
                }

                // Auto BPM display
                if selectedCadence > 0, recommendedBPM != nil, isAutoCadence {
                    VStack(spacing: 4) {
                        Text("\(selectedCadence)")
                            .font(.system(size: 36, weight: .black))
                            .foregroundStyle(RVColors.text)
                        Text("BPM")
                            .font(.system(size: RVFontSize.sm, weight: .bold))
                            .foregroundStyle(RVColors.textSecondary)
                        Text(localStrideCm != nil ? "보폭 \(localStrideCm!)cm 기반 케이던스" : "페이스 기반 자동 설정")
                            .font(.system(size: RVFontSize.xs, weight: .medium))
                            .foregroundStyle(RVColors.textTertiary)
                    }
                    .padding(.vertical, RVSpacing.md)
                }

                // Manual BPM input
                if selectedCadence > 0, !isAutoCadence {
                    HStack(spacing: RVSpacing.sm) {
                        TextField("100 ~ 220", text: $manualBpmInput)
                            .keyboardType(.numberPad)
                            .font(.system(size: RVFontSize.md, weight: .medium))
                            .foregroundStyle(RVColors.text)
                            .padding(.horizontal, RVSpacing.lg)
                            .padding(.vertical, RVSpacing.md)
                            .background(
                                RoundedRectangle(cornerRadius: RVRadius.sm)
                                    .fill(RVColors.surface)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: RVRadius.sm)
                                            .stroke(RVColors.border, lineWidth: 1)
                                    )
                            )
                            .onChange(of: manualBpmInput) { _, newVal in
                                if let num = Int(newVal), num >= 100, num <= 220 {
                                    selectedCadence = num
                                }
                            }
                        Text("BPM")
                            .font(.system(size: RVFontSize.sm, weight: .bold))
                            .foregroundStyle(RVColors.textSecondary)
                    }
                }

                if selectedCadence == 0 {
                    Text("달리기 리듬을 유지하는 메트로놈을 켤 수 있습니다")
                        .font(.system(size: RVFontSize.xs, weight: .medium))
                        .foregroundStyle(RVColors.textTertiary)
                }

                // Adaptive metronome toggle
                if selectedCadence > 0 {
                    HStack(spacing: RVSpacing.md) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("가변 메트로놈")
                                .font(.system(size: RVFontSize.sm, weight: .bold))
                                .foregroundStyle(RVColors.text)
                            Text("목표 페이스에 맞춰 실시간으로 박자를 조절합니다. 페이스가 떨어지면 템포를 높여주고, 오버페이스 시 템포를 낮춰 체력 소모를 줄여줍니다.")
                                .font(.system(size: RVFontSize.xs, weight: .medium))
                                .foregroundStyle(RVColors.textTertiary)
                                .lineLimit(nil)
                        }
                        Toggle("", isOn: $adaptiveMetronome)
                            .tint(RVColors.primary)
                            .labelsHidden()
                    }
                    .padding(RVSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: RVRadius.sm)
                            .fill(RVColors.surface)
                    )
                }
            }

            // Summary banner
            if isProgramComplete, let pace = computedPace {
                HStack {
                    Spacer()
                    Text("\(String(format: "%.1f", (programDistance ?? 0) / 1000.0))km · \(formatTimeInput(programTargetTime)) · \(formatPaceValue(pace)) /km\(selectedCadence > 0 ? " · \(selectedCadence) BPM" : "")")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                    Spacer()
                }
                .padding(.vertical, RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(RVColors.primary.opacity(0.08))
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.sm)
                                .stroke(RVColors.primary.opacity(0.2), lineWidth: 1)
                        )
                )
            }
        }
    }

    // MARK: - Interval Content (RN: run seconds + walk seconds + sets + timeline)

    private var intervalContent: some View {
        VStack(spacing: RVSpacing.xxl) {
            // Run duration
            VStack(spacing: RVSpacing.lg) {
                HStack(spacing: RVSpacing.sm) {
                    Circle()
                        .fill(RVColors.primary.opacity(0.12))
                        .frame(width: 24, height: 24)
                        .overlay(
                            Image(systemName: "bolt.fill")
                                .font(.system(size: 13))
                                .foregroundStyle(RVColors.primary)
                        )
                    Text("달리기")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.text)
                    Text(formatTimeInput(intervalRunSec))
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, RVSpacing.sm)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: RVRadius.xs)
                                .fill(RVColors.primary.opacity(0.12))
                        )
                    Spacer()
                }

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 3), spacing: RVSpacing.sm) {
                    ForEach(intervalRunPresets, id: \.self) { sec in
                        presetButton(label: formatTimeInput(sec), isSelected: intervalRunSec == sec) {
                            intervalRunSec = sec
                        }
                    }
                }
            }

            // Walk duration
            VStack(spacing: RVSpacing.lg) {
                HStack(spacing: RVSpacing.sm) {
                    Circle()
                        .fill(Color(hex: "10B981").opacity(0.12))
                        .frame(width: 24, height: 24)
                        .overlay(
                            Image(systemName: "figure.walk")
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "10B981"))
                        )
                    Text("걷기")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.text)
                    Text(formatTimeInput(intervalWalkSec))
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, RVSpacing.sm)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: RVRadius.xs)
                                .fill(RVColors.primary.opacity(0.12))
                        )
                    Spacer()
                }

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 3), spacing: RVSpacing.sm) {
                    ForEach(intervalWalkPresets, id: \.self) { sec in
                        presetButton(label: formatTimeInput(sec), isSelected: intervalWalkSec == sec) {
                            intervalWalkSec = sec
                        }
                    }
                }
            }

            // Sets
            VStack(spacing: RVSpacing.lg) {
                HStack(spacing: RVSpacing.sm) {
                    Circle()
                        .fill(Color(hex: "8E8E93").opacity(0.15))
                        .frame(width: 24, height: 24)
                        .overlay(
                            Image(systemName: "repeat")
                                .font(.system(size: 13))
                                .foregroundStyle(Color(hex: "8E8E93"))
                        )
                    Text("반복")
                        .font(.system(size: RVFontSize.sm, weight: .semibold))
                        .foregroundStyle(RVColors.text)
                    Text("\(intervalSets)세트")
                        .font(.system(size: RVFontSize.xs, weight: .bold))
                        .foregroundStyle(RVColors.primary)
                        .padding(.horizontal, RVSpacing.sm)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: RVRadius.xs)
                                .fill(RVColors.primary.opacity(0.12))
                        )
                    Spacer()
                }

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: RVSpacing.sm), count: 4), spacing: RVSpacing.sm) {
                    ForEach(intervalSetPresets, id: \.self) { count in
                        presetButton(label: "\(count)세트", isSelected: intervalSets == count) {
                            intervalSets = count
                        }
                    }
                }
            }

            // Timeline visualization + summary
            if intervalRunSec > 0, intervalWalkSec > 0, intervalSets > 0 {
                VStack(spacing: RVSpacing.md) {
                    // Visual blocks
                    HStack(spacing: 2) {
                        ForEach(0..<min(intervalSets, 8), id: \.self) { _ in
                            let total = Double(intervalRunSec + intervalWalkSec)
                            let runRatio = Double(intervalRunSec) / total
                            GeometryReader { geo in
                                HStack(spacing: 0) {
                                    Rectangle()
                                        .fill(RVColors.primary)
                                        .frame(width: geo.size.width * runRatio)
                                    Rectangle()
                                        .fill(Color(hex: "10B981"))
                                }
                            }
                            .frame(height: 8)
                            .clipShape(RoundedRectangle(cornerRadius: 4))
                        }
                        if intervalSets > 8 {
                            Text("+\(intervalSets - 8)")
                                .font(.system(size: RVFontSize.xs, weight: .bold))
                                .foregroundStyle(RVColors.textTertiary)
                        }
                    }

                    // Legend
                    HStack(spacing: RVSpacing.lg) {
                        HStack(spacing: 4) {
                            Circle().fill(RVColors.primary).frame(width: 8, height: 8)
                            Text("달리기 \(formatTimeInput(intervalRunSec))")
                                .font(.system(size: RVFontSize.xs, weight: .medium))
                                .foregroundStyle(RVColors.textSecondary)
                        }
                        HStack(spacing: 4) {
                            Circle().fill(Color(hex: "10B981")).frame(width: 8, height: 8)
                            Text("걷기 \(formatTimeInput(intervalWalkSec))")
                                .font(.system(size: RVFontSize.xs, weight: .medium))
                                .foregroundStyle(RVColors.textSecondary)
                        }
                    }

                    Text("총 운동 시간: \(formatTimeInput((intervalRunSec + intervalWalkSec) * intervalSets))")
                        .font(.system(size: RVFontSize.sm, weight: .bold))
                        .foregroundStyle(RVColors.text)
                }
                .padding(RVSpacing.md)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(RVColors.surface)
                )
            }
        }
    }

    // MARK: - Shared Components

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: RVFontSize.sm, weight: .semibold))
                .foregroundStyle(RVColors.textTertiary)
            Spacer()
        }
    }

    private func programSectionHeader(badge: Int, icon: String, title: String) -> some View {
        HStack(spacing: RVSpacing.sm) {
            Text("\(badge)")
                .font(.system(size: RVFontSize.xs, weight: .bold))
                .foregroundStyle(RVColors.primary)
                .frame(width: 20, height: 20)
                .background(
                    Circle().fill(RVColors.primary.opacity(0.12))
                )
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(RVColors.primary)
            Text(title)
                .font(.system(size: RVFontSize.sm, weight: .semibold))
                .foregroundStyle(RVColors.text)
        }
    }

    private func presetButton(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            action()
        } label: {
            Text(label)
                .font(.system(size: RVFontSize.md, weight: .bold))
                .foregroundStyle(isSelected ? RVColors.primary : RVColors.text)
                .frame(maxWidth: .infinity)
                .padding(.vertical, RVSpacing.lg)
                .background(
                    RoundedRectangle(cornerRadius: RVRadius.sm)
                        .fill(isSelected ? RVColors.primary.opacity(0.12) : RVColors.surface)
                        .overlay(
                            RoundedRectangle(cornerRadius: RVRadius.sm)
                                .stroke(isSelected ? RVColors.primary.opacity(0.3) : RVColors.border, lineWidth: 1)
                        )
                )
        }
    }

    private func wheelColumn(label: String, value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        VStack(spacing: RVSpacing.xs) {
            Text(label)
                .font(.system(size: RVFontSize.xs, weight: .bold))
                .foregroundStyle(RVColors.textSecondary)

            Picker(label, selection: value) {
                ForEach(Array(range), id: \.self) { v in
                    Text(String(format: "%02d", v))
                        .font(.system(size: 22, weight: .bold, design: .monospaced))
                        .foregroundStyle(RVColors.text)
                        .tag(v)
                }
            }
            .pickerStyle(.wheel)
            .frame(maxWidth: .infinity)
        }
    }

    // MARK: - Actions

    private func syncFromGoal() {
        selectedType = goal.type
        selectedValue = goal.value
        if goal.type == .interval {
            intervalRunSec = goal.intervalRunSeconds ?? 180
            intervalWalkSec = goal.intervalWalkSeconds ?? 60
            intervalSets = goal.intervalSets ?? 5
        }
        if goal.type == .program {
            programDistance = goal.value
            let t = goal.targetTime ?? 0
            programTimeHours = t / 3600
            programTimeMinutes = (t % 3600) / 60
            programTimeSeconds = t % 60
            selectedCadence = goal.cadenceBPM ?? 0
            manualBpmInput = (goal.cadenceBPM ?? 0) > 0 ? "\(goal.cadenceBPM!)" : ""
            adaptiveMetronome = goal.adaptiveMetronome ?? false
        }
    }

    private func resetAll() {
        selectedType = nil
        selectedValue = nil
        customInput = ""
        programDistance = nil
        programDistanceCustom = ""
        programTimeHours = 0
        programTimeMinutes = 0
        programTimeSeconds = 0
        selectedCadence = 0
        manualBpmInput = ""
        adaptiveMetronome = false
        isAutoCadence = true
        localStrideCm = nil
        strideInput = ""
        intervalRunSec = 180
        intervalWalkSec = 60
        intervalSets = 5
        goal = .none
    }

    private func confirmGoal() {
        guard let type = selectedType else {
            goal = .none
            return
        }
        switch type {
        case .distance:
            goal = RunGoal(type: .distance, value: selectedValue)
        case .time:
            goal = RunGoal(type: .time, value: selectedValue)
        case .program:
            let totalSecs = programTimeHours * 3600 + programTimeMinutes * 60 + programTimeSeconds
            goal = RunGoal(
                type: .program,
                value: programDistance,
                targetTime: totalSecs > 0 ? totalSecs : nil,
                cadenceBPM: selectedCadence > 0 ? selectedCadence : nil,
                adaptiveMetronome: selectedCadence > 0 ? adaptiveMetronome : nil
            )
        case .interval:
            let totalSecs = Double((intervalRunSec + intervalWalkSec) * intervalSets)
            goal = RunGoal(
                type: .interval,
                value: totalSecs,
                intervalRunSeconds: intervalRunSec,
                intervalWalkSeconds: intervalWalkSec,
                intervalSets: intervalSets
            )
        }
    }

    private func applyCustomDistance() {
        guard let num = Double(customInput), num > 0 else { return }
        selectedValue = num * 1000
    }

    private func applyCustomTime() {
        guard let num = Double(customInput), num > 0 else { return }
        selectedValue = num * 60
    }

    private func updateAutoBPM() {
        if isAutoCadence, let bpm = recommendedBPM, selectedType == .program {
            selectedCadence = bpm
        }
    }

    private func formatSeconds(_ totalSeconds: Int) -> String {
        let h = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        let s = totalSeconds % 60
        if h > 0 {
            return m > 0 ? "\(h)시간 \(m)분" : "\(h)시간"
        }
        if m > 0 {
            return s > 0 ? "\(m)분 \(s)초" : "\(m)분"
        }
        return "\(s)초"
    }

    private func formatTimeInput(_ totalSeconds: Int) -> String {
        let h = totalSeconds / 3600
        let m = (totalSeconds % 3600) / 60
        let s = totalSeconds % 60
        var parts: [String] = []
        if h > 0 { parts.append("\(h)시간") }
        if m > 0 { parts.append("\(m)분") }
        if s > 0 { parts.append("\(s)초") }
        return parts.isEmpty ? "0초" : parts.joined(separator: " ")
    }
}
