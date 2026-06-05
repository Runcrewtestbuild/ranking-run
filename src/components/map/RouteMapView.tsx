import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Platform, Animated, Easing, Image, Pressable, TouchableOpacity } from 'react-native';
import Mapbox, { UserTrackingMode } from '@rnmapbox/maps';
import { Ionicons } from '../../lib/icons';
import { COLORS, DIFFICULTY_COLORS, type DifficultyLevel } from '../../utils/constants';
import { useTheme } from '../../hooks/useTheme';
import { MAPBOX_DARK_STYLE, MAPBOX_LIGHT_STYLE } from '../../config/env';
import { useRunningStore } from '../../stores/runningStore';

// ============================================================
// RouteMapView — Mapbox GL implementation
//
// Two modes:
//   A) Route display  – shows a polyline of a running route
//   B) Open-world map – shows interactive course markers,
//      event markers, and friend markers
// ============================================================

// Backward-compatible Region type (replaces react-native-maps Region)
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const SEOUL_CENTER: [number, number] = [126.978, 37.5665]; // [lng, lat]
const DEFAULT_ZOOM = 13;

const EDGE_PADDING = { top: 40, right: 40, bottom: 40, left: 40 };

// ---- Data interfaces ----

export interface CourseMarkerData {
  id: string;
  title: string;
  start_lat: number;
  start_lng: number;
  distance_meters: number;
  total_runs: number;
  difficulty?: DifficultyLevel | null;
  avg_rating?: number | null;
  active_runners?: number;
  is_new?: boolean;
  elevation_gain_meters?: number;
  creator_nickname?: string | null;
  user_rank?: number | null;
  dominion?: {
    crew_id: string;
    crew_name: string;
    crew_badge_color: string | null;
    crew_logo_url: string | null;
  } | null;
}

export interface EventMarkerData {
  id: string;
  title: string;
  event_type: string;
  badge_color: string;
  badge_icon: string;
  center_lat: number;
  center_lng: number;
  participant_count: number;
  ends_at: string;
}

// ---- Checkpoint data ----

export interface CheckpointMarkerData {
  id: number;
  order: number;
  lat: number;
  lng: number;
  passed?: boolean;
  isNext?: boolean;
}

// ---- Component props ----

interface RouteMapViewProps {
  routePoints?: Array<{ latitude: number; longitude: number }>;
  markers?: CourseMarkerData[];
  eventMarkers?: EventMarkerData[];

  checkpoints?: CheckpointMarkerData[];
  previewPolyline?: Array<{ latitude: number; longitude: number }>;
  onMarkerPress?: (courseId: string) => void;
  onEventMarkerPress?: (eventId: string) => void;
  onRegionChange?: (region: Region) => void;
  onMapPress?: (event?: any) => void;
  /** Called when user manually pans/zooms the map (user gesture, not programmatic) */
  onUserMapInteraction?: () => void;
  showUserLocation?: boolean;
  followsUserLocation?: boolean;
  onUserLocationChange?: (coordinate: { latitude: number; longitude: number; heading?: number }) => void;
  style?: object;
  interactive?: boolean;
  pitchEnabled?: boolean;
  lastKnownLocation?: { latitude: number; longitude: number };
  endPointOverride?: { latitude: number; longitude: number };
  customUserLocation?: { latitude: number; longitude: number };
  customUserHeading?: number;
  /** Hide the "출발"/"도착" label markers while still drawing the route polyline */
  hideRouteMarkers?: boolean;
  /** false = use basic flat Mapbox styles (2D), true/undefined = use custom 3D styles */
  use3DStyle?: boolean;
  /** Camera padding when following user — shifts center to account for overlapping UI */
  followPadding?: { paddingTop?: number; paddingBottom?: number; paddingLeft?: number; paddingRight?: number };
  /** Zoom level to use when followsUserLocation is true */
  followZoomLevel?: number;
  /** Camera follow mode: 'normal' (default), 'compass' (heading-locked), 'course' (GPS bearing, nav-style) */
  followUserMode?: 'normal' | 'compass' | 'course';
  /** Camera pitch angle in degrees (e.g. 45 for tilted 3D view) */
  followPitch?: number;
  /** Off-course deviation segments to render in red: [startIdx, endIdx] pairs */
  deviationSegments?: Array<[number, number]>;
  /** Signal gap segments to render as dashed gray: [startIdx, endIdx] pairs */
  signalGapSegments?: Array<[number, number]>;
  /** Split km markers along the route (e.g. 1km, 2km, ...) */
  splitMarkers?: Array<{ km: number; latitude: number; longitude: number; pace?: string }>;
  /** When true, start camera at lastKnownLocation then animate to route bounds after map loads */
  animateToRouteOnLoad?: boolean;
  /** When true, render route line with a blue→yellow→orange gradient instead of solid color */
  useGradient?: boolean;
  /** Number of completed laps (displayed as badge near start point when > 0) */
  lapCount?: number;
  /** When true, subscribe to routePoints from runningStore internally (avoids parent re-renders on GPS ticks) */
  subscribeToRunningRoute?: boolean;
  /** Client-side snapped route points (Mapbox Map Matching). When provided & non-empty, displayed instead of raw GPS route. */
  snappedRouteOverride?: Array<{ latitude: number; longitude: number }>;
}

export interface Camera {
  center?: { latitude: number; longitude: number };
  pitch?: number;
  heading?: number;
  zoom?: number;
}

