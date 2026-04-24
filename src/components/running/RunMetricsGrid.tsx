import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRunningStore } from '../../stores/runningStore';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { formatDuration, formatPace } from '../../utils/format';

interface RunMetricsGridProps {
  /** Override time display (e.g. interval remaining time) */
  timeOverride?: string | null;
  /** Override time label */
  timeLabelOverride?: string | null;
  /** Whether to highlight time in yellow (paused / auto-paused) */
  highlightTime?: boolean;
}

/**
 * Self-contained running metrics grid (2x3) that subscribes to the running
 * store independently. This prevents the parent (WorldScreen) from
 * re-rendering every GPS tick just to display these values.
 */
export default React.memo(function RunMetricsGrid({
  timeOverride,
  timeLabelOverride,
  highlightTime = false,
}: RunMetricsGridProps) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Individual primitive selectors -- Zustand only re-renders when the
  // selected value actually changes (referential equality for primitives).
  const durationSeconds = useRunningStore((s) => s.durationSeconds);
  const avgPaceSecondsPerKm = useRunningStore((s) => s.avgPaceSecondsPerKm);
  const calories = useRunningStore((s) => s.calories);
  const heartRate = useRunningStore((s) => s.heartRate);
  const cadence = useRunningStore((s) => s.cadence);
  const elevationGainMeters = useRunningStore((s) => s.elevationGainMeters);

  const timeValue = timeOverride ?? formatDuration(durationSeconds);
  const timeLabel = timeLabelOverride ?? '시간';

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>{timeLabel}</Text>
          <Text style={[styles.value, highlightTime && { color: '#FFD60A' }]}>
            {timeValue}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.label}>평균 페이스</Text>
          <Text style={styles.value}>{formatPace(avgPaceSecondsPerKm)}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.label}>칼로리</Text>
          <Text style={styles.value}>{calories}</Text>
        </View>
      </View>
      <View style={styles.rowDivider} />
      <View style={styles.row}>
        <View style={styles.cell}>
          <Text style={styles.label}>심박수</Text>
          <Text style={[styles.value, heartRate > 0 && { color: colors.error }]}>
            {heartRate > 0 ? Math.round(heartRate) : '--'}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.label}>케이던스</Text>
          <Text style={styles.value}>{cadence > 0 ? cadence : '--'}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.cell}>
          <Text style={styles.label}>고도(m)</Text>
          <Text style={styles.value}>
            {elevationGainMeters > 0 ? `+${Math.round(elevationGainMeters)}` : '--'}
          </Text>
        </View>
      </View>
    </View>
  );
});

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    grid: {
      backgroundColor: c.surface,
      borderRadius: BORDER_RADIUS.lg,
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.xs,
      marginTop: SPACING.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
    },
    rowDivider: {
      height: 1,
      backgroundColor: c.divider,
      marginHorizontal: SPACING.md,
    },
    cell: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    label: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: c.textSecondary,
    },
    value: {
      fontSize: 20,
      fontWeight: '800',
      color: c.text,
      fontVariant: ['tabular-nums'],
    },
    divider: {
      width: 1,
      height: 28,
      backgroundColor: c.divider,
    },
  });
