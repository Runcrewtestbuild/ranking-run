import React, { useCallback, memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '../../lib/icons';
import type { TFunction } from 'i18next';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import CourseThumbnailMap from '../course/CourseThumbnailMap';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { FeedActivity, ReactionType } from '../../types/feed';

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

function getActivityTitle(activity: FeedActivity, t: TFunction): string {
  switch (activity.activityType) {
    case 'run_completed':
      return t('social.activity.runCompleted');
    case 'pr_achieved':
      return t('social.activity.prAchieved');
    case 'challenge_completed':
      return t('social.activity.challengeCompleted');
    case 'crew_joined':
      return t('social.activity.crewJoined');
    case 'streak_milestone':
      return t('social.activity.streakMilestone');
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
  const activityTitle = getActivityTitle(activity, t);

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
      <View style={s.headerTextColumn}>
        <View style={s.headerTopRow}>
          <Text style={s.nickname} numberOfLines={1}>
            {activity.userNickname}
          </Text>
          {activity.activityType !== 'post' && activityTitle !== '' && (
            <Text style={s.headerSubtitle}>{activityTitle}</Text>
          )}
        </View>
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

const RunStats = memo(function RunStats({ runRecord, styles: s, colors, t }: RunStatsProps & { t: TFunction }) {
  const { width: screenWidth } = useWindowDimensions();
  const mapWidth = screenWidth - SPACING.lg * 2;
  return (
    <View style={s.runStatsContainer}>
      <CourseThumbnailMap
        thumbnailUrl={runRecord.thumbnailUrl}
        thumbnailUrlLight={runRecord.thumbnailUrlLight}
        width={mapWidth}
        height={140}
        borderRadius={BORDER_RADIUS.sm}
      />
      <View style={s.statsRow}>
        <View style={s.statItem}>
          <Text style={s.statValueHero}>
            {formatDistanceKm(runRecord.distanceMeters)}
          </Text>
          <Text style={s.statLabel}>km</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statValue}>
            {formatDuration(runRecord.durationSeconds)}
          </Text>
          <Text style={s.statLabel}>{t('social.activity.statTime')}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statValue}>
            {formatPace(runRecord.avgPaceSecondsPerKm)}
          </Text>
          <Text style={s.statLabel}>/km</Text>
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
  const colors = useTheme();
  const meta = activity.metadata;
  const prType = (meta.pr_type as string) ?? '';

  const titleMap: Record<string, string> = {
    fastest_5k: `5K ${t('social.activity.prBestRecord')}`,
    fastest_10k: `10K ${t('social.activity.prBestRecord')}`,
    longest_run: t('social.activity.prLongestRecord'),
  };
  const title = titleMap[prType] || t('social.activity.prAchieved');

  let recordValue = (meta.new_time as string) ?? '';
  if (!recordValue && activity.runRecord) {
    const run = activity.runRecord;
    if (prType.includes('fastest')) {
      const p = run.avgPaceSecondsPerKm;
      recordValue = `${Math.floor(p / 60)}'${String(p % 60).padStart(2, '0')}" /km`;
    } else {
      recordValue = `${(run.distanceMeters / 1000).toFixed(2)} km`;
    }
  }

  const prevTime = (meta.prev_time as string) ?? '';
  const improvement = (meta.improvement as string) ?? '';
  const run = activity.runRecord;

  return (
    <View style={s.prContainer}>
      <Text style={s.prTitle}>{title}</Text>
      <Text style={s.prHeroValue}>{recordValue}</Text>
      {(prevTime || improvement) ? (
        <Text style={s.prComparison}>
          {prevTime ? `${t('social.activity.prPrevious')} ${prevTime}` : ''}
          {prevTime && improvement ? '  →  ' : ''}
          {improvement ? `${improvement} ${t('social.activity.prFaster')}` : ''}
        </Text>
      ) : null}
      {run ? (
        <View style={s.prRunSummary}>
          <Text style={s.prRunStat}>{(run.distanceMeters / 1000).toFixed(2)} km</Text>
          <Text style={[s.prRunStat, { color: colors.textTertiary }]}>·</Text>
          <Text style={s.prRunStat}>{formatDuration(run.durationSeconds)}</Text>
          <Text style={[s.prRunStat, { color: colors.textTertiary }]}>·</Text>
          <Text style={s.prRunStat}>{Math.round(run.distanceMeters / 1000 * 60)} kcal</Text>
        </View>
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
  onCommentPress?: (activityId: string) => void;
}

function ActivityCardInner({
  activity,
  onToggleReaction,
  onUserPress,
  onCommentPress,
}: ActivityCardProps) {
  const colors = useTheme();
  const { t } = useTranslation();
  const hapticEnabled = useSettingsStore((s) => s.hapticFeedback);
  const s = useMemo(() => createStyles(colors), [colors]);

  const isLiked = activity.userReactions.includes('heart');
  const likeCount = activity.reactions.heart ?? 0;
  const commentCount = activity.commentCount ?? 0;

  const handleToggleLike = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onToggleReaction(activity.id, 'heart');
  }, [activity.id, onToggleReaction, hapticEnabled]);

  const handleCommentPress = useCallback(() => {
    onCommentPress?.(activity.id);
  }, [activity.id, onCommentPress]);

  const [contentExpanded, setContentExpanded] = useState(false);

  const handleExpandContent = useCallback(() => {
    setContentExpanded(true);
  }, []);

  return (
    <View style={s.card}>
      {/* Header */}
      <CardHeader
        activity={activity}
        styles={s}
        colors={colors}
        onUserPress={onUserPress}
        t={t}
      />

      {/* Content text — above media for SNS feel */}
      {activity.content ? (
        <View style={s.contentBlock}>
          <Text
            style={s.contentText}
            numberOfLines={contentExpanded ? undefined : 3}
          >
            {activity.content}
          </Text>
          {!contentExpanded && activity.content.length > 120 && (
            <TouchableOpacity onPress={handleExpandContent} activeOpacity={0.6}>
              <Text style={s.contentMore}>{t('social.activity.readMore', { defaultValue: '더보기' })}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Run completed — compact map + inline stats */}
      {activity.activityType === 'run_completed' && activity.runRecord && (
        <RunStats runRecord={activity.runRecord} styles={s} colors={colors} t={t} />
      )}

      {/* PR achieved */}
      {activity.activityType === 'pr_achieved' && (
        <PRContent activity={activity} styles={s} t={t} />
      )}

      {/* Photo grid */}
      {activity.imageUrls.length > 0 && (
        <View style={s.photoContainer}>
          <PhotoGrid imageUrls={activity.imageUrls} styles={s} />
        </View>
      )}

      {/* Like + Comment action row */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.actionButton}
          onPress={handleToggleLike}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={20}
            color={isLiked ? '#E53E3E' : colors.textTertiary}
          />
          {likeCount > 0 && (
            <Text style={[s.actionCount, isLiked && s.actionCountActive]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.actionButton}
          onPress={handleCommentPress}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-outline" size={18} color={colors.textTertiary} />
          {commentCount > 0 && (
            <Text style={s.actionCount}>{commentCount}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    // ---- Flat card — no background, no shadow, divider only ----
    card: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },

    // ---- Header ----
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      color: colors.white,
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
    },
    headerTextColumn: {
      flex: 1,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    nickname: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    headerDot: {
      fontSize: FONT_SIZES.md,
      color: colors.textTertiary,
      fontWeight: '700',
    },
    timestamp: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
      marginTop: 1,
    },
    headerSubtitle: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textSecondary,
    },

    // ---- Content ----
    contentBlock: {
      marginTop: SPACING.sm,
    },
    contentText: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 21,
    },
    contentMore: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: 2,
    },

    // ---- Run stats (compact) ----
    runStatsContainer: {
      marginTop: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    routeMapPreview: {
      width: '100%',
      height: 140,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    routeMapPlaceholder: {
      width: '100%',
      height: 140,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.sm,
      paddingHorizontal: SPACING.md,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValueHero: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    statValue: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    statLabel: {
      fontSize: 10,
      fontWeight: '500',
      color: colors.textTertiary,
      marginTop: 1,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 22,
      backgroundColor: colors.border,
    },

    // ---- PR ----
    prContainer: {
      marginTop: SPACING.sm,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.sm,
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
    },
    prTitle: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: colors.textSecondary,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    prHeroValue: {
      fontSize: 24,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
      color: '#10B981',
      marginTop: 2,
    },
    prComparison: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 2,
    },
    prRunSummary: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.sm,
      paddingTop: SPACING.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    prRunStat: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    prStatsRow: { flexDirection: 'row' as const },
    prStatItem: { alignItems: 'center' as const },
    prStatLabel: { fontSize: FONT_SIZES.xs, color: colors.textTertiary },
    prStatValue: {
      fontSize: FONT_SIZES.md,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'] as any,
    },

    // ---- Photos (compact) ----
    photoContainer: {
      marginTop: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
      overflow: 'hidden',
    },
    singlePhoto: {
      width: '100%',
      height: 200,
    },
    photoGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    gridPhoto: {
      borderRadius: 0,
    },
    gridPhotoHalf: {
      width: '49.5%',
      height: 140,
    },
    gridPhotoQuarter: {
      width: '49.5%',
      height: 100,
    },
    morePhotosOverlay: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: '49.5%',
      height: 100,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    morePhotosText: {
      color: '#FFF',
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
    },

    // ---- Action row (compact) ----
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.xs,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
    },
    actionCount: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    actionCountActive: {
      color: '#E53E3E',
    },

    // kept for compatibility
    cardInner: {
      marginTop: SPACING.sm,
    },
  });

export default memo(ActivityCardInner);
