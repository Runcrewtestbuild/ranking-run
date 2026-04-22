import React, { useCallback, memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { FeedActivity, ReactionType } from '../../types/feed';
import ReactionBar from './ReactionBar';

// ---- Helpers ----

function formatRelativeTime(dateStr: string, t: TFunction): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return t('social.activity.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('social.activity.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('social.activity.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t('social.activity.daysAgo', { count: diffDay });
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 5) return t('social.activity.weeksAgo', { count: diffWeek });
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return t('social.activity.monthsAgo', { count: diffMonth });
  return t('social.activity.yearsAgo', { count: Math.floor(diffMonth / 12) });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}'${s.toString().padStart(2, '0')}"`;
}

function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}'${s.toString().padStart(2, '0')}"`;
}

function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2);
}

function getActivityIcon(type: FeedActivity['activityType']): string {
  switch (type) {
    case 'run_completed':
      return '\uD83C\uDFC3';
    case 'pr_achieved':
      return '\uD83C\uDFC6';
    case 'challenge_completed':
      return '\uD83C\uDF1F';
    case 'crew_joined':
      return '\uD83D\uDC65';
    case 'streak_milestone':
      return '\uD83D\uDD25';
    case 'post':
      return '';
    default:
      return '';
  }
}

function getActivityTitle(activity: FeedActivity, t: TFunction): string {
  switch (activity.activityType) {
    case 'run_completed':
      return `\uD83C\uDFC3 ${t('social.activity.runCompleted')}`;
    case 'pr_achieved':
      return `\uD83C\uDFC6 ${t('social.activity.prAchieved')}`;
    case 'challenge_completed':
      return `\uD83C\uDF1F ${t('social.activity.challengeCompleted')}`;
    case 'crew_joined':
      return `\uD83D\uDC65 ${t('social.activity.crewJoined')}`;
    case 'streak_milestone':
      return `\uD83D\uDD25 ${t('social.activity.streakMilestone')}`;
    default:
      return '';
  }
}

// ---- Sub-components ----

interface CardHeaderProps {
  activity: FeedActivity;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
  onUserPress?: (userId: string) => void;
  t: TFunction;
}

const CardHeader = memo(function CardHeader({
  activity,
  styles: s,
  colors,
  onUserPress,
  t,
}: CardHeaderProps) {
  const [avatarError, setAvatarError] = useState(false);
  const handlePress = useCallback(() => {
    onUserPress?.(activity.userId);
  }, [activity.userId, onUserPress]);

  const initial = activity.userNickname.charAt(0).toUpperCase();

  return (
    <TouchableOpacity
      style={s.header}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={!onUserPress}
    >
      {activity.userAvatarUrl && !avatarError ? (
        <Image
          source={{ uri: activity.userAvatarUrl }}
          style={s.avatar}
          onError={() => setAvatarError(true)}
        />
      ) : (
        <View style={[s.avatar, s.avatarPlaceholder]}>
          <Text style={s.avatarPlaceholderText}>
            {initial}
          </Text>
        </View>
      )}
      <View style={s.headerText}>
        <Text style={s.nickname} numberOfLines={1}>
          {activity.userNickname}
        </Text>
        <Text style={s.timestamp}>{formatRelativeTime(activity.createdAt, t)}</Text>
      </View>
    </TouchableOpacity>
  );
});

interface RunStatsProps {
  runRecord: NonNullable<FeedActivity['runRecord']>;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

const RunStats = memo(function RunStats({ runRecord, styles: s, t }: RunStatsProps & { t: TFunction }) {
  return (
    <View style={s.runStatsContainer}>
      {runRecord.thumbnailUrl && (
        <Image
          source={{ uri: runRecord.thumbnailUrl }}
          style={s.routeMapPreview}
          resizeMode="cover"
        />
      )}
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statValue}>
            {formatDistanceKm(runRecord.distanceMeters)}
          </Text>
          <Text style={s.statLabel}>km</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>
            {formatDuration(runRecord.durationSeconds)}
          </Text>
          <Text style={s.statLabel}>{t('social.activity.statTime')}</Text>
        </View>
        <View style={s.statItem}>
          <Text style={s.statValue}>
            {formatPace(runRecord.avgPaceSecondsPerKm)}
          </Text>
          <Text style={s.statLabel}>{t('social.activity.statPace')}</Text>
        </View>
      </View>
    </View>
  );
});

interface PRContentProps {
  activity: FeedActivity;
  styles: ReturnType<typeof createStyles>;
}

