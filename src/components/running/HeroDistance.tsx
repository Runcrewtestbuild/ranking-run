import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRunningStore } from '../../stores/runningStore';
import { metersToKm } from '../../utils/format';
import { FONT_SIZES } from '../../utils/constants';

interface HeroDistanceProps {
  textColor: string;
  secondaryColor: string;
}

/**
 * Hero distance display that subscribes to distanceMeters independently.
 * Prevents parent re-render for display-only distance updates.
 */
export default React.memo(function HeroDistance({
  textColor,
  secondaryColor,
}: HeroDistanceProps) {
  const distanceMeters = useRunningStore((s) => s.distanceMeters);

  return (
    <View style={styles.row}>
      <Text style={[styles.value, { color: textColor }]}>{metersToKm(distanceMeters)}</Text>
      <Text style={[styles.unit, { color: secondaryColor }]}>km</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  value: {
    fontSize: 56,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 64,
  },
  unit: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
  },
});
