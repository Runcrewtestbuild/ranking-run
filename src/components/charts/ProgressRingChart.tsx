import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZES, SPACING } from '../../utils/constants';

interface Props {
  progress: number; // 0 to 1
  size?: number; // diameter, default 100
  strokeWidth?: number; // default 8
  color?: string; // ring color, defaults to colors.primary
  trackColor?: string; // background ring, defaults to colors.border
  value: string; // center text (e.g. "12", "78%")
  subtitle?: string; // below value (e.g. "일 연속", "완주율")
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProgressRingChart({
  progress,
  size = 100,
  strokeWidth = 8,
  color,
  trackColor,
  value,
  subtitle,
}: Props) {
  const colors = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  const ringColor = color ?? colors.primary;
  const ringTrackColor = trackColor ?? colors.border;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const clampedProgress = Math.max(0, Math.min(progress, 1));

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: clampedProgress,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [clampedProgress]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringTrackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={[styles.valueText, { color: colors.text }]}>
          {value}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitleText, { color: colors.textTertiary }]}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  subtitleText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    marginTop: SPACING.xs,
  },
});
