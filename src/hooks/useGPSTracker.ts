import { useEffect, useRef, useCallback } from 'react';
import { NativeModules, NativeEventEmitter, AppState } from 'react-native';
import { useRunningStore } from '../stores/runningStore';
import type {
  LocationUpdateEvent,
  GPSStatusChangeEvent,
  MilestoneReachedEvent,
} from '../types/gps';
import { GPS_EVENTS } from '../types/gps';

const { GPSTrackerModule } = NativeModules;

/**
 * Hook to interact with the native GPS tracking module.
 * Subscribes to location updates and GPS status changes,
 * forwarding them to the running store.
 *
 * The actual native module is implemented by the Android/iOS GPS agents.
 * This hook only handles the JS-side bridge.
 */
/** Heartbeat interval: if no GPS updates received for this duration while running, attempt restart */
const GPS_HEARTBEAT_TIMEOUT_MS = 30_000;

export function useGPSTracker() {
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const gpsLockedRef = useRef(false);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use individual selectors for stable references (Zustand returns the same
  // function object across renders when selected individually, preventing
  // the useEffect from re-subscribing on every store update).
  const phase = useRunningStore(s => s.phase);
  const updateLocation = useRunningStore(s => s.updateLocation);
  const updateGPSStatus = useRunningStore(s => s.updateGPSStatus);
  const addSplit = useRunningStore(s => s.addSplit);
  const setAutoPaused = useRunningStore(s => s.setAutoPaused);

  const startTracking = useCallback(async () => {
    if (!GPSTrackerModule) {
      console.warn('[GPS] Native GPSTrackerModule not available');
      return;
    }
    try {
      await GPSTrackerModule.startTracking();
    } catch (error) {
      console.error('[GPS] Failed to start tracking:', error);
      throw error;
    }
  }, []);

  const stopTracking = useCallback(async () => {
    if (!GPSTrackerModule) return;
    try {
      await GPSTrackerModule.stopTracking();
    } catch (error) {
      console.error('[GPS] Failed to stop tracking:', error);
    }
  }, []);

  const pauseTracking = useCallback(async () => {
    if (!GPSTrackerModule) return;
    try {
      await GPSTrackerModule.pauseTracking();
    } catch (error) {
      console.error('[GPS] Failed to pause tracking:', error);
    }
  }, []);

  const resumeTracking = useCallback(async () => {
    if (!GPSTrackerModule) return;
    try {
      await GPSTrackerModule.resumeTracking();
    } catch (error) {
      console.error('[GPS] Failed to resume tracking:', error);
    }
  }, []);

  // Subscribe to native events when the running phase is active
  useEffect(() => {
    if (!GPSTrackerModule) return;
    if (phase !== 'running' && phase !== 'paused' && phase !== 'countdown') return;

    const emitter = new NativeEventEmitter(GPSTrackerModule);

    // Throttle location updates to prevent OOM on foreground resume.
    // When app returns from background, the JS bridge flushes ALL queued native
    // events SYNCHRONOUSLY in a tight loop. Time-based throttle doesn't work
    // because Date.now() barely changes during synchronous flush.
    // Solution: count-based skip — only process every Nth event during burst,
    // plus always process the LAST event via a microtask.
    let eventCount = 0;
    let lastEvent: LocationUpdateEvent | null = null;
    let flushScheduled = false;

    const processEvent = (event: LocationUpdateEvent) => {
      lastUpdateTimeRef.current = Date.now();
      updateLocation(event);
    };

    const locationSub = emitter.addListener(
      GPS_EVENTS.LOCATION_UPDATE,
      (event: LocationUpdateEvent) => {
        eventCount++;
        lastEvent = event;

        // During normal 1Hz GPS: eventCount resets via the flush below,
        // so every event is processed (count % 1 === 0 after reset).
        // During burst flush (1000+ events in <100ms): only every 50th
        // event is processed synchronously, preventing OOM.
        // The final event is ALWAYS processed via the scheduled flush.
        if (eventCount <= 3 || eventCount % 50 === 0) {
          processEvent(event);
        }

        // Schedule a microtask to process the very last event after
        // the synchronous flush loop completes. This ensures we never
        // miss the final (most recent) GPS position.
        if (!flushScheduled) {
          flushScheduled = true;
          Promise.resolve().then(() => {
            if (lastEvent) {
              processEvent(lastEvent);
              lastEvent = null;
            }
            eventCount = 0;
            flushScheduled = false;
          });
        }
      },
    );

    const statusSub = emitter.addListener(
      GPS_EVENTS.GPS_STATUS_CHANGE,
      (event: GPSStatusChangeEvent) => {
        updateGPSStatus(event.status, event.accuracy);
      },
    );

    const milestoneSub = emitter.addListener(
      GPS_EVENTS.MILESTONE_REACHED,
      (event: MilestoneReachedEvent) => {
        addSplit({
          split_number: event.km,
          distance_meters: 1000,
          duration_seconds: event.splitPaceSecondsPerKm,
          pace_seconds_per_km: event.splitPaceSecondsPerKm,
          elevation_change_meters: 0,
        });
      },
    );

    // Listen for native stationary/moving state changes.
    // This is critical for auto-pause resume: when the native StationaryDetector
    // transitions to "moving", we must immediately clear auto-pause even if
    // the next location update hasn't arrived yet (GPS may be slow to deliver
    // updates after BatteryOptimizer restores accuracy).
    const runningStateSub = emitter.addListener(
      GPS_EVENTS.RUNNING_STATE_CHANGE,
      (event: { state: string; duration: number }) => {
        if (event.state === 'moving') {
          const store = useRunningStore.getState();
          if (store.isAutoPaused) {
            setAutoPaused(false);
          }
        }
      },
    );

    subscriptionsRef.current = [locationSub, statusSub, milestoneSub, runningStateSub];

    // Fetch current GPS status in case we missed the initial event
    gpsLockedRef.current = false;
    const pollStatus = () => {
      if (gpsLockedRef.current) return; // Stop polling once locked
      GPSTrackerModule.getCurrentStatus()
        .then((status: string) => {
          if (status === 'locked' || status === 'searching' || status === 'lost' || status === 'disabled') {
            updateGPSStatus(status as any);
            if (status === 'locked') {
              gpsLockedRef.current = true;
            }
          }
        })
        .catch((err: any) => {
          console.warn('[useGPSTracker] GPS 상태 조회 실패:', err);
        });
    };

    // Initial check + poll every 3 seconds until locked
    pollStatus();
    const pollIntervalRef = { id: setInterval(() => {
      if (gpsLockedRef.current) {
        // GPS locked — stop polling to save CPU
        clearInterval(pollIntervalRef.id);
        return;
      }
      pollStatus();
    }, 3000) };

    // Heartbeat: if no GPS updates for 30s while in 'running' phase, restart tracking
    // Clear any existing heartbeat interval to prevent accumulation on re-subscribe
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    lastUpdateTimeRef.current = Date.now();
    const runHeartbeatCheck = () => {
      const currentPhase = useRunningStore.getState().phase;
      if (currentPhase !== 'running') return;
      const elapsed = Date.now() - lastUpdateTimeRef.current;
      if (elapsed > GPS_HEARTBEAT_TIMEOUT_MS) {
        console.warn(`[useGPSTracker] No GPS update for ${Math.round(elapsed / 1000)}s, attempting restart`);
        GPSTrackerModule.restartTracking()
          .then(() => {
            lastUpdateTimeRef.current = Date.now();
            console.log('[useGPSTracker] GPS tracking restarted via heartbeat (state preserved)');
          })
          .catch((err: any) => {
            console.error('[useGPSTracker] Heartbeat restart failed:', err);
          });
      }
    };
    heartbeatIntervalRef.current = setInterval(runHeartbeatCheck, 10_000);

    // AppState listener: when returning to foreground, immediately run heartbeat
    // check (setInterval may have been suspended while backgrounded) and force
    // a getCurrentPosition call to sync the latest location state rather than
    // waiting for queued NativeEventEmitter events to process.
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        runHeartbeatCheck();
        // Sync auto-pause state after returning from background
        // JS may have missed native "moving" events while suspended
        const store = useRunningStore.getState();
        if (store.phase === 'running' && store.isAutoPaused) {
          // Check current speed — if moving, release auto-pause
          // Use currentLocation (latest event from native) instead of
          // filteredLocations (chunk upload data that may be stale)
          const curLoc = store.currentLocation;
          if (curLoc && curLoc.speed > 0.5) {
            store.setAutoPaused(false);
          }
        }
      }
    });

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.remove());
      subscriptionsRef.current = [];
      clearInterval(pollIntervalRef.id);
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      appStateSubscription.remove();
    };
  }, [phase, updateLocation, updateGPSStatus, addSplit, setAutoPaused]);

  return {
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking,
    isAvailable: !!GPSTrackerModule,
  };
}
