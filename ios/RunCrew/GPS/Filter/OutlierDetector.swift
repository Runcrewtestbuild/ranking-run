import Foundation
import CoreLocation

/// Outlier detection and removal for GPS points
class OutlierDetector {
    private var lastValidLocation: CLLocation?
    private var recentSpeeds: [Double] = []
    private let maxRecentSpeeds = 10

    // Thresholds
    private let maxHorizontalAccuracy: Double = 30.0  // meters (matches Android + CLAUDE.md spec; 25m rejected too many valid urban GPS readings)
    private let maxSpeed: Double = 15.0                // m/s (~54 km/h)
    private let maxAcceleration: Double = 8.0          // m/s²
    private let maxTimestampAge: TimeInterval = 10.0   // seconds (matches Android; 5s was too strict for background/brief signal loss)
    private let minTimeBetweenUpdates: TimeInterval = 0.05 // seconds (allow more frequent updates)

    // Adaptive speed thresholds (matched with Android)
    private let walkingSpeedThreshold: Double = 2.0    // m/s (~7.2 km/h) — below this = walking
    private let walkingMaxSpeed: Double = 6.0          // m/s (~21.6 km/h) — generous for walking
    private let backgroundMaxDistance: Double = 100.0  // meters — cap for stale background GPS (raised from 50m to reduce valid-point rejection after brief signal gaps)
    private let backgroundMinInterval: TimeInterval = 5.0 // seconds

    private var lastTimestamp: TimeInterval = 0
    private var previousPoints: [(location: CLLocation, speed: Double)] = []

    /// Validate and filter a raw CLLocation
    /// Returns nil if the location should be discarded
    func validate(_ location: CLLocation) -> CLLocation? {
        // Layer 1: Basic validity checks
        guard location.horizontalAccuracy >= 0 else { return nil }
        // Don't discard low-accuracy GPS — let Kalman filter handle it with
        // higher measurement noise. Discarding means zero data in urban canyons.
        // Only reject truly unusable readings (>100m = likely cell tower).
        guard location.horizontalAccuracy <= 100.0 else { return nil }

        // Timestamp validation
        let currentTime = Date().timeIntervalSince1970
        let locationTime = location.timestamp.timeIntervalSince1970
        guard abs(currentTime - locationTime) <= maxTimestampAge else { return nil }

        // Duplicate timestamp check
        let timestampMs = locationTime * 1000
        guard timestampMs > lastTimestamp + (minTimeBetweenUpdates * 1000) else { return nil }

        // Layer 2: Speed-based outlier detection
        if let lastValid = lastValidLocation {
            let distance = location.distance(from: lastValid)
            let timeDelta = location.timestamp.timeIntervalSince(lastValid.timestamp)

            // Reject backwards or zero time deltas (clock adjustments, duplicate timestamps)
            guard timeDelta > 0 else { return nil }

            let calculatedSpeed = distance / timeDelta

            // Adaptive speed threshold (matched with Android):
            // Walking pace → lower threshold catches GPS jumps that look normal at running pace
            let adaptiveMax = getAdaptiveSpeedThreshold()
            if calculatedSpeed > adaptiveMax {
                return nil
            }

            // Background GPS guard (matched with Android):
            // When update interval is large (>5s), GPS may report stale/cell-tower positions.
            // Two tiers: short gaps (5-10s) allow 100m, longer gaps (>10s) tighten to 150m
            // to prevent cell-tower position jumps after prolonged background suspension.
            if timeDelta > backgroundMinInterval && distance > backgroundMaxDistance {
                return nil
            }
            if timeDelta > 10.0 && distance > 150.0 {
                return nil
            }

            // Acceleration check using recent points
            if !previousPoints.isEmpty {
                let prevSpeed = previousPoints.last?.speed ?? 0
                let acceleration = abs(calculatedSpeed - prevSpeed) / timeDelta
                if acceleration > maxAcceleration {
                    return nil
                }
            }

            // Update recent speeds for statistical outlier detection
            recentSpeeds.append(calculatedSpeed)
            if recentSpeeds.count > maxRecentSpeeds {
                recentSpeeds.removeFirst()
            }

            previousPoints.append((location: location, speed: calculatedSpeed))
            if previousPoints.count > 3 { previousPoints.removeFirst() }
        }

        lastValidLocation = location
        lastTimestamp = timestampMs
        return location
    }

    /// Adaptive max speed based on recent average (matched with Android)
    private func getAdaptiveSpeedThreshold() -> Double {
        guard !recentSpeeds.isEmpty else { return maxSpeed }
        let avgSpeed = recentSpeeds.reduce(0, +) / Double(recentSpeeds.count)
        return avgSpeed < walkingSpeedThreshold ? walkingMaxSpeed : maxSpeed
    }

    func reset() {
        lastValidLocation = nil
        recentSpeeds.removeAll()
        previousPoints.removeAll()
        lastTimestamp = 0
    }
}
