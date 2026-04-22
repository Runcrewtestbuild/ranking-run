// ============================================================
// Interval Segment Tracker Hook
// Captures per-segment stats (distance, duration, avg pace)
// when interval phases transition (run -> walk, walk -> run,
// or final phase completion).
// ============================================================

import { useEffect, useRef } from 'react';
import { useRunningStore, type IntervalSegment } from '../stores/runningStore';
import type { IntervalState } from './useIntervalTraining';

interface UseIntervalSegmentTrackerParams {
  intervalState: IntervalState | null;
  isRunning: boolean; // phase === 'running'
}

/**
 * Tracks interval segment statistics by detecting phase transitions
 * from the interval state machine. When a phase ends (run->walk or
 * walk->run), it calculates the segment's distance, duration, and
 * average pace, then stores it in the running store.
 */
export function useIntervalSegmentTracker({
  intervalState,
  isRunning,
}: UseIntervalSegmentTrackerParams): void {
  const addIntervalSegment = useRunningStore((s) => s.addIntervalSegment);

  // Snapshot distance and duration at the start of each phase
  const phaseStartRef = useRef<{
    phase: 'run' | 'walk';
    set: number;
    distanceMeters: number;
    durationSeconds: number;
  } | null>(null);

  // Track previous interval state to detect transitions
  const prevPhaseRef = useRef<'run' | 'walk' | null>(null);
  const prevSetRef = useRef<number>(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!intervalState || !isRunning) return;

    const { currentPhase, currentSet, isCompleted } = intervalState;
    const store = useRunningStore.getState();

    // Detect phase transition: phase changed or set changed
    const phaseChanged = prevPhaseRef.current !== null && (
      currentPhase !== prevPhaseRef.current ||
      currentSet !== prevSetRef.current
    );

    // Finalize the previous segment on transition
    if (phaseChanged && phaseStartRef.current) {
      const prev = phaseStartRef.current;
      const segDistance = Math.max(0, store.distanceMeters - prev.distanceMeters);
      const segDuration = Math.max(0, store.durationSeconds - prev.durationSeconds);
      const avgPace = segDistance > 0 && segDuration > 0
        ? (segDuration / segDistance) * 1000
        : 0;

      const segment: IntervalSegment = {
        set: prev.set,
        phase: prev.phase,
        distanceMeters: segDistance,
        durationSeconds: segDuration,
        avgPaceSecondsPerKm: Math.round(avgPace),
      };
      addIntervalSegment(segment);
    }

    // Start new phase snapshot (on first entry or after transition)
    if (prevPhaseRef.current === null || phaseChanged) {
      phaseStartRef.current = {
        phase: currentPhase,
        set: currentSet,
        distanceMeters: store.distanceMeters,
        durationSeconds: store.durationSeconds,
      };
    }

    // Handle completion: finalize the last segment
    if (isCompleted && !completedRef.current && phaseStartRef.current) {
      completedRef.current = true;
      const prev = phaseStartRef.current;
      const segDistance = Math.max(0, store.distanceMeters - prev.distanceMeters);
      const segDuration = Math.max(0, store.durationSeconds - prev.durationSeconds);

      // Only record meaningful segments — avoid phantom zero-length segments
      // when completion coincides with a phase transition
      if (segDistance > 10 || segDuration > 5) {
        const avgPace = segDistance > 0 && segDuration > 0
          ? (segDuration / segDistance) * 1000
          : 0;

        const segment: IntervalSegment = {
          set: prev.set,
          phase: prev.phase,
          distanceMeters: segDistance,
          durationSeconds: segDuration,
          avgPaceSecondsPerKm: Math.round(avgPace),
        };
        addIntervalSegment(segment);
      }
      phaseStartRef.current = null;
    }

    prevPhaseRef.current = currentPhase;
    prevSetRef.current = currentSet;
  }, [intervalState, isRunning, addIntervalSegment]);

  // Reset refs when interval is disabled (run ended/reset)
  useEffect(() => {
    if (!intervalState) {
      prevPhaseRef.current = null;
      prevSetRef.current = 0;
      completedRef.current = false;
      phaseStartRef.current = null;
    }
  }, [intervalState]);
}
