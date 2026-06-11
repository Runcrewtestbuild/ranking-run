import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import type { FeedActivity, ReactionType } from '../../types/feed';
import { feedService } from '../../services/feedService';
import { useToastStore } from '../../stores/toastStore';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import {
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  PAGINATION,
} from '../../utils/constants';
import * as Haptics from 'expo-haptics';
import ActivityCard from '../../components/social/ActivityCard';
import VersusScreen from './VersusScreen';
import CrewFeedScreen from './CrewFeedScreen';
import DiscoverScreen from './DiscoverScreen';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityFeed'>;

// ---- Tab definitions ----

type SocialTab = 'feed' | 'battle' | 'crew' | 'explore';

interface TabDef {
  key: SocialTab;
  label: string;
}

const TAB_KEYS: { key: SocialTab; i18nKey: string }[] = [
  { key: 'feed', i18nKey: 'social.tabs.feed' },
  { key: 'battle', i18nKey: 'social.tabs.battle' },
  { key: 'crew', i18nKey: 'social.tabs.crew' },
  { key: 'explore', i18nKey: 'social.tabs.explore' },
];

// ---- Main Screen ----

export default function ActivityFeedScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const showToast = useToastStore((s) => s.showToast);
  const s = useMemo(() => createStyles(colors), [colors]);

  // Tab state
  const [activeTab, setActiveTab] = useState<SocialTab>('feed');

  // Feed state
  const [feedScope, setFeedScope] = useState<'all' | 'following'>('all');
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loadingMore = useRef(false);

  // ---- Data fetching ----

  const fetchFeed = useCallback(
    async (pageNum: number, append = false, scope?: 'all' | 'following') => {
      const currentScope = scope ?? feedScope;
      try {
        const res = await feedService.getFeed(pageNum, PAGINATION.DEFAULT_PAGE_SIZE, currentScope);
        setActivities((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasNext(res.has_next);
        setPage(pageNum);
      } catch {
        // On error, stop pagination to prevent infinite retry loop
        setHasNext(false);
        if (!append) {
          showToast('error', '피드를 불러오지 못했어요');
        }
      }
    },
    [],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchFeed(0, false, feedScope);
    setIsRefreshing(false);
  }, [fetchFeed, feedScope]);

  const handleScopeChange = useCallback((scope: 'all' | 'following') => {
    Haptics.selectionAsync();
    setFeedScope(scope);
    setActivities([]);
    setPage(0);
    setHasNext(true);
    setInitialLoaded(false);
    setIsLoading(true);
    fetchFeed(0, false, scope).finally(() => {
      setIsLoading(false);
      setInitialLoaded(true);
    });
  }, [fetchFeed]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNext || loadingMore.current || !initialLoaded) return;
    if (activities.length === 0) return; // Don't paginate on empty list
    loadingMore.current = true;
    setIsLoading(true);
    await fetchFeed(page + 1, true);
    setIsLoading(false);
    loadingMore.current = false;
  }, [hasNext, page, fetchFeed, initialLoaded, activities.length]);

  // Initial load — run once
  useEffect(() => {
    setIsLoading(true);
    fetchFeed(0).finally(() => {
      setIsLoading(false);
      setInitialLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Optimistic reactions ----

  const handleToggleReaction = useCallback(
    (activityId: string, type: ReactionType) => {
      setActivities((prev) =>
        prev.map((a) => {
          if (a.id !== activityId) return a;

          const isRemoving = a.userReactions.includes(type);
          const newUserReactions = isRemoving
            ? a.userReactions.filter((r) => r !== type)
            : [...a.userReactions, type];

          const delta = isRemoving ? -1 : 1;
          const newReactions = {
            ...a.reactions,
            [type]: Math.max(0, a.reactions[type] + delta),
            total: Math.max(0, a.reactions.total + delta),
          };

          return { ...a, userReactions: newUserReactions, reactions: newReactions };
        }),
      );

      // Fire-and-forget server sync
      const activity = activities.find((a) => a.id === activityId);
      if (!activity) return;

      if (activity.userReactions.includes(type)) {
        feedService.removeReaction(activityId, type).catch(() => {});
      } else {
        feedService.addReaction(activityId, type).catch(() => {});
      }
    },
    [activities],
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  const handleCreatePost = useCallback(() => {
    navigation.navigate('CommunityPostCreate');
  }, [navigation]);

  const handleCommentPress = useCallback(
    (activityId: string) => {
      navigation.navigate('FeedDetail', { activityId });
    },
    [navigation],
  );

  // ---- Render helpers ----

  const renderItem = useCallback(
    ({ item }: { item: FeedActivity }) => (
      <ActivityCard
        activity={item}
        onToggleReaction={handleToggleReaction}
        onUserPress={handleUserPress}
        onCommentPress={handleCommentPress}
      />
    ),
    [handleToggleReaction, handleUserPress, handleCommentPress],
  );

  const keyExtractor = useCallback((item: FeedActivity) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!isLoading || !initialLoaded) return null;
    return (
      <View style={s.footerLoader}>
        <ActivityIndicator color={colors.textTertiary} size="small" />
      </View>
    );
  }, [isLoading, initialLoaded, s, colors]);

  const renderEmptyState = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={s.emptyContainer}>
        <Ionicons name="newspaper-outline" size={48} color={colors.textTertiary} />
        <Text style={s.emptyTitle}>{t('social.feed.empty')}</Text>
        <Text style={s.emptySubtitle}>
          {t('social.feed.emptyHint')}
        </Text>
      </View>
    );
  }, [isLoading, s, colors]);

  // ---- Placeholder for non-active tabs ----

  const renderPlaceholder = useCallback(
    (tab: SocialTab) => (
      <View style={s.placeholderContainer}>
        <Ionicons
          name={
            tab === 'battle'
              ? 'flash-outline'
              : tab === 'crew'
                ? 'people-outline'
                : 'compass-outline'
          }
          size={48}
          color={colors.textTertiary}
        />
        <Text style={s.placeholderTitle}>
          {t(TAB_KEYS.find((tk) => tk.key === tab)?.i18nKey ?? '')} {t('social.tabs.comingSoon')}
        </Text>
        <Text style={s.placeholderSubtitle}>{t('social.tabs.comingSoonHint')}</Text>
      </View>
    ),
    [s, colors],
  );

  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        {TAB_KEYS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[s.tab, isActive && s.tabActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab.key);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  s.tabText,
                  isActive ? s.tabTextActive : s.tabTextInactive,
                ]}
              >
                {t(tab.i18nKey)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === 'feed' && (
        <View style={s.feedContainer}>
          {/* Scope filter */}
          <View style={s.scopeBar}>
            <TouchableOpacity
              style={[s.scopeBtn, feedScope === 'all' && s.scopeBtnActive]}
              onPress={() => handleScopeChange('all')}
              activeOpacity={0.7}
            >
              <Text style={[s.scopeBtnText, feedScope === 'all' && s.scopeBtnTextActive]}>
                {t('social.feed.all')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.scopeBtn, feedScope === 'following' && s.scopeBtnActive]}
              onPress={() => handleScopeChange('following')}
              activeOpacity={0.7}
            >
              <Text style={[s.scopeBtnText, feedScope === 'following' && s.scopeBtnTextActive]}>
                {t('social.feed.following')}
              </Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={activities}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmptyState}
            removeClippedSubviews
            maxToRenderPerBatch={8}
            windowSize={7}
          />

          {/* FAB for post creation */}
          <TouchableOpacity
            style={s.fab}
            onPress={handleCreatePost}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={28} color="#FFF" />
          </TouchableOpacity>

          {/* Initial loading indicator */}
          {isLoading && !initialLoaded && (
            <View style={s.initialLoader}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          )}
        </View>
      )}
      {activeTab === 'battle' && <VersusScreen />}
      {activeTab === 'crew' && <CrewFeedScreen />}
      {activeTab === 'explore' && <DiscoverScreen />}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    // Tab bar
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      gap: SPACING.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    tab: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    tabActive: {
      backgroundColor: colors.text,
    },
    tabText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
    },
    tabTextActive: {
      color: colors.background,
    },
    tabTextInactive: {
      color: colors.textTertiary,
    },
    // Feed
    feedContainer: {
      flex: 1,
    },
    scopeBar: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      gap: SPACING.sm,
    },
    scopeBtn: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.xs + 2,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
    },
    scopeBtnActive: {
      backgroundColor: colors.text,
    },
    scopeBtnText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    scopeBtnTextActive: {
      color: colors.background,
    },
    hiddenTab: {
      display: 'none',
    },
    listContent: {
      paddingTop: SPACING.md,
      paddingBottom: SPACING.huge + SPACING.xxxl,
    },
    footerLoader: {
      paddingVertical: SPACING.xl,
      alignItems: 'center',
    },
    initialLoader: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    // Empty state
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 120,
      gap: SPACING.sm,
    },
    emptyTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: SPACING.md,
    },
    emptySubtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: SPACING.xxl,
    },
    // Placeholder (non-active tabs)
    placeholderContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
    },
    placeholderTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: SPACING.md,
    },
    placeholderSubtitle: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    // FAB
    fab: {
      position: 'absolute',
      right: SPACING.xl,
      bottom: SPACING.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
  });
