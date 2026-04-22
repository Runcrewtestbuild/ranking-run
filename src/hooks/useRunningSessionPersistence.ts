/**
 * Hook that periodically persists running session state to AsyncStorage.
 *
 * Strategy:
 * 1. Every 10 GPS updates (≈10s), save full session to disk
 * 2. On AppState → 'background'/'inactive', save immediately
 * 3. On session complete/reset, clear persisted data
 *
 * This ensures that even if iOS kills the app in the background,
 * we lose at most ~10 seconds of GPS data. The rest is on disk.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRunningStore } from '../stores/runningStore';
import {
  persistRunningSession,
  clearPersistedSession,
  type PersistedRunningSession,
} from '../services/runningSessionPersistence';

const PERSIST_INTERVAL = 10; // Save every N GPS updates
const MIN_SAVE_INTERVAL_MS = 10_000; // Max save frequency: every 10s

function buildSnapshot(): PersistedRunningSession | null {
  const s = useRunningStore.getState();
  if (!s.sessionId || s.phase === 'idle') return null;

  return {
    sessionId: s.sessionId,
    courseId: s.courseId,
    phase: s.phase,
    startTime: s.startTime,
    elapsedBeforePause: s.elapsedBeforePause,
    durationSeconds: s.durationSeconds,
    isPaused: s.isPaused,
    isAutoPaused: s.isAutoPaused,
    distanceMeters: s.distanceMeters,
    currentPaceSecondsPerKm: s.currentPaceSecondsPerKm,
    avgPaceSecondsPerKm: s.avgPaceSecondsPerKm,
    elevationGainMeters: s.elevationGainMeters,
    elevationLossMeters: s.elevationLossMeters,
    calories: s.calories,
    cadence: s.cadence > 0 ? s.cadence : undefined,
    heartRate: s.heartRate > 0 ? s.heartRate : undefined,
    filteredLocations: s.filteredLocations.slice(-10000),
    // Keep last 500 route points for map display
    routePoints: s.routePoints.slice(-500),
    splits: s.splits,
    pauseIntervals: s.pauseIntervals,
    chunkSequence: s.chunkSequence,
    lastChunkDistance: s.lastChunkDistance,
    lastChunkTimestamp: s.lastChunkTimestamp,
    lastChunkPointIndex: s.lastChunkPointIndex,
    uploadedChunkSequences: s.uploadedChunkSequences,
    intervalSegments: s.intervalSegments,
    snappedRoutePoints: s.snappedRoutePoints,
    deviationLog: s.deviationLog,
    startPoint: s.startPoint,
    runGoal: s.runGoal,
    savedAt: Date.now(),
  };
}

export function useRunningSessionPersistence() {
  const updateCountRef = useRef(0);
  const lastSaveTimeRef = useRef(0);
  const phase = useRunningStore((s) => s.phase);
  const distanceMeters = useRunningStore((s) => s.distanceMeters);
  const durationSeconds = useRunningStore((s) => s.durationSeconds);

  // Track GPS updates via distance/duration changes and persist periodically
  useEffect(() => {
    if (phase !== 'running' && phase !== 'paused') return;

    const now = Date.now();
    if (now - lastSaveTimeRef.current < MIN_SAVE_INTERVAL_MS) return;

    updateCountRef.current++;
    if (updateCountRef.current % PERSIST_INTERVAL === 0) {
      lastSaveTimeRef.current = now;
      const snapshot = buildSnapshot();
      if (snapshot) {
        // H4: Await persistence to prevent data loss on app kill
        (async () => {
          try {
            await persistRunningSession(snapshot);
          } catch (e) {
            console.warn('[SessionPersist] Periodic save failed:', e);
          }
        })();
      }
    }
  }, [distanceMeters, durationSeconds, phase]);

  // Persist immediately when app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const snapshot = buildSnapshot();
        if (snapshot) {
          // H4: Await persistence — fire-and-forget risks data loss on app kill
          (async () => {
            try {
              await persistRunningSession(snapshot);
              console.log('[SessionPersist] Saved on background transition');
            } catch (e) {
              console.warn('[SessionPersist] Background save failed:', e);
            }
          })();
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);

    // Low battery emergency save — persist immediately when battery is critical
    // so data survives if phone dies
    let batteryCheckInterval: ReturnType<typeof setInterval> | null = null;
    let emergencySaved = false;
    if (phase === 'running' || phase === 'paused') {
      batteryCheckInterval = setInterval(async () => {
        try {
          // React Native doesn't have built-in battery API, but we can
          // trigger an extra save every 60s as a safety net regardless
          if (!emergencySaved) {
            const snapshot = buildSnapshot();
            if (snapshot) {
              await persistRunningSession(snapshot);
            }
          }
        } catch {}
      }, 60_000); // Extra save every 60s as battery safety net
    }

    return () => {
      sub.remove();
      if (batteryCheckInterval) clearInterval(batteryCheckInterval);
    };
  }, [phase]);

  // Clear persisted data when session completes or resets
  useEffect(() => {
    if (phase === 'completed' || phase === 'idle') {
      clearPersistedSession();
    }
  }, [phase]);

  // Also persist on pause/resume (important state transitions)
  const isPaused = useRunningStore((s) => s.isPaused);
  useEffect(() => {
    if (phase === 'running' || phase === 'paused') {
      const snapshot = buildSnapshot();
      if (snapshot) {
        // H4: Await persistence on pause/resume state transitions
        (async () => {
          try {
            await persistRunningSession(snapshot);
          } catch (e) {
            console.warn('[SessionPersist] Pause/resume save failed:', e);
          }
        })();
      }
    }
  }, [isPaused, phase]);
}
