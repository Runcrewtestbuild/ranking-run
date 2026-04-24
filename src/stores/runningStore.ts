import { create } from 'zustand';
import type { LocationUpdateEvent, GPSStatus, FilteredLocation } from '../types/gps';
import type { Split, PauseInterval, CheckpointPass } from '../types/api';
import { haversineDistance } from '../utils/geo';
import { useSettingsStore } from './settingsStore';

// ---- Mutable backing arrays (NOT in Zustand state) ----
// These arrays are mutated in-place via push() to avoid O(n) concat() on every
// GPS tick. Zustand store holds a version counter that increments when the array
// changes, so subscribers can react without comparing array references.
// Access the actual data via getRoutePoints() / getFilteredLocations().
let _routePoints: Array<{ latitude: number; longitude: number }> = [];
let _filteredLocations: FilteredLocation[] = [];

export function getRoutePoints() { return _routePoints; }
export function getFilteredLocations() { return _filteredLocations; }

// Loop detection constants
const LOOP_MIN_DISTANCE_M = 300;      // Min distance before checking (avoid false positive at start)
const LOOP_PROXIMITY_RADIUS_M = 30;   // "Near start" radius
const LOOP_APPROACH_RADIUS_M = 100;   // "Approaching start" radius (pre-warning)
const LOOP_COOLDOWN_MS = 60_000;      // Don't re-trigger for 60s after detection

// Speed anomaly detection: if speed exceeds this for N consecutive updates, flag the run
const SPEED_ANOMALY_THRESHOLD_MS = 6.9;    // ~25 km/h — well above sprint speed
const SPEED_ANOMALY_CONSECUTIVE = 10;      // 10 consecutive readings (~10s at 1Hz GPS)
const SPEED_ANOMALY_MIN_DISTANCE_M = 200;  // Don't trigger in first 200m (GPS warmup)

// Memory cap for filteredLocations (raw GPS data for chunk uploads).
// When exceeded, drop oldest 20% to prevent unbounded memory growth on ultra-long runs.
const MAX_FILTERED_LOCATIONS = 50_000;
const FILTERED_LOCATIONS_TRIM_RATIO = 0.8; // keep last 80%

export type RunningPhase = 'idle' | 'countdown' | 'running' | 'paused' | 'completed';

export interface IntervalSegment {
  set: number;           // 1-based
  phase: 'run' | 'walk';
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecondsPerKm: number;
}

interface RunningState {
  // Session
  sessionId: string | null;
  courseId: string | null;
  phase: RunningPhase;

  // Live metrics
  distanceMeters: number;
  durationSeconds: number;
  currentPaceSecondsPerKm: number;
  avgPaceSecondsPerKm: number;
  currentSpeedMs: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  calories: number;
  cadence: number; // steps per minute

  // GPS
  gpsStatus: GPSStatus;
  gpsAccuracy: number | null;
  distanceSource: 'gps' | 'pedometer';
  currentLocation: LocationUpdateEvent | null;
  // routePoints and filteredLocations live in mutable backing arrays
  // (_routePoints, _filteredLocations) for O(1) push. Store holds version
  // counters so subscribers know when to re-read via getRoutePoints().
  routePointsVersion: number;
  filteredLocationsVersion: number;
  // Legacy accessors kept for backward compatibility (read from backing arrays)
  routePoints: Array<{ latitude: number; longitude: number }>;
  filteredLocations: FilteredLocation[];

  // Course route snapping (course running only)
  snappedRoutePoints: Array<{ latitude: number; longitude: number }>;

  // Course deviation log (for result screen visualization)
  deviationLog: Array<{ index: number; deviation: number }>;

  // Splits
  splits: Split[];
  currentSplitDistance: number;

  // Pause
  pauseIntervals: PauseInterval[];
  isPaused: boolean;

  // Watch
  heartRate: number;
  watchConnected: boolean;

