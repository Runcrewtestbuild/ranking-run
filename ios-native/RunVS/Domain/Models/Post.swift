import Foundation

struct Post: Codable, Identifiable, Sendable {
    let id: String
    let userId: String
    var nickname: String
    var avatarUrl: String?
    var content: String
    var imageUrls: [String]
    var likeCount: Int
    var commentCount: Int
    var isLiked: Bool
    var createdAt: Date?

    init(
        id: String = UUID().uuidString,
        userId: String = "",
        nickname: String = "",
        avatarUrl: String? = nil,
        content: String = "",
        imageUrls: [String] = [],
        likeCount: Int = 0,
        commentCount: Int = 0,
        isLiked: Bool = false,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.userId = userId
        self.nickname = nickname
        self.avatarUrl = avatarUrl
        self.content = content
        self.imageUrls = imageUrls
        self.likeCount = likeCount
        self.commentCount = commentCount
        self.isLiked = isLiked
        self.createdAt = createdAt
    }
}

struct Crew: Codable, Identifiable, Sendable {
    let id: String
    var name: String
    var description: String?
    var logoUrl: String?
    var coverImageUrl: String?
    var badgeColor: String?
    var badgeIcon: String?
    var memberCount: Int
    var maxMembers: Int?
    var level: Int
    var region: String?
    var requiresApproval: Bool
    var isMember: Bool

    init(
        id: String = UUID().uuidString,
        name: String = "",
        description: String? = nil,
        logoUrl: String? = nil,
        coverImageUrl: String? = nil,
        badgeColor: String? = nil,
        badgeIcon: String? = nil,
        memberCount: Int = 0,
        maxMembers: Int? = nil,
        level: Int = 1,
        region: String? = nil,
        requiresApproval: Bool = false,
        isMember: Bool = false
    ) {
        self.id = id
        self.name = name
        self.description = description
        self.logoUrl = logoUrl
        self.coverImageUrl = coverImageUrl
        self.badgeColor = badgeColor
        self.badgeIcon = badgeIcon
        self.memberCount = memberCount
        self.maxMembers = maxMembers
        self.level = level
        self.region = region
        self.requiresApproval = requiresApproval
        self.isMember = isMember
    }
}

struct WeeklyRunner: Codable, Identifiable, Sendable {
    let id: String
    var rank: Int
    var nickname: String
    var avatarUrl: String?
    var crewName: String?
    var runCount: Int
    var totalDistanceMeters: Double

    init(
        id: String = UUID().uuidString,
        rank: Int = 0,
        nickname: String = "",
        avatarUrl: String? = nil,
        crewName: String? = nil,
        runCount: Int = 0,
        totalDistanceMeters: Double = 0
    ) {
        self.id = id
        self.rank = rank
        self.nickname = nickname
        self.avatarUrl = avatarUrl
        self.crewName = crewName
        self.runCount = runCount
        self.totalDistanceMeters = totalDistanceMeters
    }
}
