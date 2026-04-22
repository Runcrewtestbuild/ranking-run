import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { LeaderboardEntry, LeaderboardCategory } from '../../types/leaderboard';
import { formatDistance, formatPace } from '../../utils/format';
import i18n from '../../i18n';

interface Props {
  entry: LeaderboardEntry;
  category: LeaderboardCategory;
  topValue: number;
  onPress?: (userId: string) => void;
  /** Text shown beneath the row for the current user, e.g. "#22까지 1.2km 남았어요!" */
  encouragement?: string | null;
}

function getMedalEmoji(rank: number): string | null {
  if (rank === 1) return '\uD83E\uDD47';
  if (rank === 2) return '\uD83E\uDD48';
  if (rank === 3) return '\uD83E\uDD49';
  return null;
}

function getRankChangeIndicator(
  current: number,
  previous: number | null,
): { symbol: string; color: string } | null {
  if (previous == null) return null;
  const diff = previous - current; // positive = moved up
  if (diff > 0) return { symbol: `\u25B2 ${diff}`, color: '#10B981' };
  if (diff < 0) return { symbol: `\u25BC ${Math.abs(diff)}`, color: '#EF4444' };
  return { symbol: '\u2500\u2500 0', color: '#808080' };
}

function formatValue(value: number, category: LeaderboardCategory): string {
  switch (category) {
    case 'weekly_distance':
      return formatDistance(value * 1000); // value in km from API
    case 'monthly_count':
      return `${value}${i18n.t('social.versus.countSuffix')}`;
    case 'pace':
      return formatPace(value);
    case 'course':
      return formatPace(value);
    default:
      return String(value);
  }
}

export default function LeaderboardRow({
  entry,
  category,
  topValue,
  onPress,
  encouragement,
}: Props) {
  const colors = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const medal = getMedalEmoji(entry.rank);
  const rankChange = getRankChangeIndicator(entry.rank, entry.previousRank);
  const progressRatio = topValue > 0 ? entry.value / topValue : 0;
  const displayValue = formatValue(entry.value, category);

  const handlePress = () => {
    onPress?.(entry.userId);
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          s.row,
          entry.isCurrentUser && s.rowHighlighted,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={!onPress}
      >
        {/* Rank */}
        <View style={s.rankContainer}>
          {medal ? (
            <Text style={s.medal}>{medal}</Text>
          ) : (
            <Text style={s.rankText}>{entry.rank}</Text>
          )}
        </View>

        {/* Avatar */}
        <View style={s.avatarContainer}>
          {entry.avatarUrl ? (
            <Image source={{ uri: entry.avatarUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Ionicons name="person" size={16} color={colors.textTertiary} />
            </View>
          )}
          {entry.isCurrentUser && (
            <View style={s.starBadge}>
              <Text style={s.starText}>{'\u2605'}</Text>
            </View>
          )}
        </View>

        {/* Name + progress bar */}
        <View style={s.infoContainer}>
          <View style={s.nameRow}>
            <Text
              style={[s.name, entry.isCurrentUser && s.nameHighlighted]}
              numberOfLines={1}
            >
              {entry.isCurrentUser ? i18n.t('common.me') : entry.nickname}
            </Text>
            <Text style={s.value}>{displayValue}</Text>
          </View>
          <View style={s.progressTrack}>
            <View
              style={[
                s.progressFill,
                { width: `${Math.min(progressRatio * 100, 100)}%` },
              ]}
            />
          </View>
        </View>

        {/* Rank change */}
        {rankChange && (
          <Text style={[s.rankChange, { color: rankChange.color }]}>
            {rankChange.symbol}
          </Text>
        )}
      </TouchableOpacity>

      {encouragement && (
        <Text style={s.encouragement}>{encouragement}</Text>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
    },
    rowHighlighted: {
      backgroundColor: colors.primary + '18',
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      borderRadius: BORDER_RADIUS.sm,
      marginHorizontal: SPACING.sm,
    },
    rankContainer: {
      width: 32,
      alignItems: 'center',
    },
    medal: {
      fontSize: FONT_SIZES.xl,
    },
    rankText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    avatarContainer: {
      position: 'relative',
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starBadge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    starText: {
      fontSize: 8,
      color: '#FFF',
    },
    infoContainer: {
      flex: 1,
      gap: SPACING.xs,
    },
    nameRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    name: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: SPACING.sm,
    },
    nameHighlighted: {
      color: colors.primary,
      fontWeight: '700',
    },
    value: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
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
      backgroundColor: colors.success,
    },
    rankChange: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      minWidth: 40,
      textAlign: 'right',
    },
    encouragement: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.primary,
      paddingHorizontal: SPACING.lg,
      paddingBottom: SPACING.sm,
      marginLeft: 32 + SPACING.md + 36 + SPACING.md, // rank + gap + avatar + gap
    },
  });