  // Chunk tracking
  chunkSequence: number;
  lastChunkTimestamp: number;
  lastChunkDistance: number;
  lastChunkPointIndex: number;
  uploadedChunkSequences: number[];

  // Loop detection (free running only)
  startPoint: { latitude: number; longitude: number } | null;
  distanceToStart: number;       // live distance to start point (meters)
  isApproachingStart: boolean;   // within 100m of start
  isNearStart: boolean;          // within 30m of start
  loopDetected: boolean;         // confirmed round-trip
  loopDetectedAt: number | null; // timestamp of detection (for cooldown)
  lapCount: number;              // number of completed laps (start point crossings)

  // Checkpoint passes (course running)
  checkpointPasses: CheckpointPass[];

  // Native course navigation state (iOS background-capable)
  nativeCourseProgress: {
    deviationMeters: number;
    isOffCourse: boolean;
    progressPercent: number;
    remainingMeters: number;
  } | null;
  nativeCheckpointPasses: Array<{ order: number; elapsedSeconds: number }>;
  nativeCourseFinished: boolean;

  // Stop location (captured when user taps stop)
  stopLocation: { latitude: number; longitude: number } | null;

  // Timer
  startTime: number | null;
  elapsedBeforePause: number;

  // Auto-pause (timer frozen while stationary, phase stays "running")
  isAutoPaused: boolean;

  // Speed anomaly detection
  speedAnomalyDetected: boolean;
  highSpeedCount: number;

  // Run goal
  runGoal: {
    type: 'distance' | 'time' | 'pace' | 'program' | 'interval' | null;
    value: number | null;
    targetTime?: number | null;
    cadenceBPM?: number | null;
    adaptiveMetronome?: boolean;
    intervalRunSeconds?: number;
    intervalWalkSeconds?: number;
    intervalSets?: number;
  };

  // Interval segment tracking
  intervalSegments: IntervalSegment[];

  // Actions
  startSession: (sessionId: string, courseId: string | null) => void;
  updateSessionId: (serverSessionId: string) => void;
  updateLocation: (event: LocationUpdateEvent) => void;
  updateGPSStatus: (status: GPSStatus, accuracy?: number | null) => void;
  addDeviationPoint: (index: number, deviation: number) => void;
  updateDuration: (seconds: number) => void;
  pause: () => void;
  resume: () => void;
  complete: () => void;
  reset: () => void;
  addSplit: (split: Split) => void;
  incrementChunkSequence: () => void;
  decrementChunkSequence: () => void;
  markChunkUploaded: (sequence: number, pointCount: number, distance: number) => void;
  setPhase: (phase: RunningPhase) => void;
  updateHeartRate: (bpm: number) => void;
  setWatchConnected: (connected: boolean) => void;
  setCheckpointPasses: (passes: CheckpointPass[]) => void;
  setNativeCourseProgress: (progress: { deviationMeters: number; isOffCourse: boolean; progressPercent: number; remainingMeters: number }) => void;
  addNativeCheckpointPass: (pass: { order: number; elapsedSeconds: number }) => void;
  setNativeCourseFinished: (finished: boolean) => void;
  setAutoPaused: (paused: boolean) => void;
  setRunGoal: (goal: { type: 'distance' | 'time' | 'pace' | 'program' | 'interval' | null; value: number | null; targetTime?: number | null; cadenceBPM?: number | null; adaptiveMetronome?: boolean; intervalRunSeconds?: number; intervalWalkSeconds?: number; intervalSets?: number }) => void;
  addIntervalSegment: (segment: IntervalSegment) => void;
  addSnappedPoint: (coord: { latitude: number; longitude: number }) => void;
  setSnappedRoute: (points: Array<{ latitude: number; longitude: number }>) => void;
  restoreSession: (data: {
    sessionId: string;
    courseId: string | null;
    phase: RunningPhase;
    startTime: number | null;
    elapsedBeforePause: number;
    durationSeconds: number;
    isPaused: boolean;
    isAutoPaused: boolean;
    distanceMeters: number;
    currentPaceSecondsPerKm: number;
    avgPaceSecondsPerKm: number;
    elevationGainMeters: number;
    elevationLossMeters: number;
    calories: number;
    filteredLocations: import('../types/gps').FilteredLocation[];
    routePoints: Array<{ latitude: number; longitude: number }>;
    splits: Split[];
    pauseIntervals: PauseInterval[];
    chunkSequence: number;
    lastChunkDistance: number;
    lastChunkTimestamp: number;
    lastChunkPointIndex: number;
    uploadedChunkSequences: number[];
    snappedRoutePoints: Array<{ latitude: number; longitude: number }>;
    deviationLog: Array<{ index: number; deviation: number }>;
    startPoint: { latitude: number; longitude: number } | null;
    runGoal: { type: 'distance' | 'time' | 'pace' | 'program' | 'interval' | null; value: number | null; targetTime?: number | null; cadenceBPM?: number | null; adaptiveMetronome?: boolean; intervalRunSeconds?: number; intervalWalkSeconds?: number; intervalSets?: number };
  }) => void;
}