const PRContent = memo(function PRContent({ activity, styles: s, t }: PRContentProps & { t: TFunction }) {
  const meta = activity.metadata;
  const distanceLabel = (meta.distance_label as string) ?? '';
  const newTime = (meta.new_time as string) ?? '';
  const prevTime = (meta.prev_time as string) ?? '';
  const improvement = (meta.improvement as string) ?? '';

  return (
    <View style={s.prContainer}>
      <Text style={s.prMainText}>
        {distanceLabel} — {newTime}
      </Text>
      {prevTime ? (
        <Text style={s.prSubText}>
          ({t('social.activity.prPrevious')}: {prevTime}) {'\u26A1'} {improvement}
        </Text>
      ) : null}
    </View>
  );
});

interface PhotoGridProps {
  imageUrls: string[];
  styles: ReturnType<typeof createStyles>;
}

const PhotoGrid = memo(function PhotoGrid({ imageUrls, styles: s }: PhotoGridProps) {
  if (imageUrls.length === 0) return null;

  if (imageUrls.length === 1) {
    return (
      <Image
        source={{ uri: imageUrls[0] }}
        style={s.singlePhoto}
        resizeMode="cover"
      />
    );
  }

  return (
    <View style={s.photoGrid}>
      {imageUrls.slice(0, 4).map((url, idx) => (
        <Image
          key={idx}
          source={{ uri: url }}
          style={[
            s.gridPhoto,
            imageUrls.length === 2 && s.gridPhotoHalf,
            imageUrls.length >= 3 && s.gridPhotoQuarter,
          ]}
          resizeMode="cover"
        />
      ))}
      {imageUrls.length > 4 && (
        <View style={s.morePhotosOverlay}>
          <Text style={s.morePhotosText}>+{imageUrls.length - 4}</Text>
        </View>
      )}
    </View>
  );
});

// ---- Main Component ----

interface ActivityCardProps {
  activity: FeedActivity;
  onToggleReaction: (activityId: string, type: ReactionType) => void;
  onUserPress?: (userId: string) => void;
}

function ActivityCardInner({
  activity,
  onToggleReaction,
  onUserPress,
}: ActivityCardProps) {
  const colors = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleToggleReaction = useCallback(
    (type: ReactionType) => {
      onToggleReaction(activity.id, type);
    },
    [activity.id, onToggleReaction],
  );

  const activityTitle = getActivityTitle(activity, t);

  return (
    <View style={s.card}>
      <CardHeader
        activity={activity}
        styles={s}
        colors={colors}
        onUserPress={onUserPress}
        t={t}
      />

      {/* Activity title (for non-post types) */}
      {activity.activityType !== 'post' && activityTitle !== '' && (
        <Text style={s.activityTitle}>{activityTitle}</Text>
      )}

      {/* Run completed — stats card */}
      {activity.activityType === 'run_completed' && activity.runRecord && (
        <RunStats runRecord={activity.runRecord} styles={s} colors={colors} t={t} />
      )}

      {/* PR achieved — special display */}
      {activity.activityType === 'pr_achieved' && (
        <PRContent activity={activity} styles={s} t={t} />
      )}

      {/* Content text */}
      {activity.content ? (
        <Text style={s.contentText}>{activity.content}</Text>
      ) : null}

      {/* Photo grid */}
      <PhotoGrid imageUrls={activity.imageUrls} styles={s} />

      {/* Reactions */}
      <ReactionBar
        reactions={activity.reactions}
        userReactions={activity.userReactions}
        onToggleReaction={handleToggleReaction}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      color: colors.white,
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
    },
    headerText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    nickname: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    timestamp: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
    },
    // Activity title
    activityTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
      marginTop: SPACING.md,
    },
    // Run stats
    runStatsContainer: {
      marginTop: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    routeMapPreview: {
      width: '100%',
      height: 180,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.lg,
    },
    statItem: {
      alignItems: 'center',
      gap: 2,
    },
    statValue: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      color: colors.text,
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textTertiary,
    },
    // PR
    prContainer: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.accent + '1A',
    },
    prMainText: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    prSubText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginTop: SPACING.xs,
    },
    // Content
    contentText: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 22,
      marginTop: SPACING.md,
    },
    // Photos
    singlePhoto: {
      width: '100%',
      height: 240,
      borderRadius: BORDER_RADIUS.md,
      marginTop: SPACING.md,
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.xs,
      marginTop: SPACING.md,
    },
    gridPhoto: {
      borderRadius: BORDER_RADIUS.xs,
    },
    gridPhotoHalf: {
      width: '49%',
      height: 160,
    },
    gridPhotoQuarter: {
      width: '48%',
      height: 120,
    },
    morePhotosOverlay: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: '48%',
      height: 120,
      borderRadius: BORDER_RADIUS.xs,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    morePhotosText: {
      color: '#FFF',
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
    },
  });

export default memo(ActivityCardInner);
