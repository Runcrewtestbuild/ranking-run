import Foundation
import AVFoundation

/// Metronome engine for goal-based running (cadence guidance).
/// Plays a configurable BPM click sound using AVAudioEngine for low-latency audio.
@Observable
final class MetronomeEngine {
    private(set) var isPlaying = false
    private(set) var bpm: Int = 180

    private var audioEngine: AVAudioEngine?
    private var playerNode: AVAudioPlayerNode?
    private var clickBuffer: AVAudioPCMBuffer?
    private var timer: DispatchSourceTimer?

    // MARK: - Public API

    /// Start the metronome at the given BPM
    func start(bpm: Int = 180) {
        guard !isPlaying else {
            // If already playing, just update BPM
            if self.bpm != bpm {
                self.bpm = bpm
                restartTimer()
            }
            return
        }

        self.bpm = bpm

        do {
            try setupAudioEngine()
            startTimer()
            isPlaying = true
            NSLog("[Metronome] Started at %d BPM", bpm)
        } catch {
            NSLog("[Metronome] Failed to start: %@", error.localizedDescription)
        }
    }

    /// Stop the metronome
    func stop() {
        timer?.cancel()
        timer = nil
        playerNode?.stop()
        audioEngine?.stop()
        audioEngine = nil
        playerNode = nil
        isPlaying = false
        NSLog("[Metronome] Stopped")
    }

    /// Update BPM while playing
    func setBPM(_ newBPM: Int) {
        guard newBPM > 0 && newBPM <= 300 else { return }
        bpm = newBPM
        if isPlaying {
            restartTimer()
        }
    }

    // MARK: - Audio Setup

    private func setupAudioEngine() throws {
        let engine = AVAudioEngine()
        let player = AVAudioPlayerNode()

        engine.attach(player)

        let format = AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1)!
        engine.connect(player, to: engine.mainMixerNode, format: format)

        // Generate click buffer (short sine wave burst)
        clickBuffer = generateClickBuffer(format: format)

        // Configure audio session to mix with other audio
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)

        try engine.start()
        player.play()

        self.audioEngine = engine
        self.playerNode = player
    }

    private func generateClickBuffer(format: AVAudioFormat) -> AVAudioPCMBuffer {
        let sampleRate = format.sampleRate
        // Short click: 30ms sine wave at 1000Hz with envelope
        let duration = 0.03
        let frameCount = AVAudioFrameCount(sampleRate * duration)
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frameCount)!
        buffer.frameLength = frameCount

        let channelData = buffer.floatChannelData![0]
        let frequency = 1000.0

        for i in 0..<Int(frameCount) {
            let t = Double(i) / sampleRate
            // Sine wave with exponential decay envelope
            let envelope = exp(-t * 100)
            channelData[i] = Float(sin(2.0 * .pi * frequency * t) * envelope * 0.5)
        }

        return buffer
    }

    // MARK: - Timer

    private func startTimer() {
        let interval = 60.0 / Double(bpm)

        let t = DispatchSource.makeTimerSource(queue: .global(qos: .userInteractive))
        t.schedule(deadline: .now(), repeating: interval)
        t.setEventHandler { [weak self] in
            self?.playClick()
        }
        timer = t
        t.resume()
    }

    private func restartTimer() {
        timer?.cancel()
        timer = nil
        startTimer()
    }

    private func playClick() {
        guard let player = playerNode, let buffer = clickBuffer else { return }
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
    }

    deinit {
        stop()
    }
}
