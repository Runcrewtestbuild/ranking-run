import Foundation
import CoreLocation
import UIKit
import AVFoundation

// MARK: - GPS Status (used by LocationEngine and ViewModel)

enum GPSAccuracyLevel: String {
    case excellent  // <= 5m
    case good       // <= 15m
    case acquiring  // > 15m or searching
    case disabled   // permission denied / restricted

    init(accuracy: Double) {
        if accuracy <= 5 {
            self = .excellent
        } else if accuracy <= 15 {
            self = .good
        } else {
            self = .acquiring
        }
    }
}

// MARK: - Filtered Location Point

struct FilteredLocationPoint: Codable, Sendable {
    let latitude: Double
    let longitude: Double
    let altitude: Double
    let speed: Double
    let bearing: Double
    let timestamp: TimeInterval  // ms since epoch
    let distanceFromPrevious: Double
    let cumulativeDistance: Double
    let isInterpolated: Bool
}

// MARK: - Location Engine

/// Core Location wrapper that provides filtered GPS data for running tracking.
/// Reuses the same processing pipeline as the React Native LocationEngine
/// (outlier detection, Kalman filtering, stationary detection, sensor fusion).
///
/// This is an @Observable class so SwiftUI views and ViewModels can observe
/// its published properties directly without callback wiring.
@Observable
final class LocationEngine: NSObject, CLLocationManagerDelegate {
    // MARK: - Observable Properties

    private(set) var cumulativeDistance: Double = 0
    private(set) var gpsStatus: String = "searching"
    private(set) var gpsAccuracy: Double = -1
    private(set) var gpsAccuracyLevel: GPSAccuracyLevel = .acquiring
    private(set) var isMoving: Bool = false
    private(set) var currentCadence: Int = 0
    private(set) var elevationGain: Double = 0
    private(set) var elevationLoss: Double = 0
    private(set) var currentSpeed: Double = 0
    private(set) var currentBearing: Double = 0
    private(set) var currentLocation: CLLocationCoordinate2D?
    private(set) var currentAltitude: Double = 0

    /// All filtered route points for map display and chunk upload
    private(set) var filteredLocations: [FilteredLocationPoint] = []

    /// Heading for compass UI (true north)
    private(set) var heading: Double = -1

    // MARK: - Private State

    private let locationManager = CLLocationManager()
    private var previousCumulativeDistance: Double = 0
    private var previousMilestoneTime: Int = 0
    private var lastFilteredLocation: FilteredLocationPoint?
    private var baseAltitude: Double?
    private var isTracking = false
    private var isPaused = false
    private var trackingStartDate: Date?
    private var pauseAccumulated: TimeInterval = 0
    private var lastPauseDate: Date?

    // Background execution
    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid
    private var silentAudioPlayer: AVAudioPlayer?
    private var backgroundTaskRenewalCount: Int = 0
    private let maxBackgroundTaskRenewals: Int = 50

    // Callbacks for Watch integration (not @Observable; set by coordinator)
    var onLocationUpdate: (([String: Any]) -> Void)?
    var onMilestoneReached: ((Int, Int, Int) -> Void)?

    // MARK: - Init

    override init() {
        super.init()
        setupLocationManager()
    }

