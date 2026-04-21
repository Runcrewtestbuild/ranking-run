import { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { useRunningStore } from '../stores/runningStore';
import type {
  WatchHeartRateEvent,
  WatchCommandEvent,
  WatchReachabilityEvent,
} from '../types/watch';
import { WATCH_EVENTS } from '../types/watch';
import type { CourseNavigation } from './useCourseNavigation';
import type { IntervalState } from './useIntervalTraining';

const { WatchBridgeModule } = NativeModules;

/**
 * Hook to interact with the Apple Watch companion.
 * Subscribes to heart rate updates and Watch commands,
 * and pushes run state to the Watch.
 *
 * iOS-only; no-op on Android.
 */
export function useWatchCompanion(
  callbacks?: {
    onPauseCommand?: () => void;
    onResumeCommand?: () => void;
    onStopCommand?: () => void;
  },
  navigation?: CourseNavigation | null,
  checkpointData?: {
    passedCount: number;
    totalCount: number;
    justPassed: boolean;
  },
  intervalState?: IntervalState | null,
) {
  const subscriptionsRef = useRef<Array<{ remove: () => void }>>([]);
  const phase = useRunningStore((s) => s.phase);
  const distanceMeters = useRunningStore((s) => s.distanceMeters);
  const durationSeconds = useRunningStore((s) => s.durationSeconds);
  const startTime = useRunningStore((s) => s.startTime);
  const elapsedBeforePause = useRunningStore((s) => s.elapsedBeforePause);
  const currentPaceSecondsPerKm = useRunningStore((s) => s.currentPaceSecondsPerKm);
  const avgPaceSecondsPerKm = useRunningStore((s) => s.avgPaceSecondsPerKm);
  const gpsStatus = useRunningStore((s) => s.gpsStatus);
  const calories = useRunningStore((s) => s.calories);
  const isAutoPaused = useRunningStore((s) => s.isAutoPaused);
  const runGoal = useRunningStore((s) => s.runGoal);
  const updateHeartRate = useRunningStore((s) => s.updateHeartRate);
  const setWatchConnected = useRunningStore((s) => s.setWatchConnected);
  // phase is still read for event subscription below, but NOT sent to watch

  // Keep callbacks ref up to date without causing re-subscriptions
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  // Keep navigation & checkpoint refs up to date without triggering the
  // push effect on every GPS update (the navigation object is new each
  // update even if direction/progress haven't meaningfully changed).
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const checkpointDataRef = useRef(checkpointData);
  checkpointDataRef.current = checkpointData;
  const intervalStateRef = useRef(intervalState);
  intervalStateRef.current = intervalState;

  // Derive stable primitives from navigation for dependency tracking.
  // Only re-push to Watch when direction, off-course status, or progress
  // milestones actually change — NOT on every GPS position update.
  const navDirection = navigation?.nextDirection ?? '';
  const navIsOffCourse = navigation?.isOffCourse ?? false;
  const navNextTurnDirection = navigation?.nextTurnDirection ?? '';
  // Quantize progress to whole-percent to avoid pushes on fractional changes
  const navProgressQuantized = navigation ? Math.floor(navigation.progressPercent) : -1;
  const cpPassed = checkpointData?.passedCount ?? 0;
  const cpJustPassed = checkpointData?.justPassed ?? false;
  const intervalPhase = intervalState?.currentPhase ?? '';
  const intervalCurrentSet = intervalState?.currentSet ?? 0;
  const intervalCompleted = intervalState?.isCompleted ?? false;

  // Quantize values to reduce WCSession push frequency.
  // Without quantization, pace/calories change every GPS tick → watch push every second.
  const quantizedDistance = Math.floor(distanceMeters / 10) * 10;
  const quantizedPace = Math.round(currentPaceSecondsPerKm / 5) * 5;
  const quantizedAvgPace = Math.round(avgPaceSecondsPerKm / 5) * 5;
  const quantizedCalories = Math.round(calories / 5) * 5;

  // Push run state to Watch when it changes (including idle for reset)
  useEffect(() => {
    if (Platform.OS !== 'ios' || !WatchBridgeModule) return;

    const nav = navigationRef.current;
    const cpData = checkpointDataRef.current;
    const intState = intervalStateRef.current;

    // Phase is sent authoritatively by GPSTrackerModule (native).
    // Do NOT send phase here — it causes duplicate phase messages
    // that conflict with HKWorkoutSession mirroring and native sends.
    WatchBridgeModule.sendRunState({
      distanceMeters,
      durationSeconds,
      // Timer sync: send startTime + elapsedBeforePause so watch can compute
      // its own smooth timer locally instead of relying on durationSeconds updates
      runStartTime: startTime ?? 0,
      elapsedBeforePause,
      currentPace: currentPaceSecondsPerKm,
      avgPace: avgPaceSecondsPerKm,
      gpsStatus,
      calories,
      isAutoPaused,
      // Countdown sync is handled natively by GPSTrackerModule.notifyCountdownStart()
      // which captures the exact start timestamp. Do NOT send countdownStartedAt here —
      // useEffect runs later than the native call, so Date.now() would be stale and
      // cause the watch countdown to desync.
      // Run goal
      goalType: runGoal.type ?? '',
      goalValue: runGoal.value ?? 0,
      // Program running (pace target) data — always send explicitly to prevent
      // carryForwardKeys from reusing stale values from a previous session
      programTargetDistance: runGoal.type === 'program' ? (runGoal.value ?? 0) : 0,
      programTargetTime: runGoal.type === 'program' ? (runGoal.targetTime ?? 0) : 0,
      programTimeDelta: runGoal.type === 'program' ? (() => {
        if (!runGoal.value || !runGoal.targetTime || distanceMeters < 200) return 0;
        const projectedFinish = (runGoal.value / distanceMeters) * durationSeconds;
        return runGoal.targetTime - projectedFinish;
      })() : 0,
      programRequiredPace: runGoal.type === 'program' && runGoal.value && runGoal.targetTime
        ? Math.round(runGoal.targetTime / (runGoal.value / 1000))
        : 0,
      programStatus: runGoal.type === 'program' ? (() => {
        if (!runGoal.value || !runGoal.targetTime || distanceMeters < 200) return '';
        const projectedFinish = (runGoal.value / distanceMeters) * durationSeconds;
        const delta = runGoal.targetTime - projectedFinish;
        if (delta > 30) return 'ahead';
        if (delta >= -30) return 'on_pace';
        if (delta >= -60) return 'behind';
        return 'critical';
      })() : '',
      metronomeBPM: runGoal.type === 'program' ? (runGoal.cadenceBPM ?? 0) : 0,
      // Course navigation data
      isCourseRun: !!nav,
      navBearing: nav?.bearingToNext ?? -1,
      navRemainingDistance: nav?.remainingDistanceMeters ?? -1,
      navDeviation: nav?.deviationMeters ?? -1,
      navDirection: nav?.nextDirection ?? '',
      navProgress: nav?.progressPercent ?? -1,
      navIsOffCourse: nav?.isOffCourse ?? false,
      // Turn-point navigation
      navNextTurnDirection: nav?.nextTurnDirection ?? '',
      navDistanceToNextTurn: nav?.distanceToNextTurn ?? -1,
      // Checkpoint progress
      cpPassed: cpData?.passedCount ?? 0,
      cpTotal: cpData?.totalCount ?? 0,
      cpJustPassed: cpData?.justPassed ?? false,
      // Interval training
      intervalPhase: intState?.currentPhase ?? '',
      intervalCurrentSet: intState?.currentSet ?? 0,
      intervalTotalSets: intState?.totalSets ?? 0,
      intervalRunSeconds: runGoal.type === 'interval' ? (runGoal.intervalRunSeconds ?? 0) : 0,
      intervalWalkSeconds: runGoal.type === 'interval' ? (runGoal.intervalWalkSeconds ?? 0) : 0,
      intervalPhaseRemaining: intState?.phaseRemainingSeconds ?? 0,
      intervalCompleted: intState?.isCompleted ?? false,
    }).catch(() => {
      // Silently ignore send failures (Watch may be unreachable)
    });
  // NOTE: durationSeconds intentionally NOT in deps — watch computes timer
  // locally from runStartTime + elapsedBeforePause. This prevents sending
  // state every second just because duration ticked, reducing WCSession traffic.
  // NOTE: navigation/checkpointData/intervalState use refs — only stable
  // derived primitives are in deps to avoid pushing on every GPS update.
  }, [quantizedDistance, quantizedPace, quantizedAvgPace, gpsStatus, quantizedCalories,
      isAutoPaused, runGoal,
      navDirection, navIsOffCourse, navNextTurnDirection, navProgressQuantized,
      cpPassed, cpJustPassed, intervalPhase, intervalCurrentSet, intervalCompleted,
      startTime, elapsedBeforePause]);

  // Subscribe to Watch events during active running
  useEffect(() => {
    if (Platform.OS !== 'ios' || !WatchBridgeModule) return;
    if (phase !== 'running' && phase !== 'paused') return;

    const emitter = new NativeEventEmitter(WatchBridgeModule);

    const hrSub = emitter.addListener(
      WATCH_EVENTS.HEART_RATE,
      (event: WatchHeartRateEvent) => {
        updateHeartRate(event.bpm);
      },
    );

    const cmdSub = emitter.addListener(
      WATCH_EVENTS.COMMAND,
      (event: WatchCommandEvent) => {
        switch (event.command) {
          case 'pause':
            callbacksRef.current?.onPauseCommand?.();
            break;
          case 'resume':
            callbacksRef.current?.onResumeCommand?.();
            break;
          case 'stop':
            callbacksRef.current?.onStopCommand?.();
            break;
        }
      },
    );

    const reachabilitySub = emitter.addListener(
      WATCH_EVENTS.REACHABILITY_CHANGE,
      (event: WatchReachabilityEvent) => {
        setWatchConnected(event.isReachable);
      },
    );

    // Check initial Watch paired status (isPaired = 페어링 여부)
    WatchBridgeModule.getWatchStatus()
      .then((status: { isPaired: boolean; isReachable: boolean; isAppInstalled: boolean }) => {
        setWatchConnected(status.isPaired);
      })
      .catch((err: any) => {
        console.warn('[useWatchCompanion] 워치 상태 조회 실패:', err);
      });

    subscriptionsRef.current = [hrSub, cmdSub, reachabilitySub];

    return () => {
      subscriptionsRef.current.forEach((sub) => sub.remove());
      subscriptionsRef.current = [];
    };
  }, [phase, updateHeartRate, setWatchConnected]);

  return {
    isAvailable: Platform.OS === 'ios' && !!WatchBridgeModule,
  };
}
