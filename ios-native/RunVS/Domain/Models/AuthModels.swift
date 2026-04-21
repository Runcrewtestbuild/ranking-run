import Foundation

// MARK: - Auth Request / Response DTOs

struct LoginRequest: Encodable {
    let provider: String
    let token: String
    let nonce: String?
    let force: Bool?
}

struct AuthResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int
    let user: AuthUser
}

struct AuthUser: Decodable {
    let id: String
    let userCode: String?
    let email: String
    let nickname: String?
    let provider: String?
    let isNewUser: Bool
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct RefreshResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

struct ErrorResponse: Decodable {
    let code: String?
    let message: String?
}