export interface RouteMapViewHandle {
  animateToRegion: (region: Region, duration?: number) => void;
  animateCamera: (camera: Camera, duration?: number) => void;
  fitToCoordinates: (
    coords: Array<{ latitude: number; longitude: number }>,
    edgePadding?: { top: number; right: number; bottom: number; left: number },
    animated?: boolean,
  ) => void;
  /** Move camera to given location (or just re-engage follow mode) and re-enable follow */
  recenterOnUser: (location?: { latitude: number; longitude: number }) => void;
  /** Smooth zoom-in WITHOUT disabling follow — for countdown transitions.
   *  Unlike animateCamera, this does NOT toggle internalFollow, so custom
   *  follow seamlessly takes over after the animation completes. */
  smoothZoomIn: (camera: Camera, duration?: number) => void;
  /** Capture a snapshot of the current map view. Returns a file URI (e.g. file:///...). */
  takeSnapshot: (writeToDisk?: boolean) => Promise<string>;
}

// ---- Helpers ----

/** Downsample a points array to at most `maxPoints` by evenly skipping.
 *  Always keeps the first and last point for visual continuity. */
const MAX_ROUTE_DISPLAY_POINTS = 1000;
function downsamplePoints<T>(points: T[], maxPoints: number = MAX_ROUTE_DISPLAY_POINTS): T[] {
  if (points.length <= maxPoints) return points;
  const step = (points.length - 1) / (maxPoints - 1);
  const result: T[] = [];
  for (let i = 0; i < maxPoints - 1; i++) {
    result.push(points[Math.round(i * step)]);
  }
  result.push(points[points.length - 1]);
  return result;
}

/** Convert lat/lng points to GeoJSON LineString (downsampled if > 1000 points) */
function toLineGeoJSON(points: Array<{ latitude: number; longitude: number }>): GeoJSON.Feature<GeoJSON.LineString> {
  const sampled = downsamplePoints(points);
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: sampled.map(p => [p.longitude, p.latitude]),
    },
    properties: {},
  };
}

/** Compute bounds from points → [ne, sw] as [[lng,lat],[lng,lat]] */
function computeBounds(points: Array<{ latitude: number; longitude: number }>): {
  ne: [number, number];
  sw: [number, number];
} {
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
  }

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}

/** Compute zoom level from lat/lng delta */
function deltaToZoom(latDelta: number): number {
  return Math.max(1, Math.min(20, Math.log2(360 / Math.max(latDelta, 0.0001))));
}

// ---- Smooth location marker (isolated to avoid re-rendering parent on every animation frame) ----

interface SmoothLocationMarkerProps {
  customUserLocation?: { latitude: number; longitude: number };
  customUserHeading?: number;
  followUserMode?: 'normal' | 'compass' | 'course';
}

const SmoothLocationMarker = React.memo(function SmoothLocationMarker({
  customUserLocation,
  customUserHeading,
  followUserMode,
}: SmoothLocationMarkerProps) {
  const headingAnimRef = useRef(new Animated.Value(0));
  const prevHeadingRef = useRef(0);
  const markerTargetRef = useRef<{ lng: number; lat: number } | null>(null);
  const markerCurrentRef = useRef<{ lng: number; lat: number } | null>(null);
  const [smoothMarkerPos, setSmoothMarkerPos] = useState<[number, number] | null>(null);
  const markerAnimFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!customUserLocation) return;
    const target = { lng: customUserLocation.longitude, lat: customUserLocation.latitude };
    markerTargetRef.current = target;
    if (!markerCurrentRef.current) {
      markerCurrentRef.current = { ...target };
      setSmoothMarkerPos([target.lng, target.lat]);
      return;
    }
    const startLng = markerCurrentRef.current.lng;
    const startLat = markerCurrentRef.current.lat;
    const startTime = Date.now();
    const duration = Platform.OS === 'android' ? 800 : 900;

    let frameCount = 0;
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const lng = startLng + (target.lng - startLng) * ease;
      const lat = startLat + (target.lat - startLat) * ease;
      markerCurrentRef.current = { lng, lat };
      frameCount++;
      if (frameCount % 2 === 0 || t >= 1) {
        setSmoothMarkerPos([lng, lat]);
      }
      if (t < 1) {
        markerAnimFrameRef.current = requestAnimationFrame(animate);
      }
    };
    cancelAnimationFrame(markerAnimFrameRef.current);
    markerAnimFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(markerAnimFrameRef.current);
  }, [customUserLocation?.latitude, customUserLocation?.longitude]);

  if (!smoothMarkerPos) return null;

  if (customUserHeading != null) {
    const cameraHeading = (followUserMode === 'course' || followUserMode === 'compass')
      ? (customUserHeading ?? 0) : 0;
    const target = (((customUserHeading ?? 0) - cameraHeading) % 360 + 360) % 360;
    let delta = target - prevHeadingRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const newVal = prevHeadingRef.current + delta;
    prevHeadingRef.current = newVal;
    Animated.timing(headingAnimRef.current, {
      toValue: newVal,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  const hasHeading = customUserHeading != null;
  const spin = headingAnimRef.current.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <Mapbox.MarkerView
      coordinate={smoothMarkerPos}
      anchor={{ x: 0.5, y: 0.5 }}
      allowOverlap={true}
      allowOverlapWithPuck={true}
    >
      <Animated.View
        style={[
          styles.userLocationWrapper,
          hasHeading ? { transform: [{ rotate: spin }] } : undefined,
        ]}
      >
        {hasHeading && (
          <View style={styles.headingChevron} />
        )}
        <View style={styles.userLocationInner} />
      </Animated.View>
    </Mapbox.MarkerView>
  );
});

// ---- Component ----

