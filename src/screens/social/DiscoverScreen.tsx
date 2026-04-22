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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { CommunityStackParamList } from '../../types/navigation';
import type { CrewItem, CourseListItem } from '../../types/api';
import { useTranslation } from 'react-i18next';
import { crewService } from '../../services/crewService';
import { courseService } from '../../services/courseService';
import { useToastStore } from '../../stores/toastStore';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityFeed'>;

// ---- Section item union ----

type SectionItem =
  | { type: 'search_bar' }
  | { type: 'section_header'; title: string; icon: string }
  | { type: 'crew_card'; data: CrewItem }
  | { type: 'course_card'; data: CourseListItem }
  | { type: 'challenge_placeholder' }
  | { type: 'empty_search'; query: string };

// ---- Main Component ----

export default function DiscoverScreen() {
  const colors = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const showToast = useToastStore((st) => st.showToast);

  const [searchQuery, setSearchQuery] = useState('');
  const [recommendedCrews, setRecommendedCrews] = useState<CrewItem[]>([]);
  const [popularCourses, setPopularCourses] = useState<CourseListItem[]>([]);
  const [searchResults, setSearchResults] = useState<CrewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // ---- Data fetching ----

  const loadDiscoverData = useCallback(async () => {
    try {
      const [crewRes, courseRes] = await Promise.all([
        crewService.listCrews({ per_page: 6 }).catch((): { data: CrewItem[]; total_count: number } => ({ data: [], total_count: 0 })),
        courseService.getCourses({ per_page: 6, order_by: 'total_runs' }).catch((): { data: CourseListItem[]; total_count: number; has_next: boolean } => ({ data: [], total_count: 0, has_next: false })),
      ]);
      setRecommendedCrews(crewRes.data);
      setPopularCourses(courseRes.data);
    } catch {
      showToast('error', t('common.loadError'));
    }
  }, []);

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

  // ---- Navigation ----

  const handleCrewPress = useCallback(
    (crewId: string) => navigation.navigate('CrewDetail', { crewId }),
    [navigation],
  );

  const handleCoursePress = useCallback(
    (courseId: string) => navigation.navigate('CourseDetail', { courseId }),
    [navigation],
  );

  // ---- Build section data ----

  const sections: SectionItem[] = useMemo(() => {
    const items: SectionItem[] = [];
    items.push({ type: 'search_bar' });

    if (isSearching) {
      if (searchResults.length === 0) {
        items.push({ type: 'empty_search', query: searchQuery });
      } else {
        items.push({ type: 'section_header', title: t('social.discover.searchResultTitle', { query: searchQuery }), icon: 'search' });
        searchResults.forEach((crew) => {
          items.push({ type: 'crew_card', data: crew });
        });
      }
      return items;
    }

    // Recommended crews
    if (recommendedCrews.length > 0) {
      items.push({ type: 'section_header', title: t('social.discover.recommendedCrews'), icon: 'people' });
      recommendedCrews.forEach((crew) => {
        items.push({ type: 'crew_card', data: crew });
      });
    }

    // Popular courses
    if (popularCourses.length > 0) {
      items.push({ type: 'section_header', title: t('social.discover.popularCourses'), icon: 'map' });
      popularCourses.forEach((course) => {
        items.push({ type: 'course_card', data: course });
      });
    }

    // Challenge section placeholder
    items.push({ type: 'section_header', title: t('social.discover.challenges'), icon: 'trophy' });
    items.push({ type: 'challenge_placeholder' });

    return items;
  }, [isSearching, searchQuery, searchResults, recommendedCrews, popularCourses, t]);

  // ---- Render ----

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

        case 'course_card':
          return (
            <TouchableOpacity
              style={s.courseCard}
              onPress={() => handleCoursePress(item.data.id)}
              activeOpacity={0.7}
            >
              {item.data.thumbnail_url ? (
                <Image source={{ uri: item.data.thumbnail_url }} style={s.courseThumbnail} />
              ) : (
                <View style={[s.courseThumbnail, s.courseThumbnailPlaceholder]}>
                  <Ionicons name="map-outline" size={24} color={colors.textTertiary} />
                </View>
              )}
              <View style={s.courseInfo}>
                <Text style={s.courseName} numberOfLines={1}>{item.data.title}</Text>
                <Text style={s.courseMeta} numberOfLines={1}>
                  {(item.data.distance_meters / 1000).toFixed(1)}km
                  {'  \u00B7  '}
                  {t('social.discover.totalRuns', { count: item.data.stats.total_runs })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          );

        case 'challenge_placeholder':
          return (
            <View style={s.challengePlaceholder}>
              <Ionicons name="trophy-outline" size={36} color={colors.textTertiary} />
              <Text style={s.challengeText}>{t('social.discover.challengeComingSoon')}</Text>
              <Text style={s.challengeSubtext}>{t('social.discover.challengeHint')}</Text>
            </View>
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

        default:
          return null;
      }
    },
    [s, colors, t, searchQuery, handleSearch, handleCrewPress, handleCoursePress],
  );

  const keyExtractor = useCallback(
    (item: SectionItem, index: number) => {
      switch (item.type) {
        case 'crew_card':
          return `crew-${item.data.id}`;
        case 'course_card':
          return `course-${item.data.id}`;
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
    // Course card
    courseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.lg,
      ...SHADOWS.sm,
    },
    courseThumbnail: {
      width: 56,
      height: 56,
      borderRadius: BORDER_RADIUS.md,
      marginRight: SPACING.md,
    },
    courseThumbnailPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseInfo: {
      flex: 1,
    },
    courseName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    courseMeta: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      marginTop: 2,
    },
    // Challenge placeholder
    challengePlaceholder: {
      alignItems: 'center',
      paddingVertical: SPACING.xxxl,
      paddingHorizontal: SPACING.xxl,
      marginHorizontal: SPACING.lg,
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      gap: SPACING.sm,
      ...SHADOWS.sm,
    },
    challengeText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    challengeSubtext: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
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