    private func setupLocationManager() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = kCLDistanceFilterNone
        locationManager.activityType = .fitness
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
        locationManager.showsBackgroundLocationIndicator = true
        locationManager.headingFilter = 1
    }

    // MARK: - Public API

    func requestPermission() {
        let status = locationManager.authorizationStatus
        switch status {
        case .notDetermined:
            locationManager.requestAlwaysAuthorization()
        case .authorizedWhenInUse:
            locationManager.requestAlwaysAuthorization()
        case .denied, .restricted:
            NSLog("[LocationEngine] Location denied - user should enable in Settings")
        case .authorizedAlways:
            NSLog("[LocationEngine] Already authorized (Always)")
        @unknown default:
            break
        }
    }

    var authorizationStatus: CLAuthorizationStatus {
        locationManager.authorizationStatus
    }

    func startTracking() {
        let authStatus = locationManager.authorizationStatus
        switch authStatus {
        case .notDetermined:
            locationManager.requestAlwaysAuthorization()
            return
        case .denied:
            updateGPSStatus("disabled")
            return
        case .restricted:
            updateGPSStatus("disabled")
            return
        default:
            break
        }

        isTracking = true
        isPaused = false
        cumulativeDistance = 0
        previousCumulativeDistance = 0
        previousMilestoneTime = 0
        lastFilteredLocation = nil
        baseAltitude = nil
        filteredLocations = []
        elevationGain = 0
        elevationLoss = 0
        currentCadence = 0
        currentSpeed = 0
        trackingStartDate = Date()
        pauseAccumulated = 0
        lastPauseDate = nil

        backgroundTaskRenewalCount = 0
        startBackgroundExecution()

        DispatchQueue.main.async { [weak self] in
            self?.locationManager.startUpdatingLocation()
            self?.locationManager.startUpdatingHeading()
        }

        updateGPSStatus("searching")
    }

    func stopTracking() {
        isTracking = false
        isPaused = false
        stopBackgroundExecution()

        DispatchQueue.main.async { [weak self] in
            self?.locationManager.stopUpdatingLocation()
            self?.locationManager.stopUpdatingHeading()
        }
    }

    func pauseTracking() {
        isPaused = true
        lastPauseDate = Date()
    }

    func resumeTracking() {
        if let pauseStart = lastPauseDate {
            pauseAccumulated += Date().timeIntervalSince(pauseStart)
        }
        isPaused = false
        lastPauseDate = nil
    }

    /// Elapsed running time in seconds (excludes paused time)
    func getElapsedSeconds() -> Int {
        guard let start = trackingStartDate else { return 0 }
        var elapsed = Date().timeIntervalSince(start) - pauseAccumulated
        if isPaused, let pauseStart = lastPauseDate {
            elapsed -= Date().timeIntervalSince(pauseStart)
        }
        return max(0, Int(elapsed))
    }

    /// Route coordinates for map display: [[lng, lat, alt]]
    func getRouteCoordinates() -> [[Double]] {
        filteredLocations.map { [$0.longitude, $0.latitude, $0.altitude] }
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        for location in locations {
            processLocation(location)
        }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        if let clError = error as? CLError {
            switch clError.code {
            case .denied:
                updateGPSStatus("disabled")
            case .locationUnknown:
                updateGPSStatus("searching")
            default:
                updateGPSStatus("lost")
            }
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        if newHeading.trueHeading >= 0 {
            heading = newHeading.trueHeading
        } else if newHeading.magneticHeading >= 0 {
            heading = newHeading.magneticHeading
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            if isTracking {
                DispatchQueue.main.async { [weak self] in
                    self?.locationManager.startUpdatingLocation()
                }
            }
        case .denied, .restricted:
            updateGPSStatus("disabled")
        default:
            break
        }
    }

    // MARK: - Location Processing

    private func processLocation(_ location: CLLocation) {
        guard isTracking, !isPaused else { return }

        // Basic validation: reject stale and low-quality locations
        let age = -location.timestamp.timeIntervalSinceNow
        guard age < 10.0 else { return }  // Reject locations older than 10s
        guard location.horizontalAccuracy >= 0 && location.horizontalAccuracy <= 50 else { return }

        let coord = location.coordinate
        let timestamp = location.timestamp.timeIntervalSince1970 * 1000

        // Update GPS status based on accuracy
        if location.horizontalAccuracy <= 20.0 {
            updateGPSStatus("locked", accuracy: location.horizontalAccuracy)
        } else {
            updateGPSStatus("searching", accuracy: location.horizontalAccuracy)
        }

        // Speed validation
        let speed = location.speed >= 0 ? location.speed : 0

        // Speed limit: reject if > 15 m/s (54 km/h, impossible running speed)
        if speed > 15.0 { return }

        // Altitude tracking
        if baseAltitude == nil { baseAltitude = location.altitude }

        // Calculate distance from previous point
        var distanceFromPrevious: Double = 0
        if let lastLoc = lastFilteredLocation {
            let rawDist = Self.haversineDistance(
                lat1: lastLoc.latitude, lon1: lastLoc.longitude,
                lat2: coord.latitude, lon2: coord.longitude
            )

            // Spike detection: reject impossible jumps
            let timeDelta = (timestamp - lastLoc.timestamp) / 1000.0
            let maxPlausibleDist = max(15.0 * max(timeDelta, 0.5), 10.0)
            if rawDist > maxPlausibleDist { return }

            // Stationary detection: ignore tiny movements as GPS drift
            if speed < 0.3 && rawDist < 2.0 {
                isMoving = false
                distanceFromPrevious = 0
            } else {
                isMoving = true
                distanceFromPrevious = rawDist >= 0.3 ? rawDist : 0
            }

            cumulativeDistance += distanceFromPrevious
        }

        // Elevation tracking
        if let base = baseAltitude {
            let altDelta = location.altitude - (lastFilteredLocation.map { $0.altitude } ?? base)
            if altDelta > 0.5 {
                elevationGain += altDelta
            } else if altDelta < -0.5 {
                elevationLoss += abs(altDelta)
            }
        }

        currentSpeed = speed
        currentBearing = location.course >= 0 ? location.course : (heading >= 0 ? heading : 0)
        currentLocation = coord
        currentAltitude = location.altitude

        let filteredPoint = FilteredLocationPoint(
            latitude: coord.latitude,
            longitude: coord.longitude,
            altitude: location.altitude,
            speed: speed,
            bearing: currentBearing,
            timestamp: timestamp,
            distanceFromPrevious: distanceFromPrevious,
            cumulativeDistance: cumulativeDistance,
            isInterpolated: false
        )

        filteredLocations.append(filteredPoint)
        lastFilteredLocation = filteredPoint

        // Emit callback for Watch integration
        let event: [String: Any] = [
            "latitude": filteredPoint.latitude,
            "longitude": filteredPoint.longitude,
            "altitude": filteredPoint.altitude,
            "speed": filteredPoint.speed,
            "bearing": filteredPoint.bearing,
            "accuracy": location.horizontalAccuracy,
            "timestamp": filteredPoint.timestamp,
            "distanceFromStart": filteredPoint.cumulativeDistance,
            "isMoving": isMoving,
            "cadence": currentCadence,
            "elevationGain": elevationGain,
            "elevationLoss": elevationLoss,
            "distanceSource": "gps"
        ]
        onLocationUpdate?(event)

        // Milestone detection (every 1km)
        let prevKm = Int(previousCumulativeDistance / 1000)
        let currentKm = Int(cumulativeDistance / 1000)
        if currentKm > prevKm && currentKm > 0 {
            let elapsedSeconds = getElapsedSeconds()
            let splitSeconds = elapsedSeconds - previousMilestoneTime
            previousMilestoneTime = elapsedSeconds
            onMilestoneReached?(currentKm, splitSeconds, elapsedSeconds)
        }
        previousCumulativeDistance = cumulativeDistance
    }

    // MARK: - GPS Status

    private func updateGPSStatus(_ status: String, accuracy: Double? = nil) {
        gpsStatus = status
        if let accuracy {
            gpsAccuracy = accuracy
            gpsAccuracyLevel = GPSAccuracyLevel(accuracy: accuracy)
        } else if status == "disabled" {
            gpsAccuracyLevel = .disabled
        } else {
            gpsAccuracyLevel = .acquiring
        }
    }

    // MARK: - Haversine Distance

    static func haversineDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double) -> Double {
        let R = 6371000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLon = (lon2 - lon1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2) +
                cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) *
                sin(dLon / 2) * sin(dLon / 2)
        let c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return R * c
    }

    // MARK: - Background Execution

    private func startBackgroundExecution() {
        beginNewBackgroundTask()
        startSilentAudioSession()

        NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let info = notification.userInfo,
                  let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
            if type == .ended {
                self?.startSilentAudioSession()
            }
        }
    }

    private func beginNewBackgroundTask() {
        backgroundTaskRenewalCount += 1
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.backgroundTaskId != .invalid {
                UIApplication.shared.endBackgroundTask(self.backgroundTaskId)
            }
            self.backgroundTaskId = UIApplication.shared.beginBackgroundTask(withName: "GPSTracking") { [weak self] in
                if let taskId = self?.backgroundTaskId {
                    UIApplication.shared.endBackgroundTask(taskId)
                }
                self?.backgroundTaskId = .invalid
                if let self, self.isTracking, self.backgroundTaskRenewalCount < self.maxBackgroundTaskRenewals {
                    self.beginNewBackgroundTask()
                }
            }
        }
    }

    private func stopBackgroundExecution() {
        NotificationCenter.default.removeObserver(self, name: AVAudioSession.interruptionNotification, object: nil)
        stopSilentAudioSession()
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            if self.backgroundTaskId != .invalid {
                UIApplication.shared.endBackgroundTask(self.backgroundTaskId)
                self.backgroundTaskId = .invalid
            }
        }
    }

    // Silent audio for background keep-alive (same approach as Nike Run Club)
    private static let silentWavData: Data = {
        let sampleRate = 8000
        let numSamples = sampleRate
        let bytesPerSample = 2
        let dataSize = numSamples * bytesPerSample

        var wav = Data(capacity: 44 + dataSize)
        wav.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
        wav.append(contentsOf: withUnsafeBytes(of: UInt32(36 + dataSize).littleEndian) { Array($0) })
        wav.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"
        wav.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
        wav.append(contentsOf: withUnsafeBytes(of: UInt32(16).littleEndian) { Array($0) })
        wav.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Array($0) }) // PCM
        wav.append(contentsOf: withUnsafeBytes(of: UInt16(1).littleEndian) { Array($0) }) // mono
        wav.append(contentsOf: withUnsafeBytes(of: UInt32(8000).littleEndian) { Array($0) })
        wav.append(contentsOf: withUnsafeBytes(of: UInt32(16000).littleEndian) { Array($0) })
        wav.append(contentsOf: withUnsafeBytes(of: UInt16(2).littleEndian) { Array($0) })
        wav.append(contentsOf: withUnsafeBytes(of: UInt16(16).littleEndian) { Array($0) })
        wav.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        wav.append(contentsOf: withUnsafeBytes(of: UInt32(dataSize).littleEndian) { Array($0) })
        wav.append(Data(count: dataSize))
        return wav
    }()

    private func startSilentAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try audioSession.setActive(true)

            silentAudioPlayer = try AVAudioPlayer(data: Self.silentWavData)
            silentAudioPlayer?.numberOfLoops = -1
            silentAudioPlayer?.volume = 0.0
            silentAudioPlayer?.play()
        } catch {
            NSLog("[LocationEngine] Failed to start silent audio: \(error)")
        }
    }

    private func stopSilentAudioSession() {
        silentAudioPlayer?.stop()
        silentAudioPlayer = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
