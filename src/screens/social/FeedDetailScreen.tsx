import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CommunityStackParamList } from '../../types/navigation';
import type { FeedActivity, FeedComment, ReactionType } from '../../types/feed';
import { feedService } from '../../services/feedService';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import ActivityCard from '../../components/social/ActivityCard';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'FeedDetail'>;
type Route = RouteProp<CommunityStackParamList, 'FeedDetail'>;

// ---- Helpers ----

function formatCommentTime(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return t('social.comment.justNow');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('social.comment.minutesAgo', { count: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t('social.comment.hoursAgo', { count: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return t('social.comment.daysAgo', { count: diffDay });
  return t('social.comment.monthsAgo', { count: Math.floor(diffDay / 30) });
}

// ---- Comment Item ----

interface CommentItemProps {
  comment: FeedComment;
  currentUserId: string | undefined;
  colors: ThemeColors;
  onReply: (comment: FeedComment) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}

const CommentItem = React.memo(function CommentItem({
  comment,
  currentUserId,
  colors,
  onReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);
  const initial = comment.userNickname.charAt(0).toUpperCase();

  return (
    <View style={[s.commentContainer, isReply && s.replyContainer]}>
      {comment.userAvatarUrl ? (
        <Image
          source={{ uri: comment.userAvatarUrl }}
          style={[s.commentAvatar, isReply && s.replyAvatar]}
        />
      ) : (
        <View style={[s.commentAvatar, isReply && s.replyAvatar, s.commentAvatarPlaceholder]}>
          <Text style={s.commentAvatarText}>{initial}</Text>
        </View>
      )}
      <View style={s.commentBody}>
        <View style={s.commentHeader}>
          <Text style={s.commentNickname}>{comment.userNickname}</Text>
          <Text style={s.commentTime}>{formatCommentTime(comment.createdAt, t)}</Text>
        </View>
        <Text style={s.commentContent}>{comment.content}</Text>
        <View style={s.commentActions}>
          {!isReply && (
            <TouchableOpacity onPress={() => onReply(comment)} activeOpacity={0.7}>
              <Text style={s.commentActionText}>{t('social.comment.reply')}</Text>
            </TouchableOpacity>
          )}
          {currentUserId === comment.userId && (
            <TouchableOpacity onPress={() => onDelete(comment.id)} activeOpacity={0.7}>
              <Text style={[s.commentActionText, s.commentDeleteText]}>{t('common.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Inline replies */}
        {comment.replies && comment.replies.length > 0 && (
          <View style={s.repliesSection}>
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                colors={colors}
                onReply={onReply}
                onDelete={onDelete}
                isReply
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
});

// ---- Main Screen ----

export default function FeedDetailScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const showToast = useToastStore((st) => st.showToast);
  const currentUser = useAuthStore((st) => st.user);
  const s = useMemo(() => createStyles(colors), [colors]);

  const { activityId } = route.params;

  // State
  const [activity, setActivity] = useState<FeedActivity | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTarget, setReplyTarget] = useState<FeedComment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const inputRef = useRef<TextInput>(null);

  // Fetch activity (reuse feed endpoint for single item)
  useEffect(() => {
    (async () => {
      try {
        const feedRes = await feedService.getFeed(0, 50);
        const found = feedRes.data.find((a) => a.id === activityId);
        if (found) setActivity(found);
      } catch {
        // ignore
      }
    })();
  }, [activityId]);

  // Fetch comments
  const fetchComments = useCallback(
    async (pageNum: number, append = false) => {
      try {
        const res = await feedService.getComments(activityId, pageNum);
        setComments((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasNext(res.hasNext);
        setPage(pageNum);
      } catch {
        if (!append) {
          showToast('error', t('social.comment.loadFailed'));
        }
      }
    },
    [activityId],
  );

  useEffect(() => {
    setIsLoading(true);
    fetchComments(0).finally(() => {
      setIsLoading(false);
      // Auto-focus input after loading
      setTimeout(() => inputRef.current?.focus(), 500);
    });
  }, [fetchComments]);

  const handleLoadMore = useCallback(() => {
    if (!hasNext) return;
    fetchComments(page + 1, true);
  }, [hasNext, page, fetchComments]);

  // Toggle reaction on the activity card
  const handleToggleReaction = useCallback(
    (aid: string, type: ReactionType) => {
      if (!activity || aid !== activity.id) return;

      const isRemoving = activity.userReactions.includes(type);
      const newUserReactions = isRemoving
        ? activity.userReactions.filter((r) => r !== type)
        : [...activity.userReactions, type];

      const delta = isRemoving ? -1 : 1;
      const newReactions = {
        ...activity.reactions,
        [type]: Math.max(0, (activity.reactions[type] ?? 0) + delta),
        total: Math.max(0, activity.reactions.total + delta),
      };

      setActivity({ ...activity, userReactions: newUserReactions, reactions: newReactions });

      if (isRemoving) {
        feedService.removeReaction(aid, type).catch(() => {});
      } else {
        feedService.addReaction(aid, type).catch(() => {});
      }
    },
    [activity],
  );

  // Reply
  const handleReply = useCallback((comment: FeedComment) => {
    setReplyTarget(comment);
    inputRef.current?.focus();
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  // Send comment
  const handleSend = useCallback(async () => {
    const text = commentText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    try {
      const newComment = await feedService.addComment(
        activityId,
        text,
        replyTarget?.id,
      );

      if (replyTarget) {
        // Append as reply under parent
        setComments((prev) =>
          prev.map((c) => {
            if (c.id !== replyTarget.id) return c;
            return {
              ...c,
              replies: [...(c.replies ?? []), newComment],
              replyCount: c.replyCount + 1,
            };
          }),
        );
      } else {
        setComments((prev) => [newComment, ...prev]);
      }

      // Update comment count on activity
      if (activity) {
        setActivity({ ...activity, commentCount: activity.commentCount + 1 });
      }

      setCommentText('');
      setReplyTarget(null);
    } catch {
      showToast('error', '댓글을 작성하지 못했어요');
    } finally {
      setIsSending(false);
    }
  }, [commentText, activityId, replyTarget, isSending, activity]);

  // Delete comment
  const handleDelete = useCallback(
    (commentId: string) => {
      Alert.alert(
        t('social.comment.deleteTitle'),
        t('social.comment.deleteMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await feedService.deleteComment(activityId, commentId);
        // Remove from top-level or from replies
        setComments((prev) =>
          prev
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: (c.replies ?? []).filter((r) => r.id !== commentId),
              replyCount: (c.replies ?? []).some((r) => r.id === commentId)
                ? c.replyCount - 1
                : c.replyCount,
            })),
        );
        if (activity) {
          setActivity({ ...activity, commentCount: Math.max(0, activity.commentCount - 1) });
        }
              } catch {
                showToast('error', t('social.comment.deleteFailed'));
              }
            },
          },
        ],
      );
    },
    [activityId, activity],
  );

  // Render
  const renderComment = useCallback(
    ({ item }: { item: FeedComment }) => (
      <CommentItem
        comment={item}
        currentUserId={currentUser?.id}
        colors={colors}
        onReply={handleReply}
        onDelete={handleDelete}
      />
    ),
    [currentUser, colors, handleReply, handleDelete],
  );

  const keyExtractor = useCallback((item: FeedComment) => item.id, []);

  const ListHeader = useMemo(() => {
    if (!activity) return null;
    return (
      <View style={s.activityCardWrapper}>
        <ActivityCard
          activity={activity}
          onToggleReaction={handleToggleReaction}
        />
        <View style={s.commentsSectionHeader}>
          <Text style={s.commentsSectionTitle}>
            댓글 {activity.commentCount > 0 ? activity.commentCount : ''}
          </Text>
        </View>
      </View>
    );
  }, [activity, handleToggleReaction, s]);

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>게시글</Text>
        <View style={s.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Comment list */}
        <FlatList
          data={comments}
          renderItem={renderComment}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            isLoading ? (
              <View style={s.loadingContainer}>
                <ActivityIndicator color={colors.textTertiary} />
              </View>
            ) : (
              <View style={s.emptyContainer}>
                <Text style={s.emptyText}>아직 댓글이 없어요</Text>
                <Text style={s.emptySubText}>첫 댓글을 남겨보세요</Text>
              </View>
            )
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={s.listContent}
        />

        {/* Comment input */}
        <View style={s.inputContainer}>
          {replyTarget && (
            <View style={s.replyBanner}>
              <Text style={s.replyBannerText} numberOfLines={1}>
                {replyTarget.userNickname}님에게 답글
              </Text>
              <TouchableOpacity onPress={handleCancelReply}>
                <Ionicons name="close" size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          )}
          <View style={s.inputRow}>
            <TextInput
              ref={inputRef}
              style={s.textInput}
              placeholder={t('social.comment.placeholder')}
              placeholderTextColor={colors.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                s.sendButton,
                (!commentText.trim() || isSending) && s.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!commentText.trim() || isSending}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Ionicons name="send" size={18} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---- Styles ----

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: SPACING.xs,
    },
    headerTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    headerRight: {
      width: 32,
    },
    // Activity card wrapper
    activityCardWrapper: {
      paddingBottom: SPACING.sm,
    },
    commentsSectionHeader: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    commentsSectionTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    // List
    listContent: {
      paddingBottom: SPACING.md,
    },
    loadingContainer: {
      paddingVertical: SPACING.xxl,
      alignItems: 'center',
    },
    emptyContainer: {
      paddingVertical: SPACING.xxl,
      alignItems: 'center',
      gap: SPACING.xs,
    },
    emptyText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    emptySubText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textTertiary,
    },
    // Comment
    commentContainer: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    replyContainer: {
      paddingLeft: 0,
      paddingRight: 0,
      marginTop: SPACING.sm,
    },
    commentAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    replyAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    commentAvatarPlaceholder: {
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    commentAvatarText: {
      color: colors.white,
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
    },
    commentBody: {
      flex: 1,
    },
    commentHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    commentNickname: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: colors.text,
    },
    commentTime: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
    },
    commentContent: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      lineHeight: 20,
      marginTop: 2,
    },
    commentActions: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.xs,
    },
    commentActionText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: colors.textTertiary,
    },
    commentDeleteText: {
      color: colors.error ?? '#E53E3E',
    },
    repliesSection: {
      marginTop: SPACING.xs,
      borderLeftWidth: 2,
      borderLeftColor: colors.border,
      paddingLeft: SPACING.sm,
    },
    // Input
    inputContainer: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
      paddingBottom: Platform.OS === 'ios' ? SPACING.md : SPACING.sm,
    },
    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xs,
      backgroundColor: colors.surface,
    },
    replyBannerText: {
      fontSize: FONT_SIZES.xs,
      color: colors.textSecondary,
      flex: 1,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.sm,
      gap: SPACING.sm,
    },
    textInput: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      fontSize: FONT_SIZES.sm,
      color: colors.text,
      maxHeight: 100,
    },
    sendButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
