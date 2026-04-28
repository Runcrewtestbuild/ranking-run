import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { CommunityStackParamList } from '../../types/navigation';
import type { CrewItem } from '../../types/api';
import { useTranslation } from 'react-i18next';
import { crewService } from '../../services/crewService';
import { userService } from '../../services/userService';
import {
  discoverService,
  type TrendingActivity,
  type RecommendedRunner,
  type WeeklyHighlights,
} from '../../services/discoverService';
import { useToastStore } from '../../stores/toastStore';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityFeed'>;

// ---- Section item union ----

type SectionItem =
  | { type: 'search_bar' }
  | { type: 'section_header'; title: string; icon: string }
  | { type: 'weekly_highlights'; data: WeeklyHighlights }
  | { type: 'trending_scroll'; data: TrendingActivity[] }
  | { type: 'runner_grid'; data: RecommendedRunner[] }
  | { type: 'crew_card'; data: CrewItem }
  | { type: 'empty_search'; query: string }
  | { type: 'empty_state'; message: string };

// ---- Reason tag helpers ----

const REASON_LABELS: Record<string, string> = {
  similar_pace: 'social.discover.reasonSimilarPace',
  mutual_follow: 'social.discover.reasonMutualFollow',
  same_region: 'social.discover.reasonSameRegion',
};

function formatPace(avgPace: number | null): string {
  if (!avgPace || avgPace <= 0) return '-';
  const mins = Math.floor(avgPace);
  const secs = Math.round((avgPace - mins) * 60);
  return `${mins}'${secs.toString().padStart(2, '0')}"`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}

// ---- Main Component ----

