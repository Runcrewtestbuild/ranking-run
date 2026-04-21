import Foundation

struct User: Codable, Identifiable, Sendable {
    let id: String
    var userCode: String?
    var email: String?
    var nickname: String
    var avatarUrl: String?
    var birthday: String?
    var gender: String?
    var heightCm: Int?
    var weightKg: Int?
    var bio: String?
    var instagramUsername: String?
    var country: String?
    var totalDistanceMeters: Double
    var totalRuns: Int
    var totalPoints: Int
    var runnerLevel: Int?
    var createdAt: String?

    // Convenience computed properties
    var level: Int { runnerLevel ?? 1 }
    var totalRunCount: Int { totalRuns }

    /// Convenience initializer for mock/preview data
    static func mock(
        id: String = "mock",
        nickname: String = "Runner",
        bio: String? = nil,
        level: Int = 1,
        totalDistanceMeters: Double = 0,
        totalRunCount: Int = 0
    ) -> User {
        User(
            id: id,
            userCode: nil,
            email: nil,
            nickname: nickname,
            avatarUrl: nil,
            birthday: nil,
            gender: nil,
            heightCm: nil,
            weightKg: nil,
            bio: bio,
            instagramUsername: nil,
            country: nil,
            totalDistanceMeters: totalDistanceMeters,
            totalRuns: totalRunCount,
            totalPoints: 0,
            runnerLevel: level,
            createdAt: nil
        )
    }
}