export const useRunningStore = create<RunningState>((set, get) => ({
  sessionId: null,
  courseId: null,
  phase: 'idle',

  distanceMeters: 0,
  durationSeconds: 0,
  currentPaceSecondsPerKm: 0,
  avgPaceSecondsPerKm: 0,
  currentSpeedMs: 0,
  elevationGainMeters: 0,
  elevationLossMeters: 0,
  calories: 0,
  cadence: 0,

  gpsStatus: 'searching',
  gpsAccuracy: null,
  distanceSource: 'gps',
  currentLocation: null,
  routePointsVersion: 0,
  filteredLocationsVersion: 0,
  routePoints: _routePoints,
  filteredLocations: _filteredLocations,
  snappedRoutePoints: [],
  deviationLog: [],

  splits: [],
  currentSplitDistance: 0,

  pauseIntervals: [],
  isPaused: false,

  heartRate: 0,
  watchConnected: false,

  chunkSequence: 0,
  lastChunkTimestamp: 0,
  lastChunkDistance: 0,
  lastChunkPointIndex: 0,
  uploadedChunkSequences: [],

  startPoint: null,
  distanceToStart: 0,
  isApproachingStart: false,
  isNearStart: false,
  loopDetected: false,
  loopDetectedAt: null,
  lapCount: 0,

  checkpointPasses: [],
  nativeCourseProgress: null,
  nativeCheckpointPasses: [],
  nativeCourseFinished: false,
  stopLocation: null,

  startTime: null,
  elapsedBeforePause: 0,
  isAutoPaused: false,
  speedAnomalyDetected: false,
  highSpeedCount: 0,
  runGoal: { type: null, value: null, targetTime: null, cadenceBPM: null },
  intervalSegments: [],

  startSession: (sessionId, courseId) => {
    // Guard: prevent duplicate sessions (e.g. widget tap during active run)
    const currentPhase = get().phase;
    if (currentPhase === 'running' || currentPhase === 'paused') {
      console.warn('[RunningStore] startSession blocked: already in phase', currentPhase);
      return;
    }
    // Reset mutable backing arrays to prevent stale data from previous sessions
    _routePoints = [];
    _filteredLocations = [];
    set({
      sessionId,
      courseId,
      phase: 'running',
      distanceMeters: 0,
      durationSeconds: 0,
      currentPaceSecondsPerKm: 0,
      avgPaceSecondsPerKm: 0,
      currentSpeedMs: 0,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      calories: 0,
      cadence: 0,
      gpsStatus: 'searching',
      gpsAccuracy: null,
      currentLocation: null,
      routePoints: _routePoints,
      filteredLocations: _filteredLocations,
      routePointsVersion: 1,
      filteredLocationsVersion: 1,
      snappedRoutePoints: [],
      deviationLog: [],
      splits: [],
      currentSplitDistance: 0,
      pauseIntervals: [],
      isPaused: false,
      heartRate: 0,
      watchConnected: false,
      chunkSequence: 0,
      lastChunkTimestamp: Date.now(),
      lastChunkDistance: 0,
      lastChunkPointIndex: 0,
      uploadedChunkSequences: [],
      startTime: Date.now(),
      elapsedBeforePause: 0,
      startPoint: null,
      distanceToStart: 0,
      isApproachingStart: false,
      isNearStart: false,
      loopDetected: false,
      loopDetectedAt: null,
      lapCount: 0,
      checkpointPasses: [],
      nativeCourseProgress: null,
      nativeCheckpointPasses: [],
      nativeCourseFinished: false,
      stopLocation: null,
      isAutoPaused: false,
      speedAnomalyDetected: false,
      highSpeedCount: 0,
      intervalSegments: [],
      // runGoal is intentionally NOT reset here — it's set before startSession
    });
  },

  updateSessionId: (serverSessionId) => {
    set({ sessionId: serverSessionId });
  },

  updateLocation: (event) => {
    const state = get();
    if (state.phase !== 'running' || state.isPaused) return;

    // Validate GPS event — reject malformed data that would corrupt state
    if (
      event.latitude == null || event.longitude == null ||
      event.distanceFromStart == null || isNaN(event.distanceFromStart) ||
      event.speed == null || isNaN(event.speed) ||
      !isFinite(event.latitude) || !isFinite(event.longitude)
    ) {
      return;
    }

    const currentPos = { latitude: event.latitude, longitude: event.longitude };

    // --- Auto-pause: freeze timer when stationary ---
    // Must run BEFORE route accumulation so we can skip route points while paused
    const { autoPause, runEnvironment } = useSettingsStore.getState();
    // Indoor running: disable auto-pause (GPS speed is unreliable indoors)
    const effectiveAutoPause = autoPause && runEnvironment !== 'indoor';
    let { isAutoPaused } = state;
    let startTime = state.startTime;
    let elapsedBeforePause = state.elapsedBeforePause;

    const elapsed = startTime ? (Date.now() - startTime) / 1000 + elapsedBeforePause : elapsedBeforePause;
    const gracePeriodOver = elapsed >= 8;

    if (effectiveAutoPause && gracePeriodOver) {
      if (!event.isMoving && !isAutoPaused) {
        isAutoPaused = true;
        elapsedBeforePause = state.durationSeconds;
        startTime = null;
      } else if (event.isMoving && isAutoPaused) {
        isAutoPaused = false;
        startTime = Date.now();
      }
    } else if (isAutoPaused) {
      isAutoPaused = false;
      startTime = Date.now();
    }

    // While auto-paused, update timer state + current location (for map display)
    // but skip route/distance accumulation.
    if (isAutoPaused) {
      set({
        isAutoPaused,
        startTime,
        elapsedBeforePause,
        // Keep updating currentLocation so the map shows the user's real position
        // even while auto-paused. Without this, the blue dot freezes at the pause
        // location and only jumps when resume triggers.
        currentLocation: event,
        currentSpeedMs: event.speed,
      });
      return;
    }

    // Append GPS point via mutable push — O(1) instead of O(n) concat.
    // The backing array (_routePoints) is shared by reference; bumping
    // routePointsVersion in the store signals subscribers to re-read.
    const MAX_ROUTE_POINTS = 50_000;
    _routePoints.push(currentPos);
    if (_routePoints.length > MAX_ROUTE_POINTS) {
      // Downsample: keep every 3rd point from old data, keep last 10k intact
      const keepRecent = 10_000;
      const oldPart = _routePoints.slice(0, -keepRecent);
      const recentPart = _routePoints.slice(-keepRecent);
      const downsampled = oldPart.filter((_, i) => i % 3 === 0);
      _routePoints = [...downsampled, ...recentPart];
    }

    // Build filtered location for chunk upload (rich GPS data for server)
    const prevDistance = _filteredLocations.length > 0
      ? _filteredLocations[_filteredLocations.length - 1].cumulativeDistance
      : state.lastChunkDistance;
    const newFilteredLocation: FilteredLocation = {
      latitude: event.latitude,
      longitude: event.longitude,
      altitude: event.altitude,
      speed: event.speed,
      bearing: event.bearing,
      timestamp: event.timestamp,
      distanceFromPrevious: event.distanceFromStart - prevDistance,
      cumulativeDistance: event.distanceFromStart,
      isInterpolated: false,
      cadence: state.cadence > 0 ? state.cadence : undefined,
      heartRate: state.heartRate > 0 ? state.heartRate : undefined,
    };
    _filteredLocations.push(newFilteredLocation);
    // Cap filteredLocations to prevent unbounded memory growth on ultra-long runs.
    if (_filteredLocations.length > MAX_FILTERED_LOCATIONS) {
      const keepFrom = Math.floor(_filteredLocations.length * (1 - FILTERED_LOCATIONS_TRIM_RATIO));
      _filteredLocations = _filteredLocations.slice(keepFrom);
    }

    // Save start point from first GPS fix
    const startPoint = state.startPoint ?? currentPos;

    // Calculate pace from speed (m/s)
    const currentPace =
      event.speed > 0.3 ? 1000 / event.speed : state.currentPaceSecondsPerKm;

    // Calculate average pace — only count time while actually moving.
    // When stationary, elapsed keeps ticking but distance stays the same,
    // which would inflate avgPace (show slower pace than reality).
    // Use distance / speed integral instead: track "moving time" separately
    // is complex, so use the simple fix: if not moving, keep previous avgPace.
    const distance = event.distanceFromStart;
    const elapsedDuration = state.durationSeconds;
    let avgPace = state.avgPaceSecondsPerKm;
    if (event.speed > 0.3 && distance > 0) {
      // Only update avg pace when actually moving
      const rawAvgPace = (elapsedDuration / distance) * 1000;
      avgPace = isFinite(rawAvgPace) ? rawAvgPace : state.avgPaceSecondsPerKm;
    } else if (distance <= 0) {
      avgPace = 0;
    }

    // Estimate calories: ~60 kcal/km for ~65kg person
    const caloriesBurned = Math.round((distance / 1000) * 60);

    // --- Loop detection (free running only) ---
    let distanceToStart = 0;
    let isApproachingStart = state.isApproachingStart;
    let isNearStart = state.isNearStart;
    let loopDetected = state.loopDetected;
    let loopDetectedAt = state.loopDetectedAt;
    let lapCount = state.lapCount;

    // Only run loop detection in free running (no courseId) and after traveling enough distance.
    // Use cheap coordinate delta pre-check (~0.002° ≈ 200m) to skip expensive haversine
    // when clearly far from start — saves trig computation on every GPS tick.
    const roughlyNearStart = startPoint &&
      Math.abs(currentPos.latitude - startPoint.latitude) < 0.002 &&
      Math.abs(currentPos.longitude - startPoint.longitude) < 0.002;
    if (!state.courseId && distance > LOOP_MIN_DISTANCE_M && roughlyNearStart) {
      distanceToStart = haversineDistance(currentPos, startPoint);

      // Check cooldown: don't re-trigger within 60s of last detection
      const cooldownActive = loopDetectedAt && (Date.now() - loopDetectedAt) < LOOP_COOLDOWN_MS;

      if (!cooldownActive) {
        isApproachingStart = distanceToStart <= LOOP_APPROACH_RADIUS_M;
        isNearStart = distanceToStart <= LOOP_PROXIMITY_RADIUS_M;

        if (isNearStart && !state.isNearStart) {
          // Just entered the proximity zone — confirm loop
          loopDetected = true;
          loopDetectedAt = Date.now();
          lapCount += 1;
        }

        // Clear loop flag when user moves away from start (cooldown expired)
        if (distanceToStart > LOOP_APPROACH_RADIUS_M) {
          loopDetected = false;
          loopDetectedAt = null;
        }
      } else {
        // During cooldown, clear flags if user moves away
        if (distanceToStart > LOOP_APPROACH_RADIUS_M) {
          isApproachingStart = false;
          isNearStart = false;
        }
      }
    }

    // --- Speed anomaly detection → auto-pause running ---
    let highSpeedCount = state.highSpeedCount;
    let speedAnomalyDetected = state.speedAnomalyDetected;
    if (!speedAnomalyDetected && distance > SPEED_ANOMALY_MIN_DISTANCE_M) {
      if (event.speed > SPEED_ANOMALY_THRESHOLD_MS) {
        highSpeedCount += 1;
        if (highSpeedCount >= SPEED_ANOMALY_CONSECUTIVE) {
          speedAnomalyDetected = true;
          // Pause running instead of just flagging — freeze timer and stop accumulation
          isAutoPaused = true;
          elapsedBeforePause = state.durationSeconds;
          startTime = null;
        }
      } else {
        highSpeedCount = 0;
      }
    }

    set({
      currentLocation: event,
      distanceMeters: distance,
      currentSpeedMs: event.speed,
      currentPaceSecondsPerKm: currentPace,
      avgPaceSecondsPerKm: avgPace,
      // Bump version counters — subscribers use getRoutePoints() to read
      routePointsVersion: state.routePointsVersion + 1,
      filteredLocationsVersion: state.filteredLocationsVersion + 1,
      routePoints: _routePoints,
      filteredLocations: _filteredLocations,
      calories: caloriesBurned,
      cadence: event.cadence ?? state.cadence,
      distanceSource: event.distanceSource ?? 'gps',
      elevationGainMeters: event.elevationGain ?? state.elevationGainMeters,
      elevationLossMeters: event.elevationLoss ?? state.elevationLossMeters,
      startPoint,
      distanceToStart,
      isApproachingStart,
      isNearStart,
      loopDetected,
      loopDetectedAt,
      lapCount,
      highSpeedCount,
      speedAnomalyDetected,
      // Auto-pause timer state
      isAutoPaused,
      startTime,
      elapsedBeforePause,
      // Auto-set GPS locked when we receive a location update
      ...(state.gpsStatus !== 'locked' ? { gpsStatus: 'locked' as const } : {}),
    });
  },

  updateGPSStatus: (status, accuracy) => {
    set({ gpsStatus: status, ...(accuracy !== undefined ? { gpsAccuracy: accuracy ?? null } : {}) });
  },

  addDeviationPoint: (index, deviation) => {
    const OFF_THRESHOLD = 30;
    const log = get().deviationLog;
    const isOff = deviation > OFF_THRESHOLD;
    const lastEntry = log.length > 0 ? log[log.length - 1] : null;
    const wasOff = lastEntry ? lastEntry.deviation > OFF_THRESHOLD : false;

    // RLE: only store state transitions (on↔off) or every 10th point
    if (isOff !== wasOff || index % 10 === 0) {
      set((state) => {
        const log = state.deviationLog.concat({ index, deviation });
        return { deviationLog: log.length > 5000 ? log.slice(-4000) : log };
      });
    }
  },

  updateDuration: (seconds) => {
    set({ durationSeconds: seconds });
  },

  pause: () => {
    const state = get();
    if (state.phase !== 'running' || state.isPaused) return;

    // Record pause timestamp and freeze timer atomically
    const now = new Date().toISOString();
    set({
      isPaused: true,
      phase: 'paused',
      elapsedBeforePause: state.durationSeconds,
      startTime: null,
      // Start a new pause interval (resumed_at will be filled on resume)
      pauseIntervals: [...state.pauseIntervals, { paused_at: now, resumed_at: '' }],
    });
  },

  resume: () => {
    const state = get();
    if (state.phase !== 'paused') return;

    // Finalize the last pause interval with the resume timestamp
    const now = new Date().toISOString();
    const pauseIntervals = [...state.pauseIntervals];
    if (pauseIntervals.length > 0) {
      const last = pauseIntervals[pauseIntervals.length - 1];
      pauseIntervals[pauseIntervals.length - 1] = { ...last, resumed_at: now };
    }

    set({
      isPaused: false,
      phase: 'running',
      pauseIntervals,
      startTime: Date.now(),
    });
  },

  complete: () => {
    const state = get();
    const stopLoc = state.currentLocation
      ? { latitude: state.currentLocation.latitude, longitude: state.currentLocation.longitude }
      : state.routePoints.length > 0
        ? state.routePoints[state.routePoints.length - 1]
        : null;

    // Finalize any open pause interval (user stopped while paused)
    const pauseIntervals = [...state.pauseIntervals];
    if (pauseIntervals.length > 0) {
      const last = pauseIntervals[pauseIntervals.length - 1];
      if (!last.resumed_at) {
        pauseIntervals[pauseIntervals.length - 1] = { ...last, resumed_at: new Date().toISOString() };
      }
    }

    set({ phase: 'completed', isPaused: false, stopLocation: stopLoc, pauseIntervals });
  },

  reset: () => {
    // Clear mutable backing arrays
    _routePoints = [];
    _filteredLocations = [];
    set({
      sessionId: null,
      courseId: null,
      phase: 'idle',
      distanceMeters: 0,
      durationSeconds: 0,
      currentPaceSecondsPerKm: 0,
      avgPaceSecondsPerKm: 0,
      currentSpeedMs: 0,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      calories: 0,
      cadence: 0,
      gpsStatus: 'searching',
      distanceSource: 'gps',
      currentLocation: null,
      routePointsVersion: 0,
      filteredLocationsVersion: 0,
      routePoints: _routePoints,
      filteredLocations: _filteredLocations,
      splits: [],
      currentSplitDistance: 0,
      pauseIntervals: [],
      isPaused: false,
      heartRate: 0,
      watchConnected: false,
      chunkSequence: 0,
      lastChunkTimestamp: 0,
      lastChunkDistance: 0,
      lastChunkPointIndex: 0,
      uploadedChunkSequences: [],
      startPoint: null,
      distanceToStart: 0,
      isApproachingStart: false,
      isNearStart: false,
      loopDetected: false,
      loopDetectedAt: null,
      lapCount: 0,
      checkpointPasses: [],
      nativeCourseProgress: null,
      nativeCheckpointPasses: [],
      nativeCourseFinished: false,
      stopLocation: null,
      startTime: null,
      elapsedBeforePause: 0,
      isAutoPaused: false,
      speedAnomalyDetected: false,
      highSpeedCount: 0,
      runGoal: { type: null, value: null, targetTime: null, cadenceBPM: null },
      intervalSegments: [],
      gpsAccuracy: null,
      snappedRoutePoints: [],
      deviationLog: [],
    });
  },

  addSplit: (split) => {
    set((state) => ({
      splits: [...state.splits, split],
      currentSplitDistance: 0,
    }));
  },

  incrementChunkSequence: () => {
    set((state) => ({
      chunkSequence: state.chunkSequence + 1,
      lastChunkTimestamp: Date.now(),
    }));
  },

  decrementChunkSequence: () => {
    set((state) => ({
      chunkSequence: Math.max(0, state.chunkSequence - 1),
    }));
  },

  markChunkUploaded: (sequence, pointCount, distance) => {
    // Trim the mutable backing array — remove the first `pointCount` points that were uploaded
    _filteredLocations = _filteredLocations.slice(pointCount);
    set((state) => ({
      uploadedChunkSequences: state.uploadedChunkSequences.concat(sequence),
      filteredLocations: _filteredLocations,
      filteredLocationsVersion: state.filteredLocationsVersion + 1,
      lastChunkPointIndex: 0,
      lastChunkDistance: distance,
      lastChunkTimestamp: Date.now(),
    }));
  },

  setPhase: (phase) => {
    set({ phase });
  },

  updateHeartRate: (bpm) => {
    set({ heartRate: bpm });
  },

  setWatchConnected: (connected) => {
    set({ watchConnected: connected });
  },

  setCheckpointPasses: (passes) => {
    set({ checkpointPasses: passes });
  },

  setNativeCourseProgress: (progress) => {
    set({ nativeCourseProgress: progress });
  },

  addNativeCheckpointPass: (pass) => {
    set((state) => ({
      nativeCheckpointPasses: [...state.nativeCheckpointPasses, pass],
    }));
  },

  setNativeCourseFinished: (finished) => {
    set({ nativeCourseFinished: finished });
  },

  setAutoPaused: (paused) => {
    const state = get();
    if (paused && !state.isAutoPaused) {
      set({
        isAutoPaused: true,
        elapsedBeforePause: state.durationSeconds,
        startTime: null,
      });
    } else if (!paused && state.isAutoPaused) {
      set({
        isAutoPaused: false,
        startTime: Date.now(),
      });
    }
  },

  setRunGoal: (goal) => set({ runGoal: goal }),

  addIntervalSegment: (segment) => {
    set((state) => ({
      intervalSegments: [...state.intervalSegments, segment],
    }));
  },

  addSnappedPoint: (coord) => {
    set((state) => {
      const pts = state.snappedRoutePoints.concat(coord);
      return { snappedRoutePoints: pts.length > 10000 ? pts.slice(-8000) : pts };
    });
  },

  setSnappedRoute: (points) => {
    set({ snappedRoutePoints: points.length > 10000 ? points.slice(-8000) : points });
  },

  restoreSession: (data) => {
    // Restore mutable backing arrays
    _routePoints = data.routePoints;
    _filteredLocations = data.filteredLocations;
    set({
      sessionId: data.sessionId,
      courseId: data.courseId,
      phase: data.phase,
      startTime: data.startTime,
      elapsedBeforePause: data.elapsedBeforePause,
      durationSeconds: data.durationSeconds,
      isPaused: data.isPaused,
      isAutoPaused: data.isAutoPaused,
      distanceMeters: data.distanceMeters,
      currentPaceSecondsPerKm: data.currentPaceSecondsPerKm,
      avgPaceSecondsPerKm: data.avgPaceSecondsPerKm,
      elevationGainMeters: data.elevationGainMeters,
      elevationLossMeters: data.elevationLossMeters,
      calories: data.calories,
      filteredLocations: _filteredLocations,
      filteredLocationsVersion: 1,
      routePoints: _routePoints,
      routePointsVersion: 1,
      splits: data.splits,
      pauseIntervals: data.pauseIntervals,
      chunkSequence: data.chunkSequence,
      lastChunkDistance: data.lastChunkDistance,
      lastChunkTimestamp: data.lastChunkTimestamp,
      lastChunkPointIndex: data.lastChunkPointIndex,
      uploadedChunkSequences: data.uploadedChunkSequences,
      snappedRoutePoints: data.snappedRoutePoints,
      deviationLog: data.deviationLog,
      startPoint: data.startPoint,
      runGoal: data.runGoal,
      gpsStatus: 'searching',
      gpsAccuracy: null,
      currentLocation: null,
      heartRate: 0,
      watchConnected: false,
      currentSpeedMs: 0,
      cadence: 0,
      currentSplitDistance: 0,
      stopLocation: null,
      distanceToStart: 0,
      isApproachingStart: false,
      isNearStart: false,
      loopDetected: false,
      loopDetectedAt: null,
      lapCount: 0,
      checkpointPasses: [],
      nativeCourseProgress: null,
      nativeCheckpointPasses: [],
      nativeCourseFinished: false,
    });
  },
}));
