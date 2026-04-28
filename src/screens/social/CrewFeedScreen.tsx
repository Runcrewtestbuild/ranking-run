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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS, PAGINATION } from '../../utils/constants';
import type { CommunityStackParamList } from '../../types/navigation';
import type {
  CrewPost,
  UpcomingGroupRun,
  CrewMiniCard,
  DiscoverCrew,
} from '../../types/crewFeed';
import { useTranslation } from 'react-i18next';
import { crewFeedService } from '../../services/crewFeedService';
import { useToastStore } from '../../stores/toastStore';
import GroupRunCard from '../../components/social/GroupRunCard';
import CrewPostCard from '../../components/social/CrewPostCard';
import CrewSelector from '../../components/social/CrewSelector';
import Button from '../../components/common/Button';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityFeed'>;

// ---- Section item union for FlatList ----

type SectionItem =
  | { type: 'upcoming_header' }
  | { type: 'upcoming_run'; data: UpcomingGroupRun }
  | { type: 'crew_selector_header' }
  | { type: 'crew_selector'; data: CrewMiniCard[] }
  | { type: 'feed_header'; crewName: string }
  | { type: 'post'; data: CrewPost }
  | { type: 'empty_posts' }
  | { type: 'empty_crew' }
  | { type: 'discover_header' }
  | { type: 'discover_crew'; data: DiscoverCrew };

// ---- Main Component ----

