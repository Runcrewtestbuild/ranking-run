// ============================================================
// Formatting Utilities
// ============================================================

import i18n from '../i18n';

/**
 * Converts pace (seconds per km) to a display string like "5'30\""
 */
export function formatPace(secondsPerKm: number | null | undefined): string {
  if (secondsPerKm == null || secondsPerKm <= 0) return '--\'--"';
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.floor(secondsPerKm % 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * Converts distance in meters to a display string.
 * Under 1000m: "850m", 1000m+: "3.25km"
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(2)}km`;
}

/**
 * Converts distance in meters to km with fixed decimal places.
 */
export function metersToKm(meters: number, decimals: number = 2): string {
  return (meters / 1000).toFixed(decimals);
}

/**
 * Converts duration in seconds to "HH:MM:SS" or "MM:SS" format.
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Returns the user's locale string for Intl APIs.
 */
function getUserLocale(): string {
  const localeMap: Record<string, string> = { ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };
  return localeMap[i18n.language] ?? 'en-US';
}

/**
 * Formats a date string using the device locale.
 * ko: 2026. 1. 15.  en: 1/15/2026  ja: 2026/1/15
 */
export function formatLocalDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(getUserLocale(), {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
}

/**
 * Converts an ISO date string to a locale-aware relative time.
 * Under 5s: "방금 전", under 1min: "30초 전", under 1h: "5분 전",
 * under 24h: "3시간 전", under 7d: "2일 전", else: locale date.
 */
export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffSeconds < 5) return i18n.t('format.justNow');
  if (diffSeconds < 60) return i18n.t('format.secondsAgo', { count: diffSeconds });
  if (diffMinutes < 60) return i18n.t('format.minutesAgo', { count: diffMinutes });
  if (diffHours < 24) return i18n.t('format.hoursAgo', { count: diffHours });
  if (diffDays < 7) return i18n.t('format.daysAgo', { count: diffDays });

  return formatLocalDate(isoString);
}

/**
 * Formats a date string to "YYYY.MM.DD" format.
 * @deprecated Use formatLocalDate for locale-aware formatting.
 */
export function formatDate(isoString: string): string {
  return formatLocalDate(isoString);
}

/**
 * Formats a number with commas for thousands separator.
 */
export function formatNumber(num: number): string {
  return num.toLocaleString(getUserLocale());
}

/**
 * Calculates estimated calories burned from distance and duration.
 * Rough estimate: ~60 kcal per km for a 65kg person.
 */
export function estimateCalories(distanceMeters: number): number {
  return Math.round((distanceMeters / 1000) * 60);
}

/**
 * Returns a compact goal achievement tag for run history display.
 * - achieved: true = goal met, false = not met, null = free run (no goal)
 */
export function formatRunGoalTag(
  goalData: { type: string; value?: number | null; intervalSets?: number; intervalRunSeconds?: number; intervalWalkSeconds?: number } | null | undefined,
  runData: { distance_meters: number; duration_seconds: number; avg_pace_seconds_per_km: number; completedSets?: number },
): { label: string; achieved: boolean | null } {
  const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

  if (!goalData?.type) {
    return { label: t('runGoalTag.freeRun'), achieved: null };
  }

  const achievedStr = t('runGoalTag.achieved');
  const notAchievedStr = t('runGoalTag.notAchieved');

  switch (goalData.type) {
    case 'distance': {
      const goalKm = ((goalData.value ?? 0) / 1000).toFixed(1);
      const met = runData.distance_meters >= (goalData.value ?? 0);
      return { label: `${t('runGoalTag.distanceGoal')} ${goalKm}km \u00B7 ${met ? achievedStr : notAchievedStr}`, achieved: met };
    }
    case 'time': {
      const goalMin = Math.floor((goalData.value ?? 0) / 60);
      const met = runData.duration_seconds >= (goalData.value ?? 0);
      return { label: `${t('runGoalTag.timeGoal')} ${goalMin}${t('common.minuteShort')} \u00B7 ${met ? achievedStr : notAchievedStr}`, achieved: met };
    }
    case 'pace': {
      const goalPace = formatPace(goalData.value ?? 0);
      const met = runData.avg_pace_seconds_per_km > 0 && runData.avg_pace_seconds_per_km <= (goalData.value ?? 0);
      return { label: `${t('runGoalTag.paceGoal')} ${goalPace} \u00B7 ${met ? achievedStr : notAchievedStr}`, achieved: met };
    }
    case 'program': {
      const goalKm = ((goalData.value ?? 0) / 1000).toFixed(1);
      const met = runData.distance_meters >= (goalData.value ?? 0);
      return { label: `${t('runGoalTag.programGoal')} ${goalKm}km \u00B7 ${met ? achievedStr : notAchievedStr}`, achieved: met };
    }
    case 'interval': {
      const targetSets = goalData.intervalSets ?? 0;
      const completed = runData.completedSets ?? 0;
      const met = completed >= targetSets;
      return {
        label: met
          ? `${t('runGoalTag.interval')} ${targetSets}${t('runGoalTag.sets')} \u00B7 ${t('runGoalTag.completed')}`
          : `${t('runGoalTag.interval')} ${completed}/${targetSets}${t('runGoalTag.sets')} \u00B7 ${t('runGoalTag.notCompleted')}`,
        achieved: met,
      };
    }
    default:
      return { label: t('runGoalTag.freeRun'), achieved: null };
  }
}
