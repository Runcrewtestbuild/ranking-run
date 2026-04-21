import Foundation

enum RunFormatters {
    /// Format distance in meters to km string: 5230 → "5.23"
    static func formatDistance(meters: Double) -> String {
        let km = meters / 1000.0
        if km < 10 {
            return String(format: "%.2f", km)
        } else if km < 100 {
            return String(format: "%.1f", km)
        } else {
            return String(format: "%.0f", km)
        }
    }

    /// Format distance with unit: 5230 → "5.23 km"
    static func formatDistanceWithUnit(meters: Double) -> String {
        "\(formatDistance(meters: meters)) km"
    }

    /// Format duration in seconds: 1530 → "25:30"
    static func formatDuration(seconds: Int) -> String {
        let hours = seconds / 3600
        let minutes = (seconds % 3600) / 60
        let secs = seconds % 60

        if hours > 0 {
            return String(format: "%d:%02d:%02d", hours, minutes, secs)
        }
        return String(format: "%d:%02d", minutes, secs)
    }

    /// Format pace in seconds/km: 306 → "5'06\""
    static func formatPace(secondsPerKm: Double?) -> String {
        guard let pace = secondsPerKm, pace > 0, pace < 3600 else {
            return "--'--\""
        }
        let totalSeconds = Int(pace)
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return "\(minutes)'\(String(format: "%02d", seconds))\""
    }

    /// Format number with thousands separator: 12345 → "12,345"
    static func formatNumber(_ value: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        return formatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    /// Meters to km with decimal places
    static func metersToKm(_ meters: Double, decimals: Int = 1) -> String {
        String(format: "%.\(decimals)f", meters / 1000.0)
    }
}
