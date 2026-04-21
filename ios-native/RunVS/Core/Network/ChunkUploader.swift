import Foundation
import UIKit

/// Uploads GPS data chunks to the server during a run.
/// Matches the behavior of RN's useRunningChunkUpload:
/// - Upload every 1km of distance OR every 5 minutes (whichever comes first)
/// - On failure, save chunk locally for retry
/// - Emergency save on background transition
///
/// Usage: RunningViewModel creates and retains a ChunkUploader, calling
/// `onDistanceUpdate()` on each GPS update. The uploader handles timing internally.
final class ChunkUploader {
    // MARK: - Configuration

    private let chunkDistanceThreshold: Double = 1000  // 1km
    private let chunkTimeThreshold: TimeInterval = 5 * 60  // 5 minutes
    private let uploadTimeout: TimeInterval = 30  // 30s upload timeout

    // MARK: - State

    private var sessionId: String
    private var isUploading = false
    private var chunkSequence: Int = 0
    private var lastChunkDistance: Double = 0
    private var lastChunkTimestamp: TimeInterval
    private var lastChunkPointIndex: Int = 0
    private var uploadedSequences: Set<Int> = []
    private var timeCheckTimer: Timer?
    private var backgroundObserver: NSObjectProtocol?

    // Weak reference to avoid retain cycles
    private weak var dataSource: ChunkUploaderDataSource?

    init(sessionId: String, dataSource: ChunkUploaderDataSource) {
        self.sessionId = sessionId
        self.dataSource = dataSource
        self.lastChunkTimestamp = Date().timeIntervalSince1970 * 1000
        startTimeCheck()
        observeBackground()
    }

    deinit {
        timeCheckTimer?.invalidate()
        if let observer = backgroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    /// Call on each distance update to check if a chunk upload is needed
    func onDistanceUpdate(currentDistance: Double) {
        guard currentDistance - lastChunkDistance >= chunkDistanceThreshold else { return }
        tryUploadChunk()
    }

    /// Upload the final chunk when the run completes
    func uploadFinalChunk() {
        tryUploadChunk(chunkType: "final")
    }

    /// The set of successfully uploaded chunk sequences
    var uploadedChunkSet: Set<Int> { uploadedSequences }
    var currentChunkSequence: Int { chunkSequence }
    var currentLastChunkDistance: Double { lastChunkDistance }
    var currentLastChunkPointIndex: Int { lastChunkPointIndex }

    // MARK: - Core Upload Logic

    private func tryUploadChunk(chunkType: String = "intermediate") {
        guard !isUploading else { return }
        guard !sessionId.hasPrefix("local_") else { return }
        guard let source = dataSource else { return }

        let locations = source.getFilteredLocations()
        let newPoints = Array(locations.suffix(from: min(lastChunkPointIndex, locations.count)))
        guard !newPoints.isEmpty else { return }

        isUploading = true
        let seq = chunkSequence
        let pointIndex = locations.count

        // Build raw GPS points for API
        let rawGPSPoints: [[String: Any]] = newPoints.map { point in
            [
                "lat": point.latitude,
                "lng": point.longitude,
                "alt": point.altitude,
                "speed": point.speed,
                "bearing": point.bearing,
                "accuracy": 10,
                "timestamp": Int(point.timestamp)
            ]
        }

        let chunkDistance = source.getCurrentDistance() - lastChunkDistance
        let startTs = newPoints.first?.timestamp ?? 0
        let endTs = newPoints.last?.timestamp ?? 0

        let chunkBody: [String: Any] = [
            "session_id": sessionId,
            "sequence": seq,
            "chunk_type": chunkType,
            "raw_gps_points": rawGPSPoints,
            "chunk_summary": [
                "distance_meters": Int(chunkDistance),
                "duration_seconds": Int((endTs - startTs) / 1000),
                "avg_pace_seconds_per_km": Int(source.getAvgPace()),
                "elevation_change_meters": Int(source.getElevationGain()),
                "point_count": rawGPSPoints.count,
                "start_timestamp": Int(startTs),
                "end_timestamp": Int(endTs)
            ],
            "cumulative": [
                "total_distance_meters": Int(source.getCurrentDistance()),
                "total_duration_seconds": source.getDurationSeconds(),
                "avg_pace_seconds_per_km": Int(source.getAvgPace())
            ],
            "completed_splits": source.getSplitsForUpload(),
            "pause_intervals": source.getPauseIntervalsForUpload()
        ]

        chunkSequence += 1

        Task {
            do {
                try await withThrowingTaskGroup(of: Void.self) { group in
                    group.addTask {
                        try await APIClient.shared.requestVoid(
                            .uploadChunk(sessionId: self.sessionId, body: chunkBody)
                        )
                    }
                    group.addTask {
                        try await Task.sleep(nanoseconds: UInt64(self.uploadTimeout * 1_000_000_000))
                        throw ChunkUploadError.timeout
                    }
                    // First to complete wins; cancel the other
                    try await group.next()
                    group.cancelAll()
                }

                await MainActor.run {
                    self.uploadedSequences.insert(seq)
                    self.lastChunkPointIndex = pointIndex
                    self.lastChunkDistance = self.dataSource?.getCurrentDistance() ?? self.lastChunkDistance
                    self.lastChunkTimestamp = Date().timeIntervalSince1970 * 1000
                    self.isUploading = false
                }
                NSLog("[ChunkUpload] Chunk %d uploaded (%d pts, %.0fm)",
                      seq, rawGPSPoints.count, chunkDistance)
            } catch {
                NSLog("[ChunkUpload] Chunk %d failed, saving locally: %@",
                      seq, error.localizedDescription)
                await saveFailedChunkLocally(id: "chunk-\(sessionId)-\(seq)", body: chunkBody)
                await MainActor.run {
                    self.lastChunkPointIndex = pointIndex
                    self.lastChunkDistance = self.dataSource?.getCurrentDistance() ?? self.lastChunkDistance
                    self.lastChunkTimestamp = Date().timeIntervalSince1970 * 1000
                    self.isUploading = false
                }
            }
        }
    }

    // MARK: - Time-Based Check

    private func startTimeCheck() {
        timeCheckTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            guard let self else { return }
            let elapsed = Date().timeIntervalSince1970 * 1000 - self.lastChunkTimestamp
            if elapsed >= self.chunkTimeThreshold * 1000 {
                self.tryUploadChunk()
            }
        }
    }

