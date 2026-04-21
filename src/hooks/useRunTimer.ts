import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRunningStore } from '../stores/runningStore';

/**
 * Hook that manages the running timer.
 * Uses Date.now()-based elapsed calculation so background suspension
 * doesn't cause drift — when the app resumes, the timer instantly
 * catches up to the correct value.
 *
 * Also listens to AppState changes to force an immediate recalc
 * when the app returns to foreground (covers the scenario where
 * setInterval callbacks were suspended by iOS).
 */
export function useRunTimer() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const phase = useRunningStore((s) => s.phase);
  const isPaused = useRunningStore((s) => s.isPaused);
  const isAutoPaused = useRunningStore((s) => s.isAutoPaused);
  const startTime = useRunningStore((s) => s.startTime);

  const isRunning = phase === 'running' && !isPaused && !isAutoPaused && !!startTime;

  // Recalculate elapsed time from absolute timestamps
  const recalcDuration = () => {
    const st = useRunningStore.getState();
    if (st.phase === 'running' && !st.isPaused && !st.isAutoPaused && st.startTime) {
      const now = Date.now();
      const elapsed = (now - st.startTime) / 1000 + st.elapsedBeforePause;
      st.updateDuration(Math.floor(elapsed));
    }
  };

  // Main interval — ticks every second
  useEffect(() => {
    if (isRunning) {
      // Immediately recalc on mount/resume (catches background gap)
      recalcDuration();
      intervalRef.current = setInterval(recalcDuration, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // AppState listener — force recalc when returning from background.
  // Small delay to let the JS bridge flush queued native events first,
  // so the UI updates smoothly instead of showing a stale value then jumping.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        // Immediate recalc for accurate value
        recalcDuration();
        // Second recalc after 500ms — after queued events are processed,
        // ensures the displayed value is consistent with GPS state
        setTimeout(recalcDuration, 500);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
}
