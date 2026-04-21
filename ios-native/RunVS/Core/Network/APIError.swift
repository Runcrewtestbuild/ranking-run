import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case forbidden
    case notFound
    case conflict(code: String?, message: String?)
    case serverError(statusCode: Int)
    case decodingFailed(Error)
    case networkError(Error)
    case tokenExpired
    case noData
    case banned(reason: String)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Authentication required"
        case .forbidden:
            return "Access denied"
        case .notFound:
            return "Resource not found"
        case .conflict(_, let message):
            return message ?? "Conflict"
        case .serverError(let code):
            return "Server error (\(code))"
        case .decodingFailed(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .tokenExpired:
            return "Session expired"
        case .noData:
            return "No data received"
        case .banned(let reason):
            return reason.isEmpty ? "Account suspended" : reason
        case .unknown:
            return "An unknown error occurred"
        }
    }
}
