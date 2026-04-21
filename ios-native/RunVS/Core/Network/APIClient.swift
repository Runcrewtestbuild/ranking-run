import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = "https://runvs.run/api/v1"
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    /// Prevents concurrent token refresh attempts
    private var refreshTask: Task<String, Error>?

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601

        encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
    }

    // MARK: - Public API

    func request<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let urlRequest = try await buildRequest(for: endpoint)
        let (data, response) = try await performRequest(urlRequest, endpoint: endpoint)
        try validateResponse(response, data: data)
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingFailed(error)
        }
    }

    func requestVoid(_ endpoint: APIEndpoint) async throws {
        let urlRequest = try await buildRequest(for: endpoint)
        let (data, response) = try await performRequest(urlRequest, endpoint: endpoint)
        try validateResponse(response, data: data)
    }

    // MARK: - Request Building

    private func buildRequest(for endpoint: APIEndpoint) async throws -> URLRequest {
        guard var components = URLComponents(string: baseURL + endpoint.path) else {
            throw APIError.invalidURL
        }

        if let queryItems = endpoint.queryItems {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        // Inject JWT token (skip for auth endpoints that don't need it)
        if !endpoint.skipAuth {
            let token = await AuthManager.shared.accessToken
            if let token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
        }

        if let body = endpoint.body {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        return request
    }

    // MARK: - Request Execution with 401 Retry

    private func performRequest(
        _ request: URLRequest,
        endpoint: APIEndpoint,
        isRetry: Bool = false
    ) async throws -> (Data, URLResponse) {
        do {
            let (data, response) = try await session.data(for: request)

            // Handle 401: attempt token refresh and retry once
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 401,
               !isRetry,
               !endpoint.skipAuth {

                let newToken = try await performTokenRefresh()

                var retryRequest = request
                retryRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                return try await performRequest(retryRequest, endpoint: endpoint, isRetry: true)
            }

            return (data, response)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    // MARK: - Token Refresh (deduplicated)

    private func performTokenRefresh() async throws -> String {
        // If a refresh is already in flight, await the same task
        if let existing = refreshTask {
            return try await existing.value
        }

        let task = Task<String, Error> { [weak self] in
            guard let self else { throw APIError.tokenExpired }

            guard let refreshToken = await AuthManager.shared.refreshTokenValue else {
                throw APIError.tokenExpired
            }

            // Direct fetch to avoid recursion through performRequest
            guard let url = URL(string: baseURL + "/auth/refresh") else {
                throw APIError.invalidURL
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let body = ["refresh_token": refreshToken]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }

            if httpResponse.statusCode == 401 {
                // Refresh token is definitively invalid
                await MainActor.run { AuthManager.shared.signOut() }
                throw APIError.tokenExpired
            }

            guard httpResponse.statusCode == 200 else {
                throw APIError.serverError(statusCode: httpResponse.statusCode)
            }

            let refreshResponse = try decoder.decode(RefreshResponse.self, from: data)
            await MainActor.run {
                AuthManager.shared.setTokens(
                    access: refreshResponse.accessToken,
                    refresh: refreshResponse.refreshToken
                )
            }
            return refreshResponse.accessToken
        }

        refreshTask = task

        do {
            let token = try await task.value
            refreshTask = nil
            return token
        } catch {
            refreshTask = nil
            throw error
        }
    }

    // MARK: - Response Validation

    private func validateResponse(_ response: URLResponse, data: Data? = nil) throws {
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            // Check if it's a ban
            if let data,
               let errorResponse = try? decoder.decode(ErrorResponse.self, from: data),
               errorResponse.code == "USER_BANNED" {
                throw APIError.banned(reason: errorResponse.message ?? "")
            }
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 409:
            var code: String?
            var message: String?
            if let data,
               let errorResponse = try? decoder.decode(ErrorResponse.self, from: data) {
                code = errorResponse.code
                message = errorResponse.message
            }
            throw APIError.conflict(code: code, message: message)
        default:
            throw APIError.serverError(statusCode: httpResponse.statusCode)
        }
    }
}
