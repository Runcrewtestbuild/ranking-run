// ============================================================
// GPS Module Type Definitions
// Matches the shared-interfaces.md for Native Module integration
// ============================================================

// ---- GPS Tracker Module (JS -> Native) ----

export interface SmoothedRouteResult {
  route: FilteredLocation[];
  distance: number;
}

export interface GPSTrackerModule {
  startTracking(): Promise<void>;
  stopTracking(): Promise<void>;
  pauseTracking(): Promise<void>;
  resumeTracking(): Promise<void>;
  getRawGPSPoints(): Promise<RawGPSPoint[]>;
  getFilteredRoute(): Promise<FilteredLocation[]>;
  getSmoothedRoute(): Promise<SmoothedRouteResult>;
  getCurrentStatus(): Promise<GPSStatus>;
  setCourseRoute(data: {
    route: Array<{ latitude: number; longitude: number }>;
    checkpoints: Array<{ latitude: number; longitude: number; order: number }>;
  }): Promise<void>;
}

// ---- Native -> JS Events ----

export interface LocationUpdateEvent {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  bearing: number;
  accuracy: number;
  timestamp: number;
  distanceFromStart: number;
  isMoving: boolean;
  cadence?: number; // steps per minute
  elevationGain?: number; // cumulative meters (barometer)
  elevationLoss?: number; // cumulative meters (barometer)
  distanceSource?: 'gps' | 'pedometer'; // source of distance measurement
}

export interface GPSStatusChangeEvent {
  status: GPSStatus;
  accuracy: number | null;
  satelliteCount: number;
}

export interface RunningStateChangeEvent {
  state: 'moving' | 'stationary';
  duration: number;
}

// ---- Data Models ----

export interface RawGPSPoint {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  bearing: number;
  horizontalAccuracy: number;
  verticalAccuracy: number;
  speedAccuracy: number;
  timestamp: number;
  provider: 'gps' | 'fused' | 'network';
}

export interface FilteredLocation {
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  bearing: number;
  timestamp: number;
  distanceFromPrevious: number;
  cumulativeDistance: number;
  isInterpolated: boolean;
  cadence?: number;
  heartRate?: number;
}

export type GPSStatus = 'searching' | 'locked' | 'lost' | 'disabled';

// ---- Error Codes ----

export enum GPSErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  GPS_DISABLED = 'GPS_DISABLED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  COLD_START_TIMEOUT = 'COLD_START_TIMEOUT',
  BACKGROUND_RESTRICTED = 'BACKGROUND_RESTRICTED',
}

// ---- Event Names ----

export const GPS_EVENTS = {
  SUMMARY: 'GPSTracker_onSummary',
  /** @deprecated Use SUMMARY instead — kept for backward compatibility */
  LOCATION_UPDATE: 'GPSTracker_onLocationUpdate',
  GPS_STATUS_CHANGE: 'GPSTracker_onGPSStatusChange',
  RUNNING_STATE_CHANGE: 'GPSTracker_onRunningStateChange',
  MILESTONE_REACHED: 'GPSTracker_onMilestoneReached',
  COURSE_DEVIATION: 'GPSTracker_onCourseDeviation',
  CHECKPOINT_PASSED: 'GPSTracker_onCheckpointPassed',
  COURSE_FINISHED: 'GPSTracker_onCourseFinished',
} as const;

export interface MilestoneReachedEvent {
  km: number;
  splitPaceSecondsPerKm: number;
  totalTimeSeconds: number;
}

/** Course deviation event — emitted on each GPS update when a course is set. */
export interface CourseDeviationEvent {
  deviationMeters: number;
  isOffCourse: boolean;
  progressPercent: number;
  remainingMeters: number;
}

/** Checkpoint passed event — emitted when runner enters 30m radius of a checkpoint. */
export interface CheckpointPassedEvent {
  order: number;
  elapsedSeconds: number;
}

/** Native summary event — emitted at 1Hz with all running metrics pre-computed natively. */
export interface SummaryUpdateEvent {
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecondsPerKm: number;
  currentPaceSecondsPerKm: number;
  calories: number;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  bearing: number;
  gpsAccuracy: number;
  isMoving: boolean;
  isPaused: boolean;
  cadence: number;
}
