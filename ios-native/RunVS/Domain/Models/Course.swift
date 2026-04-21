import Foundation

struct Course: Codable, Identifiable, Sendable {
    let id: String
    let creatorId: String
    var title: String
    var description: String?
    var distanceMeters: Double
    var elevationGainMeters: Double
    var difficulty: String?
    var thumbnailUrl: String?
    var routePreview: [[Double]]?
    var totalRuns: Int
    var creatorNickname: String
    var region: String?
    var createdAt: Date?

    init(
        id: String = UUID().uuidString,
        creatorId: String = "",
        title: String = "",
        description: String? = nil,
        distanceMeters: Double = 0,
        elevationGainMeters: Double = 0,
        difficulty: String? = nil,
        thumbnailUrl: String? = nil,
        routePreview: [[Double]]? = nil,
        totalRuns: Int = 0,
        creatorNickname: String = "",
        region: String? = nil,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.creatorId = creatorId
        self.title = title
        self.description = description
        self.distanceMeters = distanceMeters
        self.elevationGainMeters = elevationGainMeters
        self.difficulty = difficulty
        self.thumbnailUrl = thumbnailUrl
        self.routePreview = routePreview
        self.totalRuns = totalRuns
        self.creatorNickname = creatorNickname
        self.region = region
        self.createdAt = createdAt
    }
}
