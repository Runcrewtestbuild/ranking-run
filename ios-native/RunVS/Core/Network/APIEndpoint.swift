import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case patch = "PATCH"
    case delete = "DELETE"
}

enum APIEndpoint {
    // Auth
    case login(provider: String, token: String, nonce: String?, force: Bool)
    case refreshToken(refreshToken: String)
    case logout

    // Users
    case getProfile
    case updateProfile(body: [String: Any])
    case deleteAccount
    case getUser(id: String)
    case getStats(period: String)
    case getSocialCounts

    // Runs
    case getRecentRuns(limit: Int)
    case getWeeklySummary
    case getRun(id: String)
    case createRun(body: [String: Any])

    // Courses
    case getCourses(page: Int, perPage: Int)
    case getPopularCourses
    case getNewCourses
    case getNearbyCourses(lat: Double, lng: Double)
    case getCourse(id: String)

    // Push Notifications
    case registerPushToken(token: String, platform: String)

    // Chunks (GPS data upload during run)
    case uploadChunk(sessionId: String, body: [String: Any])

    // Community
    case getWeeklyRanking(page: Int)
    case listCrews(page: Int, perPage: Int)
    case getMyCrews

    var method: HTTPMethod {
        switch self {
        case .login, .refreshToken, .logout, .createRun, .registerPushToken, .uploadChunk:
            return .post
        case .updateProfile:
            return .patch
        case .deleteAccount:
            return .delete
        default:
            return .get
        }
    }

    var path: String {
        switch self {
        case .login:
            return "/auth/login"
        case .refreshToken:
            return "/auth/refresh"
        case .logout:
            return "/auth/logout"
        case .getProfile:
            return "/users/me"
        case .updateProfile:
            return "/users/me/profile"
        case .deleteAccount:
            return "/users/me/account"
        case .getRecentRuns:
            return "/runs/recent"
        case .getWeeklySummary:
            return "/runs/weekly-summary"
        case .getRun(let id):
            return "/runs/\(id)"
        case .createRun:
            return "/runs"
        case .getCourses:
            return "/courses"
        case .getPopularCourses:
            return "/courses/popular"
        case .getNewCourses:
            return "/courses/new"
        case .getNearbyCourses:
            return "/courses/nearby"
        case .getCourse(let id):
            return "/courses/\(id)"
        case .registerPushToken:
            return "/users/me/push-token"
        case .uploadChunk(let sessionId, _):
            return "/runs/\(sessionId)/chunks"
        case .getUser(let id):
            return "/users/\(id)"
        case .getStats:
            return "/users/me/stats"
        case .getSocialCounts:
            return "/users/me/social-counts"
        case .getWeeklyRanking:
            return "/ranking/weekly"
        case .listCrews:
            return "/crews"
        case .getMyCrews:
            return "/crews/mine"
        }
    }

    var queryItems: [URLQueryItem]? {
        switch self {
        case .getRecentRuns(let limit):
            return [URLQueryItem(name: "limit", value: "\(limit)")]
        case .getCourses(let page, let perPage):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "\(perPage)"),
            ]
        case .getNearbyCourses(let lat, let lng):
            return [
                URLQueryItem(name: "lat", value: "\(lat)"),
                URLQueryItem(name: "lng", value: "\(lng)"),
            ]
        case .getStats(let period):
            return [URLQueryItem(name: "period", value: period)]
        case .getWeeklyRanking(let page):
            return [URLQueryItem(name: "page", value: "\(page)")]
        case .listCrews(let page, let perPage):
            return [
                URLQueryItem(name: "page", value: "\(page)"),
                URLQueryItem(name: "per_page", value: "\(perPage)"),
            ]
        default:
            return nil
        }
    }

    var body: [String: Any]? {
        switch self {
        case .login(let provider, let token, let nonce, let force):
            var dict: [String: Any] = ["provider": provider, "token": token]
            if let nonce { dict["nonce"] = nonce }
            if force { dict["force"] = true }
            return dict
        case .refreshToken(let refreshToken):
            return ["refresh_token": refreshToken]
        case .updateProfile(let body):
            return body
        case .createRun(let body):
            return body
        case .registerPushToken(let token, let platform):
            return ["token": token, "platform": platform]
        case .uploadChunk(_, let body):
            return body
        default:
            return nil
        }
    }

    /// Whether this endpoint should skip the Authorization header
    var skipAuth: Bool {
        switch self {
        case .login, .refreshToken:
            return true
        default:
            return false
        }
    }
}