export default function CrewFeedScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const showToast = useToastStore((st) => st.showToast);

  // State
  const [myCrews, setMyCrews] = useState<CrewMiniCard[]>([]);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);
  const [upcomingRuns, setUpcomingRuns] = useState<UpcomingGroupRun[]>([]);
  const [posts, setPosts] = useState<CrewPost[]>([]);
  const [recommendedCrews, setRecommendedCrews] = useState<DiscoverCrew[]>([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const loadingMore = useRef(false);

  const hasCrews = myCrews.length > 0;

  // ---- Data fetching ----

  const loadInitialData = useCallback(async () => {
    try {
      const crews = await crewFeedService.getMyCrewCards().catch(() => [] as CrewMiniCard[]);
      setMyCrews(crews);

      if (crews.length > 0) {
        const firstId = crews[0].id;
        setSelectedCrewId(firstId);
        // Load upcoming runs for first crew
        const runs = await crewFeedService.getUpcomingGroupRuns(firstId).catch(() => [] as UpcomingGroupRun[]);
        setUpcomingRuns(runs);
        return firstId;
      } else {
        const recommended = await crewFeedService.getRecommendedCrews().catch(() => [] as DiscoverCrew[]);
        setRecommendedCrews(recommended);
        return null;
      }
    } catch {
      showToast('error', t('common.loadError'));
      return null;
    }
  }, [showToast, t]);

  const loadPosts = useCallback(
    async (crewId: string, pageNum: number, append = false) => {
      try {
        const res = await crewFeedService.getCrewPosts(crewId, pageNum, PAGINATION.DEFAULT_PAGE_SIZE);
        setPosts((prev) => (append ? [...prev, ...res.data] : res.data));
        setHasNext(res.has_next);
        setPage(pageNum);
      } catch {
        showToast('error', t('social.crewFeed.errorLoadPosts'));
      }
    },
    [showToast, t],
  );

  // Initial load
  useEffect(() => {
    if (!initialLoaded) {
      setIsLoading(true);
      loadInitialData()
        .then((crewId) => {
          if (crewId) {
            return loadPosts(crewId, 0);
          }
        })
        .finally(() => {
          setIsLoading(false);
          setInitialLoaded(true);
        });
    }
  }, [initialLoaded, loadInitialData, loadPosts]);

  // When selected crew changes
  useEffect(() => {
    if (selectedCrewId && initialLoaded) {
      setIsLoading(true);
      setPosts([]);
      loadPosts(selectedCrewId, 0).finally(() => setIsLoading(false));
    }
  }, [selectedCrewId, initialLoaded, loadPosts]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const crewId = await loadInitialData();
    if (crewId) {
      await loadPosts(crewId, 0);
    }
    setIsRefreshing(false);
  }, [loadInitialData, loadPosts]);

  const handleLoadMore = useCallback(async () => {
    if (!hasNext || loadingMore.current || !selectedCrewId) return;
    loadingMore.current = true;
    await loadPosts(selectedCrewId, page + 1, true);
    loadingMore.current = false;
  }, [hasNext, selectedCrewId, page, loadPosts]);

  // ---- Actions ----

  const handleToggleGroupRunJoin = useCallback(
    async (runId: string, currentlyJoined: boolean) => {
      // Optimistic update
      setUpcomingRuns((prev) =>
        prev.map((r) =>
          r.id === runId
            ? {
                ...r,
                isJoined: !currentlyJoined,
                participantCount: r.participantCount + (currentlyJoined ? -1 : 1),
              }
            : r,
        ),
      );

      try {
        if (currentlyJoined) {
          await crewFeedService.leaveGroupRun(runId);
        } else {
          await crewFeedService.joinGroupRun(runId);
        }
      } catch {
        // Revert on failure
        setUpcomingRuns((prev) =>
          prev.map((r) =>
            r.id === runId
              ? {
                  ...r,
                  isJoined: currentlyJoined,
                  participantCount: r.participantCount + (currentlyJoined ? 1 : -1),
                }
              : r,
          ),
        );
      }
    },
    [],
  );

  const handlePostLike = useCallback(
    (postId: string) => {
      // Capture current state for rollback
      const prevPosts = posts;
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked: !p.isLiked,
                likeCount: p.likeCount + (p.isLiked ? -1 : 1),
              }
            : p,
        ),
      );
      if (selectedCrewId) {
        crewFeedService.togglePostLike(selectedCrewId, postId).catch(() => {
          // Revert on failure
          setPosts(prevPosts);
        });
      }
    },
    [selectedCrewId, posts],
  );

  const handleAuthorPress = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  );

  const handleCrewSearch = useCallback(
    () => navigation.navigate('CrewSearch'),
    [navigation],
  );

  const handleCrewCreate = useCallback(
    () => navigation.navigate('CrewCreate'),
    [navigation],
  );

  const handleCrewPostCreate = useCallback(() => {
    if (selectedCrewId) {
      navigation.navigate('CommunityPostCreate', { crewId: selectedCrewId });
    }
  }, [navigation, selectedCrewId]);

  const handleCrewDetailPress = useCallback(
    (crewId: string) => navigation.navigate('CrewDetail', { crewId }),
    [navigation],
  );

  const handleGroupRunPress = useCallback(
    (groupRunId: string) => navigation.navigate('GroupRunDetail' as any, { groupRunId }),
    [navigation],
  );

  // ---- Build section list data ----

  const sections: SectionItem[] = useMemo(() => {
    const items: SectionItem[] = [];

    if (!hasCrews) {
      // Empty crew state
      items.push({ type: 'empty_crew' });
      if (recommendedCrews.length > 0) {
        items.push({ type: 'discover_header' });
        recommendedCrews.forEach((crew) => {
          items.push({ type: 'discover_crew', data: crew });
        });
      }
      return items;
    }

    // Upcoming group runs
    if (upcomingRuns.length > 0) {
      items.push({ type: 'upcoming_header' });
      upcomingRuns.forEach((run) => {
        items.push({ type: 'upcoming_run', data: run });
      });
    }

    // Crew selector
    items.push({ type: 'crew_selector_header' });
    items.push({ type: 'crew_selector', data: myCrews });

    // Feed header
    const selectedCrew = myCrews.find((c) => c.id === selectedCrewId);
    if (selectedCrew) {
      items.push({ type: 'feed_header', crewName: selectedCrew.name });
    }

    // Posts
    if (posts.length === 0 && !isLoading) {
      items.push({ type: 'empty_posts' });
    }
    posts.forEach((post) => {
      items.push({ type: 'post', data: post });
    });

    return items;
  }, [hasCrews, upcomingRuns, myCrews, selectedCrewId, posts, recommendedCrews, isLoading]);

  // ---- Render ----

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      switch (item.type) {
        case 'upcoming_header':
          return (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('social.crewFeed.upcomingGroupRuns')}</Text>
            </View>
          );

        case 'upcoming_run':
          return (
            <GroupRunCard
              groupRun={item.data}
              onToggleJoin={handleToggleGroupRunJoin}
              onPress={handleGroupRunPress}
            />
          );

        case 'crew_selector_header':
          return (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('social.crewFeed.myCrews')} ({myCrews.length})</Text>
            </View>
          );

        case 'crew_selector':
          return (
            <CrewSelector
              crews={item.data}
              selectedCrewId={selectedCrewId}
              onSelectCrew={setSelectedCrewId}
            />
          );

        case 'feed_header':
          return (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{item.crewName} {t('social.crewFeed.posts')}</Text>
            </View>
          );

        case 'post':
          return (
            <CrewPostCard
              post={item.data}
              onLike={handlePostLike}
              onAuthorPress={handleAuthorPress}
            />
          );

        case 'empty_posts':
          return (
            <View style={s.emptyPostsContainer}>
              <Ionicons name="document-text-outline" size={40} color={colors.textTertiary} />
              <Text style={s.emptyPostsText}>
                {t('social.crewFeed.emptyPosts')}
              </Text>
              <Text style={s.emptyPostsHint}>
                {t('social.crewFeed.emptyPostsHint')}
              </Text>
            </View>
          );

        case 'empty_crew':
          return (
            <View style={s.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={s.emptyTitle}>
                {t('social.crewFeed.emptyCrewTitle')}
              </Text>
              <View style={s.emptyActions}>
                <Button
                  title={t('social.crewFeed.findNearbyCrews')}
                  onPress={handleCrewSearch}
                  variant="primary"
                  leftIcon={
                    <Ionicons name="search" size={18} color="#FFFFFF" />
                  }
                  fullWidth
                />
                <View style={{ height: SPACING.sm }} />
                <Button
                  title={t('social.crewFeed.createCrew')}
                  onPress={handleCrewCreate}
                  variant="outline"
                  leftIcon={
                    <Ionicons name="sparkles" size={18} color={colors.primary} />
                  }
                  fullWidth
                />
              </View>
            </View>
          );

        case 'discover_header':
          return (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{t('social.crewFeed.recommendedCrews')}</Text>
            </View>
          );

        case 'discover_crew':
          return (
            <TouchableOpacity
              style={s.discoverCard}
              onPress={() => handleCrewDetailPress(item.data.id)}
              activeOpacity={0.7}
            >
              <View style={[s.discoverLogo, { backgroundColor: item.data.badgeColor + '30' }]}>
                <Ionicons name="people" size={24} color={item.data.badgeColor} />
              </View>
              <View style={s.discoverInfo}>
                <Text style={s.discoverName} numberOfLines={1}>
                  {item.data.name}
                </Text>
                <Text style={s.discoverMeta} numberOfLines={1}>
                  {item.data.region ? `${item.data.region} \u00B7 ` : ''}
                  {t('social.crewFeed.memberCount', { count: item.data.memberCount })}
                </Text>
                {item.data.description && (
                  <Text style={s.discoverDesc} numberOfLines={2}>
                    {item.data.description}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          );

        default:
          return null;
      }
    },
    [
      s,
      colors,
      t,
      myCrews.length,
      selectedCrewId,
      handleToggleGroupRunJoin,
      handleGroupRunPress,
      handlePostLike,
      handleAuthorPress,
      handleCrewSearch,
      handleCrewCreate,
      handleCrewDetailPress,
    ],
  );

  const keyExtractor = useCallback(
    (item: SectionItem, index: number) => {
      switch (item.type) {
        case 'upcoming_run':
          return `run-${item.data.id}`;
        case 'post':
          return `post-${item.data.id}`;
        case 'discover_crew':
          return `discover-${item.data.id}`;
        case 'crew_selector':
          return 'crew-selector';
        default:
          return `section-${item.type}-${index}`;
      }
    },
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isLoading || !initialLoaded) return null;
    return (
      <View style={s.footerLoader}>
        <ActivityIndicator color={colors.textTertiary} size="small" />
      </View>
    );
  }, [isLoading, initialLoaded, s, colors]);

  return (
    <View style={s.container}>
      <FlatList
        data={sections}
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
        removeClippedSubviews
        maxToRenderPerBatch={8}
        windowSize={7}
      />

      {/* FAB for crew post creation */}
      {hasCrews && selectedCrewId && (
        <TouchableOpacity
          style={s.fab}
          onPress={handleCrewPostCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* Initial loading overlay */}
      {isLoading && !initialLoaded && (
        <View style={s.initialLoader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </View>
  );
}

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    listContent: {
      paddingTop: SPACING.md,
      paddingBottom: SPACING.huge + SPACING.xxxl,
    },
    // Section headers
    sectionHeader: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.sm,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
    },
    // Empty posts state
    emptyPostsContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.xxl,
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.sm,
    },
    emptyPostsText: {
      fontSize: FONT_SIZES.md,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.sm,
    },
    emptyPostsHint: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      textAlign: 'center',
    },
    // Empty state
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 80,
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.md,
    },
    emptyTitle: {
      fontSize: FONT_SIZES.md,
      color: c.textSecondary,
      textAlign: 'center',
      lineHeight: FONT_SIZES.md * 1.5,
      marginTop: SPACING.md,
    },
    emptyActions: {
      width: '100%',
      marginTop: SPACING.lg,
    },
    // Discover crew card
    discoverCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.sm,
    },
    discoverLogo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.md,
    },
    discoverInfo: {
      flex: 1,
    },
    discoverName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
    },
    discoverMeta: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      marginTop: 2,
    },
    discoverDesc: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
      marginTop: SPACING.xs,
      lineHeight: FONT_SIZES.sm * 1.4,
    },
    // Footer
    footerLoader: {
      paddingVertical: SPACING.xl,
      alignItems: 'center',
    },
    initialLoader: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
    // FAB
    fab: {
      position: 'absolute',
      right: SPACING.xl,
      bottom: SPACING.xl,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.glow,
    },
  });
