import React, { useCallback, memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '../../lib/icons';
import type { TFunction } from 'i18next';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import RoutePreview from '../common/RoutePreview';
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
          <Text style={s.headerDot}>{'\u00B7'}</Text>
          <Text style={s.timestamp}>{formatRelativeTime(activity.createdAt, t)}</Text>
        </View>
        {activity.activityType !== 'post' && activityTitle !== '' && (
          <Text style={s.headerSubtitle}>{activityTitle}</Text>
        )}
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
  return (
    <View style={s.runStatsContainer}>
      {runRecord.routePreview && runRecord.routePreview.length >= 2 ? (
        <View style={s.routeMapPreview}>
          <RoutePreview
            coordinates={runRecord.routePreview}
            width={340}
            height={220}
            strokeColor={colors.primary}
            strokeWidth={3}
            showMap
          />
        </View>
      ) : runRecord.thumbnailUrl ? (
        <Image
          source={{ uri: runRecord.thumbnailUrl }}
          style={s.routeMapPreview}
          resizeMode="cover"
        />
      ) : (
        <View style={s.routeMapPlaceholder}>
          <Ionicons name="map-outline" size={36} color={colors.textTertiary} />
        </View>
      )}
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
  const meta = activity.metadata;
  const distanceLabel = (meta.distance_label as string) ?? '';
  const newTime = (meta.new_time as string) ?? '';
  const prevTime = (meta.prev_time as string) ?? '';
  const improvement = (meta.improvement as string) ?? '';

  return (
    <View style={s.prContainer}>
      <View style={s.prBadge}>
        <Text style={s.prBadgeText}>PR</Text>
      </View>
      <View style={s.prTextGroup}>
        <Text style={s.prMainText}>
          {distanceLabel} — {newTime}
        </Text>
        {prevTime ? (
          <Text style={s.prSubText}>
            {t('social.activity.prPrevious')}: {prevTime} {'\u26A1'} {improvement}
          </Text>
        ) : null}
      </View>
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
      {/* Header with avatar, name, time, subtitle */}
      <View style={s.cardInner}>
        <CardHeader
          activity={activity}
          styles={s}
          colors={colors}
          onUserPress={onUserPress}
          t={t}
        />
      </View>

      {/* Run completed — route map (full-width, no side padding) + stats */}
      {activity.activityType === 'run_completed' && activity.runRecord && (
        <RunStats runRecord={activity.runRecord} styles={s} colors={colors} t={t} />
      )}

      {/* PR achieved — badge display */}
      {activity.activityType === 'pr_achieved' && (
        <View style={s.cardInner}>
          <PRContent activity={activity} styles={s} t={t} />
        </View>
      )}

      {/* Photo grid */}
      {activity.imageUrls.length > 0 && (
        <PhotoGrid imageUrls={activity.imageUrls} styles={s} />
      )}

      {/* Stats row (inside card padding for run) */}

      {/* Content text with truncation */}
      {activity.content ? (
        <View style={s.cardInner}>
          <Text
            style={s.contentText}
            numberOfLines={contentExpanded ? undefined : 3}
          >
            {activity.content}
          </Text>
          {!contentExpanded && activity.content.length > 120 && (
            <TouchableOpacity onPress={handleExpandContent} activeOpacity={0.6}>
              <Text style={s.contentMore}>{t('social.activity.readMore', { defaultValue: '\uB354\uBCF4\uAE30' })}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Like + Comment action row */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={s.actionButton}
          onPress={handleToggleLike}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22}
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
          <Ionicons name="chatbubble-outline" size={20} color={colors.textTertiary} />
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
    // ---- Card container ----
    card: {
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      marginHorizontal: SPACING.md,
      marginBottom: SPACING.md,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    cardInner: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
    },

    // ---- Header ----
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      color: colors.white,
      fontSize: FONT_SIZES.sm,
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
    },
    headerSubtitle: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textSecondary,
      marginTop: 1,
    },

    // ---- Run stats ----
    runStatsContainer: {
      overflow: 'hidden',
    },
    routeMapPreview: {
      width: '100%',
      height: 220,
      backgroundColor: colors.surface,
    },
    routeMapPlaceholder: {
      width: '100%',
      height: 220,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.lg,
      paddingHorizontal: SPACING.lg,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValueHero: {
      fontSize: 22,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    statValue: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
      color: colors.text,
    },
    statLabel: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: colors.textTertiary,
      marginTop: 2,
    },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      height: 28,
      backgroundColor: colors.border,
    },

    // ---- PR ----
    prContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginTop: SPACING.sm,
    },
    prBadge: {
      backgroundColor: colors.accent ?? colors.primary,
      borderRadius: BORDER_RADIUS.xs,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    prBadgeText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '800',
      color: '#FFF',
    },
    prTextGroup: {
      flex: 1,
    },
    prMainText: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    prSubText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // ---- Content ----
    contentText: {
      fontSize: FONT_SIZES.md,
      color: colors.text,
      lineHeight: 22,
    },
    contentMore: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textTertiary,
      marginTop: SPACING.xs,
    },

    // ---- Photos ----
    singlePhoto: {
      width: '100%',
      height: 240,
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
      height: 160,
    },
    gridPhotoQuarter: {
      width: '49.5%',
      height: 120,
    },
    morePhotosOverlay: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: '49.5%',
      height: 120,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    morePhotosText: {
      color: '#FFF',
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
    },

    // ---- Action row ----
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xl,
      marginTop: SPACING.xs,
      paddingTop: SPACING.sm,
      paddingBottom: SPACING.md,
      paddingHorizontal: SPACING.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingVertical: SPACING.xs,
    },
    actionCount: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    actionCountActive: {
      color: '#E53E3E',
    },
  });

export default memo(ActivityCardInner);
