import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { CrewPost } from '../../types/crewFeed';

// ---- Helpers ----

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return '방금';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatPace(secondsPerKm: number): string {
  const min = Math.floor(secondsPerKm / 60);
  const sec = Math.round(secondsPerKm % 60);
  return `${min}'${String(sec).padStart(2, '0')}"`;
}

function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2);
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---- Component ----

interface CrewPostCardProps {
  post: CrewPost;
  onLike?: (postId: string) => void;
  onPress?: (postId: string) => void;
  onAuthorPress?: (userId: string) => void;
}

function CrewPostCard({ post, onLike, onPress, onAuthorPress }: CrewPostCardProps) {
  const colors = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const isNotice = post.postType === 'notice';
  const isRunShare = post.postType === 'run_share';

  const handlePress = useCallback(() => onPress?.(post.id), [post.id, onPress]);
  const handleLike = useCallback(() => onLike?.(post.id), [post.id, onLike]);
  const handleAuthor = useCallback(
    () => onAuthorPress?.(post.author.id),
    [post.author.id, onAuthorPress],
  );

  return (
    <TouchableOpacity
      style={[s.card, isNotice && s.cardNotice]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Pinned / Notice badge */}
      {post.isPinned && (
        <View style={s.pinnedBadge}>
          <Ionicons name="pin" size={12} color={colors.primary} />
          <Text style={s.pinnedText}>고정됨</Text>
        </View>
      )}

      {/* Author row */}
      <TouchableOpacity
        style={s.authorRow}
        onPress={handleAuthor}
        activeOpacity={0.7}
        disabled={!onAuthorPress}
      >
        {isNotice && (
          <View style={s.noticeIcon}>
            <Text style={{ fontSize: 16 }}>{'\uD83D\uDCE2'}</Text>
          </View>
        )}
        {post.author.avatarUrl ? (
          <Image source={{ uri: post.author.avatarUrl }} style={s.avatar} />
        ) : (
          <View style={[s.avatar, s.avatarPlaceholder]}>
            <Ionicons name="person" size={16} color={colors.textTertiary} />
          </View>
        )}
        <View style={s.authorInfo}>
          <View style={s.authorNameRow}>
            <Text style={s.authorName} numberOfLines={1}>
              {post.author.nickname}
            </Text>
            {post.author.role === 'admin' && (
              <View style={s.roleBadge}>
                <Text style={s.roleText}>관리자</Text>
              </View>
            )}
          </View>
          <Text style={s.timestamp}>{formatRelativeTime(post.createdAt)}</Text>
        </View>
      </TouchableOpacity>

      {/* Title (notices) */}
      {post.title && (
        <Text style={s.title} numberOfLines={2}>
          {post.title}
        </Text>
      )}

      {/* Content */}
      <Text style={s.content} numberOfLines={4}>
        {post.content}
      </Text>

      {/* Images */}
      {post.imageUrls.length > 0 && (
        <View style={s.imageContainer}>
          {post.imageUrls.length === 1 ? (
            <Image
              source={{ uri: post.imageUrls[0] }}
              style={s.singleImage}
              resizeMode="cover"
            />
          ) : (
            <View style={s.imageGrid}>
              {post.imageUrls.slice(0, 4).map((url, i) => (
                <Image
                  key={`img-${i}`}
                  source={{ uri: url }}
                  style={s.gridImage}
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Embedded run stats */}
      {isRunShare && post.runStats && (
        <View style={s.runStatsCard}>
          <View style={s.runStatsRow}>
            <View style={s.runStat}>
              <Text style={s.runStatValue}>{formatDistance(post.runStats.distanceMeters)}km</Text>
              <Text style={s.runStatLabel}>거리</Text>
            </View>
            <View style={s.runStatDivider} />
            <View style={s.runStat}>
              <Text style={s.runStatValue}>{formatDuration(post.runStats.durationSeconds)}</Text>
              <Text style={s.runStatLabel}>시간</Text>
            </View>
            <View style={s.runStatDivider} />
            <View style={s.runStat}>
              <Text style={s.runStatValue}>{formatPace(post.runStats.avgPaceSecondsPerKm)}</Text>
              <Text style={s.runStatLabel}>평균 페이스</Text>
            </View>
          </View>
          {post.runStats.courseName && (
            <Text style={s.courseName} numberOfLines={1}>
              <Ionicons name="map-outline" size={12} color={colors.textTertiary} />{' '}
              {post.runStats.courseName}
            </Text>
          )}
        </View>
      )}

      {/* Footer: likes + comments */}
      <View style={s.footer}>
        <TouchableOpacity style={s.footerAction} onPress={handleLike} activeOpacity={0.7}>
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={post.isLiked ? colors.error : colors.textTertiary}
          />
          {post.likeCount > 0 && (
            <Text style={[s.footerCount, post.isLiked && { color: colors.error }]}>
              {post.likeCount}
            </Text>
          )}
        </TouchableOpacity>
        <View style={s.footerAction}>
          <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
          {post.commentCount > 0 && (
            <Text style={s.footerCount}>{post.commentCount}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(CrewPostCard);

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      ...SHADOWS.sm,
    },
    cardNotice: {
      backgroundColor: c.surfaceLight,
      borderLeftWidth: 3,
      borderLeftColor: c.primary,
    },
    pinnedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginBottom: SPACING.sm,
    },
    pinnedText: {
      fontSize: FONT_SIZES.xs,
      color: c.primary,
      fontWeight: '600',
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    noticeIcon: {
      marginRight: SPACING.sm,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: SPACING.sm,
    },
    avatarPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    authorInfo: {
      flex: 1,
    },
    authorNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
    },
    authorName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    roleBadge: {
      backgroundColor: c.primary + '20',
      paddingHorizontal: SPACING.xs,
      paddingVertical: 1,
      borderRadius: BORDER_RADIUS.xs,
    },
    roleText: {
      fontSize: FONT_SIZES.xs,
      color: c.primary,
      fontWeight: '600',
    },
    timestamp: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
      marginTop: 2,
    },
    title: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
      marginBottom: SPACING.sm,
    },
    content: {
      fontSize: FONT_SIZES.md,
      color: c.text,
      lineHeight: FONT_SIZES.md * 1.5,
      marginBottom: SPACING.md,
    },
    imageContainer: {
      marginBottom: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
    },
    singleImage: {
      width: '100%',
      height: 200,
      borderRadius: BORDER_RADIUS.md,
    },
    imageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 2,
    },
    gridImage: {
      width: '49%',
      height: 120,
      borderRadius: BORDER_RADIUS.xs,
    },
    // Run stats embed
    runStatsCard: {
      backgroundColor: c.surface,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    runStatsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
    },
    runStat: {
      alignItems: 'center',
    },
    runStatValue: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
    },
    runStatLabel: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
      marginTop: 2,
    },
    runStatDivider: {
      width: 1,
      height: 28,
      backgroundColor: c.border,
    },
    courseName: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
      marginTop: SPACING.sm,
      textAlign: 'center',
    },
    // Footer
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      paddingTop: SPACING.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    footerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    footerCount: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
    },
  });