export default function DiscoverScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const showToast = useToastStore((st) => st.showToast);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CrewItem[]>([]);

  const [highlights, setHighlights] = useState<WeeklyHighlights | null>(null);
  const [trending, setTrending] = useState<TrendingActivity[]>([]);
  const [recommendedRunners, setRecommendedRunners] = useState<RecommendedRunner[]>([]);
  const [recommendedCrews, setRecommendedCrews] = useState<CrewItem[]>([]);

  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // ---- Data fetching ----

  const loadDiscoverData = useCallback(async () => {
    try {
      const [highlightsRes, trendingRes, runnersRes, crewRes] = await Promise.all([
        discoverService.getWeeklyHighlights().catch((): WeeklyHighlights => ({
          runnerCount: 0, prCount: 0, totalDistanceMeters: 0, weekStart: '',
        })),
        discoverService.getTrending(10).catch((): TrendingActivity[] => []),
        discoverService.getRecommendedRunners(10).catch((): RecommendedRunner[] => []),
        crewService.listCrews({ per_page: 6 }).catch((): { data: CrewItem[]; total_count: number } => ({
          data: [], total_count: 0,
        })),
      ]);
      setHighlights(highlightsRes);
      setTrending(trendingRes);
      setRecommendedRunners(runnersRes);
      setRecommendedCrews(crewRes.data);
    } catch {
      showToast('error', t('common.loadError'));
    }
  }, [showToast, t]);

  useEffect(() => {
    if (!initialLoaded) {
      setIsLoading(true);
      loadDiscoverData().finally(() => {
        setIsLoading(false);
        setInitialLoaded(true);
      });
    }
  }, [initialLoaded, loadDiscoverData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDiscoverData();
    setIsRefreshing(false);
  }, [loadDiscoverData]);

  // ---- Search ----

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setIsSearching(false);
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await crewService.listCrews({ search: query.trim(), per_page: 20 });
      setSearchResults(res.data);
    } catch {
      setSearchResults([]);
      showToast('error', t('common.loadError'));
    }
  }, [showToast, t]);

  // ---- Follow toggle (optimistic) ----

  const handleToggleFollow = useCallback(async (userId: string) => {
    const wasFollowing = followingSet.has(userId);

    setFollowingSet((prev) => {
      const next = new Set(prev);
      if (wasFollowing) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });

    try {
      if (wasFollowing) {
        await userService.unfollowUser(userId);
      } else {
        await userService.followUser(userId);
      }
    } catch {
      // Revert on failure
      setFollowingSet((prev) => {
        const next = new Set(prev);
        if (wasFollowing) {
          next.add(userId);
        } else {
          next.delete(userId);
        }
        return next;
      });
      showToast('error', t('common.error'));
    }
  }, [followingSet, showToast, t]);

  // ---- Navigation ----

  const handleCrewPress = useCallback(
    (crewId: string) => navigation.navigate('CrewDetail', { crewId }),
    [navigation],
  );

  const handleActivityPress = useCallback(
    (activityId: string) => navigation.navigate('FeedDetail', { activityId }),
    [navigation],
  );

  const handleRunnerPress = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  );

  // ---- Build section data ----

  const sections: SectionItem[] = useMemo(() => {
    const items: SectionItem[] = [];
    items.push({ type: 'search_bar' });

    // Search mode
    if (isSearching) {
      if (searchResults.length === 0) {
        items.push({ type: 'empty_search', query: searchQuery });
      } else {
        items.push({
          type: 'section_header',
          title: t('social.discover.searchResultTitle', { query: searchQuery }),
          icon: 'search',
        });
        searchResults.forEach((crew) => {
          items.push({ type: 'crew_card', data: crew });
        });
      }
      return items;
    }

    // Section 1: Weekly Highlights
    if (highlights) {
      items.push({ type: 'section_header', title: t('social.discover.weeklyHighlights'), icon: 'flame' });
      items.push({ type: 'weekly_highlights', data: highlights });
    }

    // Section 2: Trending Activities
    if (trending.length > 0) {
      items.push({ type: 'section_header', title: t('social.discover.trendingActivities'), icon: 'trending-up' });
      items.push({ type: 'trending_scroll', data: trending });
    }

    // Section 3: Recommended Runners
    if (recommendedRunners.length > 0) {
      items.push({ type: 'section_header', title: t('social.discover.recommendedRunners'), icon: 'person-add' });
      items.push({ type: 'runner_grid', data: recommendedRunners });
    }

    // Section 4: Recommended Crews
    if (recommendedCrews.length > 0) {
      items.push({ type: 'section_header', title: t('social.discover.recommendedCrews'), icon: 'people' });
      recommendedCrews.forEach((crew) => {
        items.push({ type: 'crew_card', data: crew });
      });
    }

    return items;
  }, [isSearching, searchQuery, searchResults, highlights, trending, recommendedRunners, recommendedCrews, t]);

  // ---- Sub-renderers ----

  const renderHighlights = useCallback(
    (data: WeeklyHighlights) => (
      <View style={s.highlightsRow}>
        <View style={[s.highlightCard, { backgroundColor: colors.primary + '14' }]}>
          <Ionicons name="person" size={20} color={colors.primary} />
          <Text style={s.highlightValue}>{data.runnerCount}</Text>
          <Text style={s.highlightLabel}>{t('social.discover.highlightRunners')}</Text>
        </View>
        <View style={[s.highlightCard, { backgroundColor: '#FFD16614' }]}>
          <Ionicons name="trophy" size={20} color="#FFD166" />
          <Text style={s.highlightValue}>{data.prCount}</Text>
          <Text style={s.highlightLabel}>{t('social.discover.highlightPRs')}</Text>
        </View>
        <View style={[s.highlightCard, { backgroundColor: colors.success + '14' }]}>
          <Ionicons name="footsteps" size={20} color={colors.success} />
          <Text style={s.highlightValue}>{(data.totalDistanceMeters / 1000).toFixed(0)}</Text>
          <Text style={s.highlightLabel}>{t('social.discover.highlightDistance')}</Text>
        </View>
      </View>
    ),
    [s, colors, t],
  );

  const renderTrendingScroll = useCallback(
    (data: TrendingActivity[]) => (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.trendingScrollContent}
      >
        {data.map((activity) => (
          <TouchableOpacity
            key={activity.id}
            style={s.trendingCard}
            onPress={() => handleActivityPress(activity.id)}
            activeOpacity={0.7}
          >
            {activity.user.avatarUrl ? (
              <Image source={{ uri: activity.user.avatarUrl }} style={s.trendingAvatar} />
            ) : (
              <View style={[s.trendingAvatar, s.trendingAvatarPlaceholder]}>
                <Ionicons name="person" size={16} color={colors.textTertiary} />
              </View>
            )}
            <Text style={s.trendingNickname} numberOfLines={1}>{activity.user.nickname}</Text>
            <Text style={s.trendingActivityType} numberOfLines={1}>
              {activity.activityType === 'run' ? t('social.discover.activityRun') : activity.activityType}
            </Text>
            {activity.runSummary && (
              <Text style={s.trendingDistance}>
                {formatDistance(activity.runSummary.distanceMeters)}
              </Text>
            )}
            <View style={s.trendingFooter}>
              <Ionicons name="heart" size={12} color={colors.primary} />
              <Text style={s.trendingLikeCount}>{activity.likeCount}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    ),
    [s, colors, t, handleActivityPress],
  );

  const renderRunnerGrid = useCallback(
    (runners: RecommendedRunner[]) => (
      <View style={s.runnerGrid}>
        {runners.map((runner) => {
          const isFollowing = followingSet.has(runner.id);
          const reasonKey = REASON_LABELS[runner.reason];
          let reasonText = '';
          if (reasonKey) {
            reasonText =
              runner.reason === 'mutual_follow' && runner.mutualCount
                ? t(reasonKey, { count: runner.mutualCount })
                : t(reasonKey);
          }

          return (
            <TouchableOpacity
              key={runner.id}
              style={s.runnerCard}
              onPress={() => handleRunnerPress(runner.id)}
              activeOpacity={0.7}
            >
              {runner.avatarUrl ? (
                <Image source={{ uri: runner.avatarUrl }} style={s.runnerAvatar} />
              ) : (
                <View style={[s.runnerAvatar, s.runnerAvatarPlaceholder]}>
                  <Ionicons name="person" size={22} color={colors.textTertiary} />
                </View>
              )}
              <Text style={s.runnerNickname} numberOfLines={1}>{runner.nickname}</Text>
              <Text style={s.runnerStat} numberOfLines={1}>
                {runner.avgPace
                  ? `${formatPace(runner.avgPace)} /km`
                  : formatDistance(runner.totalDistanceMeters)}
              </Text>
              {reasonText !== '' && (
                <View style={s.reasonBadge}>
                  <Text style={s.reasonBadgeText}>{reasonText}</Text>
                </View>
              )}
              <TouchableOpacity
                style={[s.followButton, isFollowing && s.followButtonActive]}
                onPress={(e) => {
                  e.stopPropagation?.();
                  handleToggleFollow(runner.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[s.followButtonText, isFollowing && s.followButtonTextActive]}>
                  {isFollowing ? t('social.discover.following') : t('social.discover.follow')}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        })}
      </View>
    ),
    [s, colors, t, followingSet, handleRunnerPress, handleToggleFollow],
  );

  // ---- Render items ----

  const renderItem = useCallback(
    ({ item }: { item: SectionItem }) => {
      switch (item.type) {
        case 'search_bar':
          return (
            <View style={s.searchContainer}>
              <View style={s.searchBar}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={s.searchInput}
                  placeholder={t('social.discover.searchPlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => handleSearch('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );

        case 'section_header':
          return (
            <View style={s.sectionHeader}>
              <Ionicons
                name={item.icon as keyof typeof Ionicons.glyphMap}
                size={20}
                color={colors.primary}
              />
              <Text style={s.sectionTitle}>{item.title}</Text>
            </View>
          );

        case 'weekly_highlights':
          return renderHighlights(item.data);

        case 'trending_scroll':
          return renderTrendingScroll(item.data);

        case 'runner_grid':
          return renderRunnerGrid(item.data);

        case 'crew_card':
          return (
            <TouchableOpacity
              style={s.crewCard}
              onPress={() => handleCrewPress(item.data.id)}
              activeOpacity={0.7}
            >
              {item.data.logo_url ? (
                <Image source={{ uri: item.data.logo_url }} style={s.crewLogo} />
              ) : (
                <View style={[s.crewLogo, s.crewLogoPlaceholder, { backgroundColor: item.data.badge_color + '30' }]}>
                  <Text style={{ fontSize: 20 }}>{item.data.badge_icon || '\uD83C\uDFC3'}</Text>
                </View>
              )}
              <View style={s.crewInfo}>
                <Text style={s.crewName} numberOfLines={1}>{item.data.name}</Text>
                <Text style={s.crewMeta} numberOfLines={1}>
                  {item.data.region ? `${item.data.region} \u00B7 ` : ''}
                  {t('social.discover.memberCount', { count: item.data.member_count })}
                </Text>
                {item.data.description && (
                  <Text style={s.crewDesc} numberOfLines={1}>{item.data.description}</Text>
                )}
              </View>
              {!item.data.is_member && (
                <View style={s.joinHint}>
                  <Text style={s.joinHintText}>{t('social.discover.join')}</Text>
                </View>
              )}
            </TouchableOpacity>
          );

        case 'empty_search':
          return (
            <View style={s.emptySearch}>
              <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
              <Text style={s.emptySearchTitle}>
                {t('social.discover.emptySearchTitle', { query: item.query })}
              </Text>
              <Text style={s.emptySearchSubtitle}>{t('social.discover.emptySearchHint')}</Text>
            </View>
          );

        case 'empty_state':
          return (
            <View style={s.emptySearch}>
              <Text style={s.emptySearchSubtitle}>{item.message}</Text>
            </View>
          );

        default:
          return null;
      }
    },
    [s, colors, t, searchQuery, handleSearch, handleCrewPress, renderHighlights, renderTrendingScroll, renderRunnerGrid],
  );

  const keyExtractor = useCallback(
    (item: SectionItem, index: number) => {
      switch (item.type) {
        case 'crew_card':
          return `crew-${item.data.id}`;
        default:
          return `${item.type}-${index}`;
      }
    },
    [],
  );

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
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
      />

      {/* Initial loading */}
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
      paddingBottom: SPACING.huge,
    },

    // Search
    searchContainer: {
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: BORDER_RADIUS.full,
      paddingHorizontal: SPACING.lg,
      height: 44,
      gap: SPACING.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: FONT_SIZES.md,
      color: c.text,
      paddingVertical: 0,
    },

    // Section header
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.md,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
    },

    // Weekly Highlights
    highlightsRow: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    highlightCard: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      gap: SPACING.xs,
    },
    highlightValue: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      color: c.text,
    },
    highlightLabel: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '500',
      color: c.textSecondary,
      textAlign: 'center',
    },

    // Trending scroll
    trendingScrollContent: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    trendingCard: {
      width: 130,
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      alignItems: 'center',
      gap: SPACING.xs,
      ...SHADOWS.sm,
    },
    trendingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    trendingAvatarPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendingNickname: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: c.text,
      maxWidth: 110,
    },
    trendingActivityType: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
    },
    trendingDistance: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: c.primary,
    },
    trendingFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: SPACING.xs,
    },
    trendingLikeCount: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
    },

    // Runner grid
    runnerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    runnerCard: {
      width: (Dimensions.get('window').width - SPACING.lg * 2 - SPACING.sm) / 2,
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      alignItems: 'center',
      gap: SPACING.xs,
      ...SHADOWS.sm,
    },
    runnerAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },
    runnerAvatarPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    runnerNickname: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
      marginTop: SPACING.xs,
    },
    runnerStat: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
    },
    reasonBadge: {
      backgroundColor: c.primary + '14',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
      marginTop: SPACING.xs,
    },
    reasonBadgeText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: c.primary,
    },
    followButton: {
      marginTop: SPACING.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: c.primary,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    followButtonActive: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    followButtonText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    followButtonTextActive: {
      color: c.textSecondary,
    },

    // Crew card
    crewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      padding: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.sm,
    },
    crewLogo: {
      width: 48,
      height: 48,
      borderRadius: 24,
      marginRight: SPACING.md,
    },
    crewLogoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    crewInfo: {
      flex: 1,
    },
    crewName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
    },
    crewMeta: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      marginTop: 2,
    },
    crewDesc: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
      marginTop: SPACING.xs,
    },
    joinHint: {
      backgroundColor: c.primary + '18',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    joinHintText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: c.primary,
    },

    // Empty search
    emptySearch: {
      alignItems: 'center',
      paddingTop: 80,
      gap: SPACING.sm,
    },
    emptySearchTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
      marginTop: SPACING.md,
    },
    emptySearchSubtitle: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
    },

    // Loader
    initialLoader: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.background,
    },
  });
