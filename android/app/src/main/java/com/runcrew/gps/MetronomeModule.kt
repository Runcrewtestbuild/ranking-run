package com.runcrew.gps

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.exp
import kotlin.math.sin

/**
 * Native metronome module for Android.
 *
 * Uses AudioTrack in MODE_STREAM with a dedicated audio thread that
 * continuously writes [click + silence] frames. This avoids the
 * stop/reload/play gaps of MODE_STATIC which caused intermittent
 * click dropouts.
 *
 * Matched with iOS MetronomeModule: 800Hz base + 1600Hz harmonic, 25ms click.
 */
class MetronomeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "MetronomeModule"

    @Volatile private var audioThread: Thread? = null
    @Volatile private var isRunning = false
    @Volatile private var currentBPM = 0.0
    @Volatile private var pendingBeatBuffer: ShortArray? = null
    @Volatile private var volume = 0.55f
    private val beepPlaying = AtomicBoolean(false)

    companion object {
        private const val TAG = "Metronome"
        private const val SAMPLE_RATE = 44100
        private const val CLICK_DURATION_SEC = 0.025 // 25ms — matched with iOS
        private const val BASE_FREQ = 800.0
        private const val HARMONIC_FREQ = 1600.0
        private const val HARMONIC_MIX = 0.3f
    }

    private fun generateClickSamples(): ShortArray {
        val frameCount = (SAMPLE_RATE * CLICK_DURATION_SEC).toInt()
        val samples = ShortArray(frameCount)
        val attackFrames = (SAMPLE_RATE * 0.001).toInt() // 1ms attack

        for (i in 0 until frameCount) {
            val t = i.toDouble() / SAMPLE_RATE
            val base = sin(2.0 * Math.PI * BASE_FREQ * t).toFloat()
            val harmonic = sin(2.0 * Math.PI * HARMONIC_FREQ * t).toFloat()
            var sample = base + HARMONIC_MIX * harmonic

            // Envelope: linear attack + exponential decay
            if (i < attackFrames) {
                sample *= i.toFloat() / attackFrames.coerceAtLeast(1).toFloat()
            }
            val decayProgress = i.toDouble() / frameCount
            sample *= exp(-5.0 * decayProgress).toFloat()
            sample *= volume

            // Convert to 16-bit PCM
            samples[i] = (sample * Short.MAX_VALUE).toInt()
                .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
        }
        return samples
    }

    @ReactMethod
    fun start(bpm: Double) {
        if (bpm < 40 || bpm > 240) {
            if (bpm <= 0) stop()
            Log.w(TAG, "BPM out of range (40–240): ${bpm.toInt()}")
            return
        }
        if (isRunning && currentBPM == bpm) return
        if (isRunning) stopInternal()

        currentBPM = bpm
        isRunning = true

        val clickSamples = generateClickSamples()

        // Total samples per beat period (click + silence)
        val beatPeriodSamples = (SAMPLE_RATE * 60.0 / bpm).toInt()
        val silenceSamples = beatPeriodSamples - clickSamples.size

        // Build one full beat: click followed by silence
        val beatBuffer = ShortArray(beatPeriodSamples)
        clickSamples.copyInto(beatBuffer, 0)
        // Rest is already zero (silence)

        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        val thread = Thread({
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)

            var track: AudioTrack? = null
            try {
                track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(SAMPLE_RATE)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(maxOf(beatBuffer.size * 2, minBuf))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

                track.play()

                // Continuously stream beat buffers until stopped.
                // Check for pending BPM changes between beats.
                var activeBuf = beatBuffer
                while (isRunning) {
                    // Hot-swap beat buffer if BPM was changed via setBPM()
                    pendingBeatBuffer?.let { newBuf ->
                        activeBuf = newBuf
                        pendingBeatBuffer = null
                    }
                    val written = track.write(activeBuf, 0, activeBuf.size)
                    if (written < 0) {
                        Log.w(TAG, "AudioTrack write error: $written — restarting")
                        // AudioTrack was killed by system (background audio policy).
                        // Break and let the finally block clean up.
                        break
                    }
                }

                try { track.stop() } catch (_: Exception) {}
            } catch (e: Exception) {
                Log.e(TAG, "Audio thread error: ${e.message}")
            } finally {
                try { track?.release() } catch (_: Exception) {}
                // Mark as stopped so start() creates fresh resources
                isRunning = false
                currentBPM = 0.0
                Log.i(TAG, "Audio thread ended")
            }
        }, "metronome-audio")
        thread.priority = Thread.MAX_PRIORITY
        thread.start()
        audioThread = thread

        Log.i(TAG, "Started at ${bpm.toInt()} BPM (period: ${beatBuffer.size} samples)")
    }

    @ReactMethod
    fun stop() {
        stopInternal()
    }

    private fun stopInternal() {
        isRunning = false

        audioThread?.let { t ->
            t.interrupt()  // Interrupt blocking AudioTrack.write
            try {
                t.join(2000) // Wait longer to ensure thread finishes
            } catch (_: InterruptedException) {}
        }
        audioThread = null

        currentBPM = 0.0
        Log.i(TAG, "Stopped")
    }

    @ReactMethod
    fun setBPM(bpm: Double) {
        if (bpm <= 0) {
            stop()
            return
        }
        if (!isRunning || bpm == currentBPM) return

        // Build new beat buffer and hot-swap it into the audio loop
        // without stopping/restarting the thread (no click gap).
        currentBPM = bpm
        val clickSamples = generateClickSamples()
        val beatPeriodSamples = (SAMPLE_RATE * 60.0 / bpm).toInt()
        val newBuffer = ShortArray(beatPeriodSamples)
        clickSamples.copyInto(newBuffer, 0)
        pendingBeatBuffer = newBuffer
        Log.i(TAG, "BPM changed to ${bpm.toInt()}")
    }

    @ReactMethod
    fun setVolume(vol: Double) {
        val clamped = vol.toFloat().coerceIn(0f, 1f)
        volume = clamped
        // Regenerate beat buffer with new volume if currently running
        if (isRunning && currentBPM > 0) {
            val clickSamples = generateClickSamples()
            val beatPeriodSamples = (SAMPLE_RATE * 60.0 / currentBPM).toInt()
            val newBuffer = ShortArray(beatPeriodSamples)
            clickSamples.copyInto(newBuffer, 0)
            pendingBeatBuffer = newBuffer
        }
        Log.i(TAG, "Volume set to ${"%.2f".format(clamped)}")
    }

    @ReactMethod
    fun isPlaying(promise: Promise) {
        promise.resolve(isRunning)
    }

    /**
     * Play a short beep tone [count] times.
     * count=1: single beep (삐) for run start
     * count=2: double beep (삐삐) for walk start
     */
    @ReactMethod
    fun playBeep(count: Int) {
        if (!beepPlaying.compareAndSet(false, true)) return // Skip if already playing
        Thread({
            try {
                android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_AUDIO)
                playBeepSync(count)
            } finally {
                beepPlaying.set(false)
            }
        }, "beep-audio").start()
    }

    private fun playBeepSync(count: Int) {
        val beepDurationSec = 0.12   // 120ms per beep
        val gapDurationSec = 0.12    // 120ms gap between beeps
        val freq = 1000.0            // 1kHz — distinct from metronome 800Hz
        val volume = 0.7f

        val beepFrames = (SAMPLE_RATE * beepDurationSec).toInt()
        val gapFrames = (SAMPLE_RATE * gapDurationSec).toInt()
        val totalFrames = beepFrames * count + gapFrames * maxOf(count - 1, 0)
        val samples = ShortArray(totalFrames)

        val fadeInFrames = (SAMPLE_RATE * 0.002).toInt()   // 2ms fade in
        val fadeOutFrames = (SAMPLE_RATE * 0.005).toInt()  // 5ms fade out
        var writeIdx = 0

        for (b in 0 until count) {
            for (i in 0 until beepFrames) {
                val t = i.toDouble() / SAMPLE_RATE
                var sample = sin(2.0 * Math.PI * freq * t).toFloat()

                // Fade in / fade out
                if (i < fadeInFrames) {
                    sample *= i.toFloat() / fadeInFrames
                } else if (i >= beepFrames - fadeOutFrames) {
                    val remaining = beepFrames - i
                    sample *= remaining.toFloat() / fadeOutFrames
                }

                sample *= volume
                samples[writeIdx] = (sample * Short.MAX_VALUE).toInt()
                    .coerceIn(Short.MIN_VALUE.toInt(), Short.MAX_VALUE.toInt()).toShort()
                writeIdx++
            }
            // Gap (silence) between beeps
            if (b < count - 1) {
                for (g in 0 until gapFrames) {
                    samples[writeIdx] = 0
                    writeIdx++
                }
            }
        }

        val minBuf = AudioTrack.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        var track: AudioTrack? = null
        try {
            // USAGE_ALARM bypasses silent/vibrate mode — beep always plays
            track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(SAMPLE_RATE)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(maxOf(samples.size * 2, minBuf))
                .setTransferMode(AudioTrack.MODE_STATIC)
                .build()

            track.write(samples, 0, samples.size)
            track.play()

            // Wait for playback to finish
            val playbackMs = (totalFrames.toDouble() / SAMPLE_RATE * 1000).toLong() + 50
            Thread.sleep(playbackMs)

            track.stop()
        } catch (e: Exception) {
            Log.e(TAG, "Beep playback error: ${e.message}")
        } finally {
            try { track?.release() } catch (_: Exception) {}
        }
    }
}
