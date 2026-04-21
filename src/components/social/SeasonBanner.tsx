import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { SeasonProgress } from '../../types/season';
import { SEASON_TIER_LABELS, SEASON_TIER_COLORS } from '../../types/season';

interface Props {
  progress: SeasonProgress;
}

export default function SeasonBanner({ progress }: Props) {
  const colors = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const tierColor = SEASON_TIER_COLORS[progress.tier];
  const tierLabel = SEASON_TIER_LABELS[progress.tier];
  const progressRatio =
    progress.nextTierPoints != null && progress.nextTierPoints > 0
      ? progress.currentPoints / progress.nextTierPoints
      : 1;
  const pointsToNext =
    progress.nextTierPoints != null
      ? progress.nextTierPoints - progress.currentPoints
      : 0;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Ionicons name="trophy-outline" size={16} color={tierColor} />
        <Text style={[s.seasonName, { color: tierColor }]}>
          {progress.seasonName}
        </Text>
        <Text style={s.daysRemaining}>
          {progress.daysRemaining}일 남음
        </Text>
      </View>

      <View style={s.tierRow}>
        <View style={[s.tierBadge, { backgroundColor: tierColor + '20' }]}>
          <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
        </View>
        <Text style={s.points}>{progress.currentPoints.toLocaleString()}P</Text>
      </View>

      {progress.nextTierPoints != null && (
        <View style={s.progressSection}>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                {
                  width: `${Math.min(progressRatio * 100, 100)}%`,
                  backgroundColor: tierColor,
                },
              ]}
            />
          </View>
          <Text style={s.progressLabel}>
            다음 티어까지 {pointsToNext.toLocaleString()}P
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      marginBottom: SPACING.sm,
    },
    seasonName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      flex: 1,
    },
    daysRemaining: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.sm,
    },
    tierBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    tierText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
    },
    points: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: colors.text,
    },
    progressSection: {
      gap: SPACING.xs,
    },
    progressTrack: {
      height: 6,
      backgroundColor: colors.surface,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 3,
    },
    progressLabel: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
    },
  });
