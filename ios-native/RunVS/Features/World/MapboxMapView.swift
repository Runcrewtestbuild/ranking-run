import SwiftUI
@preconcurrency import MapboxMaps

/// Mapbox GL map wrapped for SwiftUI via UIViewRepresentable.
struct MapboxMapView: UIViewRepresentable {

    private let darkStyleURI = StyleURI(rawValue: "mapbox://styles/runsvs/cmlt12hqy001d01r49zt66z85")!

    func makeUIView(context: Context) -> MapView {
        let cameraOptions = CameraOptions(
            center: CLLocationCoordinate2D(latitude: 37.5665, longitude: 126.978),
            zoom: 14
        )
        let options = MapInitOptions(
            cameraOptions: cameraOptions,
            styleURI: darkStyleURI
        )

        let mapView = MapView(frame: .zero, mapInitOptions: options)

        // User location puck
        mapView.location.options.puckType = .puck2D(Puck2DConfiguration())
        mapView.location.options.puckBearingEnabled = true

        // Hide ornaments (same as RN)
        mapView.ornaments.logoView.isHidden = true
        mapView.ornaments.attributionButton.isHidden = true
        mapView.ornaments.scaleBarView.isHidden = true
        mapView.ornaments.compassView.isHidden = true

        return mapView
    }

    func updateUIView(_ uiView: MapView, context: Context) {}
}
