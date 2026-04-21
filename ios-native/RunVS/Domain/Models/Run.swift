import Foundation

struct Run: Codable, Identifiable, Sendable {
    let id: String
    let userId: String
    var courseId: String?
    var startedAt: Date
    var endedAt: Date?
    var distanceMeters: Double
    var durationSeconds: Int
    var avgPaceSecondsPerKm: Double?
    var bestPaceSecondsPerKm: Double?
    var elevationGainMeters: Double
    var estimatedCalories: Int
    var splits: [Split]
    var routeGeometry: RouteGeometry?
    var title: String?
    var memo: String?

    init(
        id: String = UUID().uuidString,
        userId: String = "",
        courseId: String? = nil,
        startedAt: Date = .now,
        endedAt: Date? = nil,
        distanceMeters: Double = 0,
        durationSeconds: Int = 0,
        avgPaceSecondsPerKm: Double? = nil,
        bestPaceSecondsPerKm: Double? = nil,
        elevationGainMeters: Double = 0,
        estimatedCalories: Int = 0,
        splits: [Split] = [],
        routeGeometry: RouteGeometry? = nil,
        title: String? = nil,
        memo: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.courseId = courseId
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.distanceMeters = distanceMeters
        self.durationSeconds = durationSeconds
        self.avgPaceSecondsPerKm = avgPaceSecondsPerKm
        self.bestPaceSecondsPerKm = bestPaceSecondsPerKm
        self.elevationGainMeters = elevationGainMeters
        self.estimatedCalories = estimatedCalories
        self.splits = splits
        self.routeGeometry = routeGeometry
        self.title = title
        self.memo = memo
    }
}

struct Split: Codable, Identifiable, Sendable {
    var id: Int { kilometerIndex }
    let kilometerIndex: Int
    let durationSeconds: Int
    let paceSecondsPerKm: Double
    let distanceMeters: Double
    let elevationGainMeters: Double

    init(
        kilometerIndex: Int = 0,
        durationSeconds: Int = 0,
        paceSecondsPerKm: Double = 0,
        distanceMeters: Double = 1000,
        elevationGainMeters: Double = 0
    ) {
        self.kilometerIndex = kilometerIndex
        self.durationSeconds = durationSeconds
        self.paceSecondsPerKm = paceSecondsPerKm
        self.distanceMeters = distanceMeters
        self.elevationGainMeters = elevationGainMeters
    }
}

struct RouteGeometry: Codable, Sendable {
    let coordinates: [[Double]] // [lng, lat, alt?]

    init(coordinates: [[Double]] = []) {
        self.coordinates = coordinates
    }
}

struct WeeklySummary: Codable, Sendable {
    let totalDistanceMeters: Double
    let runCount: Int
    let totalDurationSeconds: Int
    let avgPaceSecondsPerKm: Double?
    let comparedToLastWeekPercent: Double?

    init(
        totalDistanceMeters: Double = 0,
        runCount: Int = 0,
        totalDurationSeconds: Int = 0,
        avgPaceSecondsPerKm: Double? = nil,
        comparedToLastWeekPercent: Double? = nil
    ) {
        self.totalDistanceMeters = totalDistanceMeters
        self.runCount = runCount
        self.totalDurationSeconds = totalDurationSeconds
        self.avgPaceSecondsPerKm = avgPaceSecondsPerKm
        self.comparedToLastWeekPercent = comparedToLastWeekPercent
    }
}

struct RecentRun: Codable, Identifiable, Sendable {
    let id: String
    let startedAt: Date
    var distanceMeters: Double
    var durationSeconds: Int
    var avgPaceSecondsPerKm: Double?
    var courseTitle: String?
    var title: String?

    init(
        id: String = UUID().uuidString,
        startedAt: Date = .now,
        distanceMeters: Double = 0,
        durationSeconds: Int = 0,
        avgPaceSecondsPerKm: Double? = nil,
        courseTitle: String? = nil,
        title: String? = nil
    ) {
        self.id = id
        self.startedAt = startedAt
        self.distanceMeters = distanceMeters
        self.durationSeconds = durationSeconds
        self.avgPaceSecondsPerKm = avgPaceSecondsPerKm
        self.courseTitle = courseTitle
        self.title = title
    }
}