const RouteMapView = forwardRef<RouteMapViewHandle, RouteMapViewProps>(function RouteMapView({
  routePoints: routePointsProp = [],
  markers,
  eventMarkers,

  checkpoints,
  previewPolyline,
  onMarkerPress,
  onEventMarkerPress,
  onRegionChange,
  onMapPress,
  onUserMapInteraction,
  showUserLocation = false,
  followsUserLocation = false,
  onUserLocationChange,
  style,
  interactive,
  pitchEnabled: pitchEnabledProp,
  lastKnownLocation,
  endPointOverride,
  customUserLocation,
  customUserHeading,
  hideRouteMarkers = false,
  use3DStyle = true,
  followPadding,
  followZoomLevel,
  followUserMode: followUserModeProp,
  followPitch: followPitchProp,
  deviationSegments,
  signalGapSegments,
  splitMarkers,
  animateToRouteOnLoad = false,
  useGradient = false,
  lapCount,
  subscribeToRunningRoute = false,
  snappedRouteOverride,
}, ref) {
  // When subscribeToRunningRoute is true, subscribe to version counter (number)
  // instead of the array reference. This avoids shallow-compare on large arrays.
  // Read the actual data from getRoutePoints() which returns the mutable backing array.
  const routeVersion = useRunningStore((s) => subscribeToRunningRoute ? s.routePointsVersion : -1);
  const rawRoutePoints = useMemo(() => {
    if (!subscribeToRunningRoute || routeVersion < 0) return routePointsProp;
    return useRunningStore.getState().routePoints;
  }, [subscribeToRunningRoute, routeVersion, routePointsProp]);

  // Use client-side snapped route for display when available, fall back to raw GPS
  const routePoints = (snappedRouteOverride && snappedRouteOverride.length > 0)
    ? snappedRouteOverride
    : rawRoutePoints;

  const cameraRef = useRef<Mapbox.Camera>(null);
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const colors = useTheme();
  const isDark = colors.statusBar === 'light-content';
  const mapBearingRef = useRef(0);
  const currentZoomRef = useRef(DEFAULT_ZOOM);

  // Suppress custom follow during smoothZoomIn animation so it doesn't
  // interrupt the flyTo with competing setCamera calls.
  const suppressFollowUntilRef = useRef(0);
  // Last camera position — used to skip updates when position changed < ~0.5m
  const lastCameraPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Smooth GPS marker position interpolation is handled by <SmoothLocationMarker />
  // to avoid re-rendering the entire RouteMapView on every animation frame.

  // Debug: track mount/unmount to detect unexpected remounts
  useEffect(() => {
    if (__DEV__) console.log('[RouteMapView] MOUNTED');
    return () => {
      if (__DEV__) console.log('[RouteMapView] UNMOUNTED');
    };
  }, []);

  // ---------- Internal follow state ----------
  // Mapbox Camera silently blocks ALL setCamera/fitBounds calls when
  // followUserLocation=true. We manage follow internally so imperative
  // camera methods can disable it before animating.
  const [internalFollow, setInternalFollow] = useState(followsUserLocation);

  // When customUserLocation is provided, we center the camera on IT instead
  // of using Mapbox's native followUserLocation (which tracks raw GPS and
  // can diverge from the Kalman-filtered orange dot).
  const useCustomFollow = internalFollow && customUserLocation != null;
  // On Android, Mapbox native follow uses FusedLocationProvider's cached position
  // which is often a completely different neighborhood (stale cell-tower fix).
  // Disable native follow entirely on Android — use only custom follow + one-shot.
  // Camera stays put until real GPS arrives, which is better than jumping to wrong place.
  const nativeFollowEnabled = Platform.OS === 'android'
    ? false
    : (internalFollow && !useCustomFollow);

  // Sync external prop → internal state (only re-engage, never override local disable)
  const prevFollowPropRef = useRef(followsUserLocation);
  useEffect(() => {
    const prev = prevFollowPropRef.current;
    prevFollowPropRef.current = followsUserLocation;
    // Only sync when prop transitions: false→true (re-engage) or true→false (parent disable)
    if (followsUserLocation !== prev) {
      setInternalFollow(followsUserLocation);
    }
  }, [followsUserLocation]);

  // Queue: animations waiting for follow=false to take effect
  const pendingAnimRef = useRef<(() => void) | null>(null);

  // After internalFollow becomes false, run pending animation
  useEffect(() => {
    if (!internalFollow && pendingAnimRef.current) {
      const fn = pendingAnimRef.current;
      pendingAnimRef.current = null;
      // requestAnimationFrame ensures Camera has committed follow=false to native
      requestAnimationFrame(() => fn());
    }
  }, [internalFollow]);

  /** Disable follow (if needed) then run the animation. */
  const runCameraAction = useCallback((action: () => void) => {
    if (internalFollow) {
      pendingAnimRef.current = action;
      setInternalFollow(false);
    } else {
      action();
    }
  }, [internalFollow]);

  // Determine mode
  const isRouteMode = routePoints.length > 0;
  const isMarkersMode = !isRouteMode && markers != null;
  const isInteractive = interactive ?? (isMarkersMode ? true : false);

  // Imperative handle
  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region, duration = 500) => {
      if (!isFinite(region.longitude) || !isFinite(region.latitude)) return;
      runCameraAction(() => {
        cameraRef.current?.setCamera({
          centerCoordinate: [region.longitude, region.latitude],
          zoomLevel: deltaToZoom(region.latitudeDelta),
          animationDuration: duration,
          animationMode: 'easeTo',
          padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        });
      });
    },
    animateCamera: (camera: Camera, duration = 1500) => {
      runCameraAction(() => {
        const config: any = { animationDuration: duration, animationMode: 'flyTo' };
        if (camera.center) {
          config.centerCoordinate = [camera.center.longitude, camera.center.latitude];
        }
        if (camera.pitch != null) config.pitch = camera.pitch;
        if (camera.heading != null) config.heading = camera.heading;
        if (camera.zoom != null) config.zoomLevel = camera.zoom;
        // Always reset padding to prevent stale padding from previous state
        config.padding = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
        cameraRef.current?.setCamera(config);
      });
    },
    fitToCoordinates: (
      coords: Array<{ latitude: number; longitude: number }>,
      edgePadding = EDGE_PADDING,
      animated = true,
    ) => {
      if (coords.length === 0) return;
      runCameraAction(() => {
        const { ne, sw } = computeBounds(coords);
        cameraRef.current?.fitBounds(
          ne,
          sw,
          [edgePadding.top, edgePadding.right, edgePadding.bottom, edgePadding.left],
          animated ? 500 : 0,
        );
      });
    },
    smoothZoomIn: (camera: Camera, duration = 1500) => {
      // Directly call setCamera WITHOUT disabling internalFollow.
      // This prevents the follow-stuck-at-false bug on Android where
      // animateCamera's runCameraAction disables follow permanently.
      // Also suppress custom follow for the animation duration so competing
      // setCamera calls don't interrupt the flyTo (causes jitter on Android).
      suppressFollowUntilRef.current = Date.now() + duration;
      const config: any = { animationDuration: duration, animationMode: 'flyTo' };
      if (camera.center) {
        config.centerCoordinate = [camera.center.longitude, camera.center.latitude];
      }
      if (camera.pitch != null) config.pitch = camera.pitch;
      if (camera.heading != null) config.heading = camera.heading;
      if (camera.zoom != null) config.zoomLevel = camera.zoom;
      config.padding = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
      cameraRef.current?.setCamera(config);
    },
    takeSnapshot: async (writeToDisk = true) => {
      if (!mapViewRef.current) throw new Error('MapView ref not available');
      const uri = await (mapViewRef.current as any).takeSnap(writeToDisk);
      return uri as string;
    },
    recenterOnUser: (location?: { latitude: number; longitude: number }) => {
      // Directly move camera to given location, then re-enable follow.
      // On Android, native follow is disabled so we must always setCamera explicitly.
      if (location) {
        cameraRef.current?.setCamera({
          centerCoordinate: [location.longitude, location.latitude],
          zoomLevel: followZoomLevel ?? 16,
          animationDuration: 500,
          animationMode: 'flyTo',
          padding: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 },
        });
      }
      // Re-enable follow (custom follow will keep centering on updates)
      setInternalFollow(true);
    },
  }), [runCameraAction, followZoomLevel]);

  // Initial camera config (skip route bounds when following user — Camera centers on user automatically)
  // Camera defaultSettings: the ONLY reliable way to set initial position.
  // setCamera() calls are ignored if Camera hasn't mounted yet.
  // lastKnownLocation comes from zustand persist (synchronously available).
  const cameraDefaults = useMemo(() => {
    // When animateToRouteOnLoad is set, start from user's last position
    // and animate to route bounds after map loads (smoother transition)
    if (animateToRouteOnLoad && lastKnownLocation) {
      return {
        centerCoordinate: [lastKnownLocation.longitude, lastKnownLocation.latitude] as [number, number],
        zoomLevel: 16,
      };
    }
    if (isRouteMode && routePoints.length >= 2 && !followsUserLocation) {
      const { ne, sw } = computeBounds(routePoints);
      const latDelta = Math.max((ne[1] - sw[1]) * 2.5, 0.01);
      return {
        centerCoordinate: [(ne[0] + sw[0]) / 2, (ne[1] + sw[1]) / 2] as [number, number],
        zoomLevel: deltaToZoom(latDelta),
      };
    }
    // Use persisted user location instead of SEOUL_CENTER
    const center: [number, number] = lastKnownLocation
      ? [lastKnownLocation.longitude, lastKnownLocation.latitude]
      : SEOUL_CENTER;
    return {
      centerCoordinate: center,
      zoomLevel: followsUserLocation ? 16 : DEFAULT_ZOOM,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // lastKnownLocation is read once at mount — it's from zustand persist so it's
  // synchronously available. Empty deps is intentional to avoid camera resets.

  // Fit map to route bounds after map loads (skip when following user — Camera handles centering)
  const handleDidFinishLoadingMap = useCallback(() => {
    if (__DEV__) console.log('[RouteMapView] onDidFinishLoadingMap fired — map style loaded');
    if (isRouteMode && routePoints.length >= 2 && !followsUserLocation) {
      const { ne, sw } = computeBounds(routePoints);
      if (animateToRouteOnLoad) {
        // Smooth transition: wait briefly then animate to route bounds
        setTimeout(() => {
          cameraRef.current?.fitBounds(ne, sw, [40, 40, 40, 40], 800);
        }, 400);
      } else {
        // Immediate fit + delayed retry to ensure bounds are applied
        cameraRef.current?.fitBounds(ne, sw, [40, 40, 40, 40], 0);
        setTimeout(() => {
          cameraRef.current?.fitBounds(ne, sw, [40, 40, 40, 40], 0);
        }, 500);
      }
    }
  }, [isRouteMode, routePoints, followsUserLocation, animateToRouteOnLoad]);

  // Re-fit when routePoints change (skip initial mount when animateToRouteOnLoad — handled by onDidFinishLoadingMap)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (isRouteMode && routePoints.length >= 2 && !followsUserLocation) {
      if (animateToRouteOnLoad && !mountedRef.current) {
        mountedRef.current = true;
        return; // Skip — onDidFinishLoadingMap will animate
      }
      mountedRef.current = true;
      const timer = setTimeout(() => {
        const { ne, sw } = computeBounds(routePoints);
        cameraRef.current?.fitBounds(ne, sw, [40, 40, 40, 40], 500);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isRouteMode, routePoints, followsUserLocation, animateToRouteOnLoad]);

  // Custom follow: center camera on customUserLocation (Kalman-filtered)
  // instead of relying on Mapbox's native follow which tracks raw GPS.
  // Also rotates the map to face the user's heading direction.
  // Applies followPadding so the GPS dot centers in the visible map area
  // (accounting for overlapping inline UI panels).
  useEffect(() => {
    if (useCustomFollow && customUserLocation) {
      // Skip if smoothZoomIn animation is in progress — let the flyTo finish
      // without competing setCamera calls that cause jitter on Android.
      if (Date.now() < suppressFollowUntilRef.current) return;

      // Skip camera update if position changed less than ~0.5m to avoid
      // unnecessary setCamera calls on every GPS tick.
      if (lastCameraPosRef.current) {
        const dlat = Math.abs(customUserLocation.latitude - lastCameraPosRef.current.lat);
        const dlng = Math.abs(customUserLocation.longitude - lastCameraPosRef.current.lng);
        if (dlat < 0.000005 && dlng < 0.000005) return; // ~0.5m
      }
      lastCameraPosRef.current = { lat: customUserLocation.latitude, lng: customUserLocation.longitude };

      const zoomLevel = followZoomLevel ?? 16;
      // Only rotate the map when in course/compass mode (running).
      // In normal mode (idle/touring), keep the map north-up — the heading
      // cone on the marker handles direction display instead.
      const rotateMap = followUserModeProp === 'course' || followUserModeProp === 'compass';
      const headingToUse = rotateMap ? (customUserHeading ?? 0) : 0;
      const cameraConfig: any = {
        centerCoordinate: [customUserLocation.longitude, customUserLocation.latitude],
        zoomLevel,
        heading: headingToUse,
        pitch: followPitchProp ?? 0,
        // 800ms easeTo bridges 1Hz GPS updates smoothly (vs 150ms which looked choppy)
        animationDuration: Platform.OS === 'android' ? 800 : 500,
        animationMode: 'easeTo',
      };
      // Apply padding so the camera centers the user in the visible area.
      // IMPORTANT: Always set padding explicitly — Mapbox retains previous
      // padding if omitted, so we must zero it out when no padding is needed.
      if (followPadding) {
        cameraConfig.padding = {
          paddingTop: followPadding.paddingTop ?? 0,
          paddingBottom: followPadding.paddingBottom ?? 0,
          paddingLeft: followPadding.paddingLeft ?? 0,
          paddingRight: followPadding.paddingRight ?? 0,
        };
      } else {
        cameraConfig.padding = { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
      }
      cameraRef.current?.setCamera(cameraConfig);
    }
  }, [useCustomFollow, customUserLocation?.latitude, customUserLocation?.longitude, followZoomLevel, customUserHeading, followPitchProp, followPadding, followUserModeProp]);

  // Region change callback
  const handleRegionDidChange = useCallback(
    (feature: any) => {
      // Track map bearing for heading cone compensation
      const bearing = feature?.properties?.heading;
      if (bearing != null) mapBearingRef.current = bearing;

      // Track zoom level (ref — no re-render needed)
      const zoom = feature?.properties?.zoomLevel;
      if (zoom != null) currentZoomRef.current = zoom;

      // Detect user-initiated map gesture (pan/zoom/rotate)
      const isUserInteraction = feature?.properties?.isUserInteraction;
      if (isUserInteraction) {
        // Disengage custom follow when user pans/zooms
        if (useCustomFollow) setInternalFollow(false);
        if (onUserMapInteraction) onUserMapInteraction();
      }

      if (!onRegionChange) return;
      const bounds = feature?.properties?.visibleBounds;
      if (!bounds || bounds.length < 2) return;
      const ne = bounds[0]; // [lng, lat]
      const sw = bounds[1];
      const region: Region = {
        latitude: (ne[1] + sw[1]) / 2,
        longitude: (ne[0] + sw[0]) / 2,
        latitudeDelta: Math.abs(ne[1] - sw[1]),
        longitudeDelta: Math.abs(ne[0] - sw[0]),
      };
      onRegionChange(region);
    },
    [onRegionChange, onUserMapInteraction, useCustomFollow],
  );

  // User location update
  const handleUserLocationUpdate = useCallback(
    (location: any) => {
      if (!onUserLocationChange) return;
      const coords = location?.coords;
      if (!coords || !isFinite(coords.latitude) || !isFinite(coords.longitude)) return;
      onUserLocationChange({
        latitude: coords.latitude,
        longitude: coords.longitude,
        heading: coords.heading,
      });
    },
    [onUserLocationChange],
  );

  // Start / end points for route mode
  const startPoint = isRouteMode ? routePoints[0] : undefined;
  const endPoint =
    isRouteMode && routePoints.length >= 2
      ? (endPointOverride ?? routePoints[routePoints.length - 1])
      : undefined;

  // Detect round-trip: start ≈ end (within ~50m)
  const isRoundTrip = useMemo(() => {
    if (!startPoint || !endPoint) return false;
    const dlat = startPoint.latitude - endPoint.latitude;
    const dlng = startPoint.longitude - endPoint.longitude;
    return Math.sqrt(dlat * dlat + dlng * dlng) < 0.0005; // ~50m
  }, [startPoint, endPoint]);

  // Route GeoJSON — throttled during live running to avoid rebuilding on every GPS tick.
  // Only rebuilds when point count changes by 3+ (every ~3 seconds at 1Hz GPS).
  // Static routes (result screen, course preview) update immediately.
  const lastGeoJSONLenRef = useRef(0);
  const cachedRouteGeoJSONRef = useRef<ReturnType<typeof toLineGeoJSON> | null>(null);
  const routeGeoJSON = useMemo(() => {
    if (!isRouteMode || routePoints.length < 2) return null;
    const len = routePoints.length;
    // During live running (subscribeToRunningRoute), throttle updates
    // Skip throttle when using snapped route — snap calls already batch updates
    if (subscribeToRunningRoute && !snappedRouteOverride?.length && cachedRouteGeoJSONRef.current && len - lastGeoJSONLenRef.current < 10) {
      return cachedRouteGeoJSONRef.current;
    }
    lastGeoJSONLenRef.current = len;
    cachedRouteGeoJSONRef.current = toLineGeoJSON(routePoints);
    return cachedRouteGeoJSONRef.current;
  // routeVersion triggers rebuild when mutable backing array is updated
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRouteMode, routePoints, subscribeToRunningRoute, routeVersion, snappedRouteOverride]);

  // Deviation overlay GeoJSON (red segments where runner went off-course)
  const deviationGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.MultiLineString> | null>(() => {
    if (!deviationSegments || deviationSegments.length === 0 || routePoints.length < 2) return null;
    const lines: number[][][] = [];
    for (const [start, end] of deviationSegments) {
      const s = Math.max(0, start);
      const e = Math.min(routePoints.length - 1, end);
      if (e - s < 1) continue;
      const coords = routePoints.slice(s, e + 1).map(p => [p.longitude, p.latitude]);
      if (coords.length >= 2) lines.push(coords);
    }
    if (lines.length === 0) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    };
  }, [deviationSegments, routePoints]);

  // Signal gap overlay GeoJSON (dashed gray segments where GPS signal was lost)
  const signalGapGeoJSON = useMemo<GeoJSON.Feature<GeoJSON.MultiLineString> | null>(() => {
    if (!signalGapSegments || signalGapSegments.length === 0 || routePoints.length < 2) return null;
    const lines: number[][][] = [];
    for (const [start, end] of signalGapSegments) {
      const s = Math.max(0, start);
      const e = Math.min(routePoints.length - 1, end);
      if (e - s < 1) continue;
      const segment = routePoints.slice(s, e + 1).map(p => [p.longitude, p.latitude]);
      lines.push(segment);
    }
    if (lines.length === 0) return null;
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiLineString', coordinates: lines },
    };
  }, [signalGapSegments, routePoints]);

  // Preview polyline GeoJSON
  const previewGeoJSON = useMemo(() => {
    if (!previewPolyline || previewPolyline.length < 2) return null;
    return toLineGeoJSON(previewPolyline);
  }, [previewPolyline]);

  // Globe projection for the world map mode (only in 3D style).
  // Android: globe ↔ mercator switch causes a full map reload (tile re-fetch +
  // blank flash). On iOS the transition is smooth. Disable globe entirely on
  // Android so the running transition doesn't trigger a map re-render.
  const projection = isMarkersMode && use3DStyle && Platform.OS === 'ios' ? 'globe' : 'mercator';

  // Map style: 3D = custom Mapbox styles, 2D = basic flat styles
  const mapStyleURL = use3DStyle
    ? (isDark ? MAPBOX_DARK_STYLE : MAPBOX_LIGHT_STYLE)
    : (isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11');

  return (
    <View
      style={[styles.container, style]}
      pointerEvents={!isInteractive && Platform.OS === 'android' ? 'none' : 'auto'}
      onTouchStart={isInteractive && onUserMapInteraction ? () => {
        if (useCustomFollow) setInternalFollow(false);
        onUserMapInteraction();
      } : undefined}
    >
      <Mapbox.MapView
        ref={mapViewRef}
        styleURL={mapStyleURL}
        projection={projection}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={isInteractive}
        zoomEnabled={isInteractive}
        rotateEnabled={isInteractive && (!!pitchEnabledProp || followUserModeProp === 'course')}
        pitchEnabled={isInteractive && (!!pitchEnabledProp || followPitchProp != null)}
        onPress={onMapPress && isInteractive ? (feature: any) => onMapPress(feature) : undefined}
        onDidFinishLoadingMap={handleDidFinishLoadingMap}
        onRegionDidChange={isMarkersMode || useCustomFollow || customUserLocation ? handleRegionDidChange : undefined}
        style={styles.map}
      >
        {/* Camera */}
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={cameraDefaults}
          followUserLocation={nativeFollowEnabled}
          followUserMode={nativeFollowEnabled
            ? (followUserModeProp === 'course'
              ? UserTrackingMode.FollowWithCourse
              : followUserModeProp === 'compass'
                ? UserTrackingMode.FollowWithHeading
                : UserTrackingMode.Follow)
            : undefined}
          followZoomLevel={nativeFollowEnabled ? (followZoomLevel ?? 15) : undefined}
          followPitch={internalFollow && followPitchProp != null ? followPitchProp : undefined}
          padding={{
            paddingTop: followPadding?.paddingTop ?? 0,
            paddingBottom: followPadding?.paddingBottom ?? 0,
            paddingLeft: followPadding?.paddingLeft ?? 0,
            paddingRight: followPadding?.paddingRight ?? 0,
          }}
          animationMode="easeTo"
          animationDuration={1000}
        />

        {/* ---- Route display mode ---- */}
        {routeGeoJSON && (
          <Mapbox.ShapeSource
            id="route-source"
            shape={routeGeoJSON}
            lineMetrics={useGradient}
          >
            <Mapbox.LineLayer
              id="route-line"
              style={{
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
                ...(useGradient
                  ? {
                      lineGradient: [
                        'interpolate',
                        ['linear'],
                        ['line-progress'],
                        0, '#4A90D9',
                        0.5, '#FFD600',
                        1, '#FF6B35',
                      ],
                    }
                  : { lineColor: '#FFD600' }),
              }}
            />
          </Mapbox.ShapeSource>
        )}
        {deviationGeoJSON && (
          <Mapbox.ShapeSource id="deviation-source" shape={deviationGeoJSON}>
            <Mapbox.LineLayer
              id="deviation-line"
              aboveLayerID="route-line"
              style={{
                lineColor: '#FF3B30',
                lineWidth: 6,
                lineOpacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}
        {signalGapGeoJSON && (
          <Mapbox.ShapeSource id="signalGapSource" shape={signalGapGeoJSON}>
            <Mapbox.LineLayer
              id="signalGapLine"
              aboveLayerID="route-line"
              style={{
                lineColor: '#8E8E93',
                lineWidth: 4,
                lineDasharray: [3, 2],
                lineOpacity: 0.7,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {startPoint && !hideRouteMarkers && isRoundTrip && (
          <Mapbox.MarkerView
            coordinate={[startPoint.longitude, startPoint.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.routePointWrapper}>
              <View style={[styles.routePointDot, styles.startDot]} />
              <Text style={[styles.routePointLabel, styles.startLabel]}>START / FINISH</Text>
            </View>
          </Mapbox.MarkerView>
        )}

        {startPoint && !hideRouteMarkers && !isRoundTrip && (
          <Mapbox.MarkerView
            coordinate={[startPoint.longitude, startPoint.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.routePointWrapper}>
              <View style={[styles.routePointDot, styles.startDot]} />
              <Text style={[styles.routePointLabel, styles.startLabel]}>START</Text>
            </View>
          </Mapbox.MarkerView>
        )}

        {endPoint && !hideRouteMarkers && !isRoundTrip && (
          <Mapbox.MarkerView
            coordinate={[endPoint.longitude, endPoint.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.routePointWrapper}>
              <View style={[styles.routePointDot, styles.finishDot]} />
              <Text style={[styles.routePointLabel, styles.finishLabel]}>FINISH</Text>
            </View>
          </Mapbox.MarkerView>
        )}

        {/* ---- Lap count badge (near start point) ---- */}
        {startPoint && lapCount != null && lapCount > 0 && (
          <Mapbox.MarkerView
            coordinate={[startPoint.longitude, startPoint.latitude]}
            anchor={{ x: 0.5, y: 1.2 }}
            allowOverlap={true}
          >
            <View style={styles.lapBadge}>
              <Text style={styles.lapBadgeText}>{lapCount}바퀴</Text>
            </View>
          </Mapbox.MarkerView>
        )}

        {/* ---- Checkpoint markers (numbered circles along the route) ---- */}
        {checkpoints && checkpoints.length > 0 && checkpoints.map((cp) => {
            const bgColor = cp.passed ? '#34C759' : cp.isNext ? '#FFD700' : 'rgba(255,255,255,0.25)';
            const borderColor = cp.passed ? '#34C759' : cp.isNext ? '#FFD700' : 'rgba(255,255,255,0.6)';
            const textColor = cp.passed || cp.isNext ? '#000' : '#fff';
            return (
              <Mapbox.MarkerView
                key={`cp-${cp.id}`}
                coordinate={[cp.lng, cp.lat]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap={true}
              >
                <View style={[styles.checkpointBadge, { backgroundColor: bgColor, borderColor }]}>
                  <Text style={[styles.checkpointText, { color: textColor }]}>{cp.order}</Text>
                </View>
              </Mapbox.MarkerView>
            );
          })}

        {/* ---- Split km markers along the route ---- */}
        {splitMarkers && splitMarkers.length > 0 && splitMarkers.map((sm) => (
          <Mapbox.MarkerView
            key={`split-${sm.km}`}
            coordinate={[sm.longitude, sm.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
            allowOverlap={true}
          >
            <View style={styles.splitMarkerWrapper}>
              <View style={styles.splitMarkerBadge}>
                <Text style={styles.splitMarkerKm}>{sm.km}</Text>
              </View>
              {sm.pace && (
                <Text style={styles.splitMarkerPace}>{sm.pace}</Text>
              )}
            </View>
          </Mapbox.MarkerView>
        ))}

        {/* ---- Open-world course markers (racing badge style) ---- */}
        {isMarkersMode && markers
          ?.filter((m) => m.start_lat != null && m.start_lng != null)
          .map((m) => {
            const diff = (m.difficulty ?? 'normal') as DifficultyLevel;
            const badgeColor = DIFFICULTY_COLORS[diff] ?? DIFFICULTY_COLORS.normal;
            const icon: keyof typeof Ionicons.glyphMap = 'flag';
            return (
              <Mapbox.MarkerView
                key={`course-${m.id}`}
                coordinate={[m.start_lng, m.start_lat]}
                anchor={{ x: 0.5, y: 0.5 }}
                allowOverlap={true}
                allowOverlapWithPuck={true}
              >
                <View
                  style={styles.courseBadgeWrapper}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={() => onMarkerPress?.(m.id)}
                  hitSlop={Platform.OS === 'android' ? { top: 16, bottom: 16, left: 16, right: 16 } : 8}
                >
                  {m.dominion?.crew_logo_url ? (
                    <Image
                      source={{ uri: m.dominion.crew_logo_url }}
                      style={[styles.dominionMarkerLogo, {
                        borderColor: m.dominion.crew_badge_color || badgeColor,
                      }]}
                    />
                  ) : (
                    <View style={[styles.courseBadge, { backgroundColor: badgeColor }]}>
                      <Ionicons name={icon} size={14} color={COLORS.white} />
                    </View>
                  )}
                </View>
              </Mapbox.MarkerView>
            );
          })}

        {/* User location — unmount native puck entirely on Android when custom marker is active
            to prevent double-layer issue (visible=false still renders native puck on some Android devices).
            On iOS, keep it mounted with visible=false so onUpdate still fires for location callbacks. */}
        {(showUserLocation || onUserLocationChange) && (
          <Mapbox.UserLocation
            visible={showUserLocation && !customUserLocation}
            showsUserHeadingIndicator={showUserLocation && !customUserLocation}
            onUpdate={handleUserLocationUpdate}
          />
        )}

        {/* Custom orange location dot + heading arrow (isolated component to avoid parent re-renders) */}
        <SmoothLocationMarker
          customUserLocation={customUserLocation}
          customUserHeading={customUserHeading}
          followUserMode={followUserModeProp}
        />

        {/* ---- Event markers ---- */}
        {eventMarkers
          ?.filter((e) => e.center_lat != null && e.center_lng != null)
          .map((event) => (
          <Mapbox.MarkerView
            key={`event-${event.id}`}
            coordinate={[event.center_lng, event.center_lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <Pressable
              style={styles.eventMarkerWrapper}
              onPress={() => onEventMarkerPress?.(event.id)}
              hitSlop={8}
            >
              <View style={[styles.eventMarkerOuter, { borderColor: event.badge_color || COLORS.accent }]}>
                <View style={[styles.eventMarkerInner, { backgroundColor: event.badge_color || COLORS.accent }]}>
                  <Ionicons name={(event.badge_icon || 'flash') as any} size={16} color={COLORS.white} />
                </View>
              </View>
            </Pressable>
          </Mapbox.MarkerView>
        ))}


        {/* ---- Last known location marker (only when custom orange marker is NOT active) ---- */}
        {lastKnownLocation && !customUserLocation && (
          <Mapbox.MarkerView
            coordinate={[lastKnownLocation.longitude, lastKnownLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationDot}>
              <View style={styles.userLocationInner} />
            </View>
          </Mapbox.MarkerView>
        )}


        {/* ---- Preview polyline (3D course preview) ---- */}
        {previewGeoJSON && (
          <Mapbox.ShapeSource id="preview-source" shape={previewGeoJSON}>
            <Mapbox.LineLayer
              id="preview-line"
              style={{
                lineColor: '#FFD600',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {previewPolyline && previewPolyline.length >= 2 && (() => {
          const first = previewPolyline[0];
          const last = previewPolyline[previewPolyline.length - 1];
          const dlat = first.latitude - last.latitude;
          const dlng = first.longitude - last.longitude;
          const isLoop = Math.sqrt(dlat * dlat + dlng * dlng) < 0.0005;
          return isLoop ? (
            <Mapbox.MarkerView coordinate={[first.longitude, first.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.routePointWrapper}>
                <View style={[styles.routePointDot, styles.startDot]} />
                <Text style={[styles.routePointLabel, styles.startLabel]}>START / FINISH</Text>
              </View>
            </Mapbox.MarkerView>
          ) : (
            <>
              <Mapbox.MarkerView coordinate={[first.longitude, first.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.routePointWrapper}>
                  <View style={[styles.routePointDot, styles.startDot]} />
                  <Text style={[styles.routePointLabel, styles.startLabel]}>START</Text>
                </View>
              </Mapbox.MarkerView>
              <Mapbox.MarkerView coordinate={[last.longitude, last.latitude]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.routePointWrapper}>
                  <View style={[styles.routePointDot, styles.finishDot]} />
                  <Text style={[styles.routePointLabel, styles.finishLabel]}>FINISH</Text>
                </View>
              </Mapbox.MarkerView>
            </>
          );
        })()}

        {previewPolyline && previewPolyline.length === 1 && (
          <Mapbox.MarkerView coordinate={[previewPolyline[0].longitude, previewPolyline[0].latitude]} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.routePointWrapper}>
              <View style={[styles.routePointDot, styles.startDot]} />
              <Text style={[styles.routePointLabel, styles.startLabel]}>START</Text>
            </View>
          </Mapbox.MarkerView>
        )}
      </Mapbox.MapView>
    </View>
  );
});

export default RouteMapView;

// ============================================================
// Styles
// ============================================================

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  map: {
    flex: 1,
    minHeight: 200,
  },

  // ---- Route START / FINISH markers ----
  routePointWrapper: {
    alignItems: 'center',
  },
  routePointDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  startDot: {
    backgroundColor: '#FFD600',
  },
  finishDot: {
    backgroundColor: '#FF3B30',
  },
  routePointLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 3,
  },
  startLabel: {
    color: '#FFD600',
  },
  finishLabel: {
    color: '#FF3B30',
  },


  // ---- Event markers ----
  eventMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  eventMarkerOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventMarkerInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // ---- User location marker + heading chevron ----
  userLocationWrapper: {
    alignItems: 'center',
    width: 48,
    height: 48,
    justifyContent: 'center',
    overflow: 'visible',
  },
  headingChevron: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF5F00',
    position: 'absolute',
    top: 0,
  },
  userLocationInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF5F00',
    borderWidth: 3.5,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 10,
  },
  userLocationDot: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Checkpoint markers ----
  checkpointBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  checkpointText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // ---- Split km markers ----
  splitMarkerWrapper: {
    alignItems: 'center',
  },
  splitMarkerBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitMarkerKm: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  splitMarkerPace: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // ---- Lap count badge ----
  lapBadge: {
    backgroundColor: 'rgba(232, 87, 42, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 5,
  },
  lapBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },

  // ---- Racing badge course markers ----
  courseBadgeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  dominionMarkerLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
});
