import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZES, SPACING } from '../../utils/constants';

interface Props {
  percentage: number; // 0 to 100
  size?: number; // diameter, default 120
  strokeWidth?: number; // default 12
  color?: string; // filled arc color
  label?: string; // text below chart (e.g. "완주율")
}

export default function DonutChart({
  percentage,
  size = 120,
  strokeWidth = 12,
  color,
  label,
}: Props) {
  const colors = useTheme();
  const fillColor = color ?? colors.primary;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPercent = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference * (1 - clampedPercent / 100);

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={fillColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centerContent]}>
          <Text style={[styles.percentText, { color: colors.text }]}>
            {Math.round(clampedPercent)}%
          </Text>
        </View>
      </View>
      {label && (
        <Text style={[styles.label, { color: colors.textTertiary }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});
