import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZES, SPACING } from '../../utils/constants';

interface BarItem {
  label: string;
  value: number;
  avatarUrl?: string | null;
  isMe?: boolean;
}

interface Props {
  data: BarItem[];
  maxItems?: number;
  formatValue?: (v: number) => string;
  barColor?: string;
}

export default function HorizontalBarChart({
  data,
  maxItems = 10,
  formatValue = (v) => String(v),
  barColor,
}: Props) {
  const colors = useTheme();
  const items = data.slice(0, maxItems);
  const maxValue = items.reduce((max, item) => Math.max(max, item.value), 0);

  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const percent = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        const rank = index + 1;
        const fillColor = barColor ?? colors.primary;

        return (
          <View
            key={`${item.label}-${rank}`}
            style={[
              styles.row,
              item.isMe && { backgroundColor: colors.primaryLight + '20' },
            ]}
          >
            <Text
              style={[
                styles.rank,
                { color: rank <= 3 ? colors.primary : colors.textTertiary },
              ]}
            >
              {rank}
            </Text>

            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceLight },
              ]}
            >
              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                  {item.label.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            <View style={styles.content}>
              <View style={styles.labelRow}>
                <Text
                  style={[
                    styles.label,
                    { color: item.isMe ? colors.primary : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                <Text
                  style={[styles.value, { color: colors.textSecondary }]}
                >
                  {formatValue(item.value)}
                </Text>
              </View>

              <View style={[styles.barTrack, { backgroundColor: colors.surfaceLight }]}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${percent}%`,
                      backgroundColor: item.isMe ? colors.primary : fillColor,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: SPACING.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
  },
  rank: {
    width: 22,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginLeft: SPACING.sm,
    gap: 3,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    flex: 1,
  },
  value: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginLeft: SPACING.sm,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
});