    // MARK: - Background Emergency Save

    private func observeBackground() {
        backgroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willResignActiveNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.emergencySave()
        }
    }

    private func emergencySave() {
        guard let source = dataSource else { return }
        guard !sessionId.hasPrefix("local_") else { return }

        let locations = source.getFilteredLocations()
        let newPoints = Array(locations.suffix(from: min(lastChunkPointIndex, locations.count)))
        guard !newPoints.isEmpty else { return }

        let emergencySeq = 900000 + chunkSequence
        let rawGPSPoints: [[String: Any]] = newPoints.map { point in
            [
                "lat": point.latitude,
                "lng": point.longitude,
                "alt": point.altitude,
                "speed": point.speed,
                "bearing": point.bearing,
                "accuracy": 10,
                "timestamp": Int(point.timestamp)
            ]
        }

        let startTs = newPoints.first?.timestamp ?? 0
        let endTs = newPoints.last?.timestamp ?? 0

        let emergencyBody: [String: Any] = [
            "session_id": sessionId,
            "sequence": emergencySeq,
            "chunk_type": "emergency",
            "raw_gps_points": rawGPSPoints,
            "chunk_summary": [
                "distance_meters": Int(source.getCurrentDistance() - lastChunkDistance),
                "duration_seconds": Int((endTs - startTs) / 1000),
                "avg_pace_seconds_per_km": Int(source.getAvgPace()),
                "elevation_change_meters": Int(source.getElevationGain()),
                "point_count": rawGPSPoints.count,
                "start_timestamp": Int(startTs),
                "end_timestamp": Int(endTs)
            ],
            "cumulative": [
                "total_distance_meters": Int(source.getCurrentDistance()),
                "total_duration_seconds": source.getDurationSeconds(),
                "avg_pace_seconds_per_km": Int(source.getAvgPace())
            ]
        ]

        Task {
            await saveFailedChunkLocally(
                id: "chunk-emergency-\(sessionId)-\(emergencySeq)",
                body: emergencyBody
            )
        }
        NSLog("[ChunkUpload] Emergency save on background (%d pts)", rawGPSPoints.count)
    }

    // MARK: - Local Storage for Failed Chunks

    private func saveFailedChunkLocally(id: String, body: [String: Any]) async {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let chunksDir = docs.appendingPathComponent("pending_chunks")
        try? FileManager.default.createDirectory(at: chunksDir, withIntermediateDirectories: true)

        let fileURL = chunksDir.appendingPathComponent("\(id).json")
        do {
            let data = try JSONSerialization.data(withJSONObject: body, options: [])
            try data.write(to: fileURL, options: .atomic)
        } catch {
            NSLog("[ChunkUpload] Failed to save chunk locally: %@", error.localizedDescription)
        }
    }

    /// Retry all pending chunks (call on app launch or network recovery)
    static func retryPendingChunks() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let chunksDir = docs.appendingPathComponent("pending_chunks")

        guard let files = try? FileManager.default.contentsOfDirectory(
            at: chunksDir, includingPropertiesForKeys: nil
        ) else { return }

        for file in files where file.pathExtension == "json" {
            Task {
                do {
                    let data = try Data(contentsOf: file)
                    guard let body = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                          let sessionId = body["session_id"] as? String else { return }

                    try await APIClient.shared.requestVoid(
                        .uploadChunk(sessionId: sessionId, body: body)
                    )
                    try FileManager.default.removeItem(at: file)
                    NSLog("[ChunkUpload] Retry succeeded: %@", file.lastPathComponent)
                } catch {
                    NSLog("[ChunkUpload] Retry failed: %@", error.localizedDescription)
                }
            }
        }
    }
}

// MARK: - Data Source Protocol

/// Protocol for the chunk uploader to read running state from the ViewModel.
/// Avoids tight coupling between ChunkUploader and RunningViewModel.
protocol ChunkUploaderDataSource: AnyObject {
    func getFilteredLocations() -> [FilteredLocationPoint]
    func getCurrentDistance() -> Double
    func getAvgPace() -> Double
    func getElevationGain() -> Double
    func getDurationSeconds() -> Int
    func getSplitsForUpload() -> [[String: Any]]
    func getPauseIntervalsForUpload() -> [[String: Any]]
}

// MARK: - Errors

enum ChunkUploadError: Error {
    case timeout
}
