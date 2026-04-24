import { useEffect, useRef, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import { useRunningStore } from '../stores/runningStore';

const { LiveActivityModule } = NativeModules;

/**
 * Manages iOS Live Activity (Lock Screen + Dynamic Island) during a run.
 *
 * - Starts when phase becomes 'running'
 * - Updates are handled natively by LocationEngine at 1Hz (no JS timer needed)
 * - Ends when run completes or resets
 *
 * iOS 16.2+ only; no-op on Android or older iOS.
 */
export function useLiveActivity() {
  const [activityId, setActivityId] = useState<string | null>(null);
  const activityIdRef = useRef<string | null>(null);

  const phase = useRunningStore((s) => s.phase);

  // Start Live Activity when entering 'running' phase
  useEffect(() => {
    if (Platform.OS !== 'ios' || !LiveActivityModule) return;
    if (phase !== 'running' && phase !== 'paused') return;

    // Already active
    if (activityId) return;

    const startActivity = async () => {
      try {
        const state = useRunningStore.getState();
        const id = await LiveActivityModule.startActivity({
          courseName: '',
          isCourseRun: !!state.courseId,
          durationSeconds: state.durationSeconds,
        });
        activityIdRef.current = id;
        setActivityId(id);
        console.log('[LiveActivity] Started:', id);
      } catch (error) {
        // Live Activity not available — silently continue
        console.log('[LiveActivity] Start failed:', error);
      }
    };

    startActivity();
  }, [phase, activityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Native LocationEngine now handles Live Activity updates at 1Hz.
  // No JS timer needed — updates continue even when JS is suspended in background.

  // End Live Activity when run completes or resets
  useEffect(() => {
    if (Platform.OS !== 'ios' || !LiveActivityModule) return;
    if (phase !== 'completed' && phase !== 'idle') return;
    if (!activityId) return;

    const endActivity = async () => {
      try {
        const state = useRunningStore.getState();
        await LiveActivityModule.endActivity({
          distanceMeters: state.distanceMeters,
          durationSeconds: state.durationSeconds,
          currentPace: state.currentPaceSecondsPerKm,
          avgPace: state.avgPaceSecondsPerKm,
          calories: state.calories,
          heartRate: state.heartRate,
          cadence: state.cadence,
        });
        console.log('[LiveActivity] Ended');
      } catch {
        // Ignore errors
      }
      activityIdRef.current = null;
      setActivityId(null);
    };

    endActivity();
  }, [phase, activityId]);

  // Cleanup on unmount — end activity if still running
  useEffect(() => {
    return () => {
      if (LiveActivityModule && activityIdRef.current) {
        const state = useRunningStore.getState();
        LiveActivityModule.endActivity({
          distanceMeters: state.distanceMeters,
          durationSeconds: state.durationSeconds,
          currentPace: state.currentPaceSecondsPerKm,
          avgPace: state.avgPaceSecondsPerKm,
          calories: state.calories,
          heartRate: state.heartRate,
          cadence: state.cadence,
        }).catch((err: any) => {
          console.warn('[useLiveActivity] 라이브 액티비티 종료 실패:', err);
        });
      }
    };
  }, []);
}
