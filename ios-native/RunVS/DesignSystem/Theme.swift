import SwiftUI

// MARK: - Color Hex Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6: // RGB
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

// MARK: - Design Tokens (DARK_THEME from RN constants.ts)

enum RVColors {
    static let background = Color(hex: "050505")
    static let surface = Color(hex: "121212")
    static let surfaceLight = Color(hex: "1E1E1E")
    static let card = Color(hex: "121212")

    static let text = Color(hex: "F5F5F5")
    static let textSecondary = Color(hex: "8A8A8A")
    static let textTertiary = Color(hex: "808080")

    static let border = Color(hex: "2A2A2A")
    static let divider = Color(hex: "1E1E1E")

    static let primary = Color(hex: "FF7A33")
    static let primaryDark = Color(hex: "E86820")
    static let primaryLight = Color(hex: "FFB088")

    static let success = Color(hex: "34D399")
    static let error = Color(hex: "F87171")
    static let warning = Color(hex: "FFB84D")
    static let gold = Color(hex: "FFD700")

    static let white = Color.white
    static let black = Color.black
}

enum RVFontSize {
    static let xs: CGFloat = 11
    static let sm: CGFloat = 13
    static let md: CGFloat = 15
    static let lg: CGFloat = 17
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let title: CGFloat = 28
    static let display: CGFloat = 34
    static let hero: CGFloat = 56
}

enum RVSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 24
    static let xxxl: CGFloat = 32
    static let huge: CGFloat = 40
}

enum RVRadius {
    static let xs: CGFloat = 6
    static let sm: CGFloat = 10
    static let md: CGFloat = 14
    static let lg: CGFloat = 18
    static let xl: CGFloat = 24
    static let full: CGFloat = 999
}
