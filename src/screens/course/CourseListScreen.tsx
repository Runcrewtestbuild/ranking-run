import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '../../lib/icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCourseListStore } from '../../stores/courseListStore';
import EmptyState from '../../components/common/EmptyState';
import CourseThumbnailMap from '../../components/course/CourseThumbnailMap';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import type { CourseStackParamList } from '../../types/navigation';
import type { CourseListItem, CourseListParams, FavoriteCourseItem } from '../../types/api';
import { formatDistance, formatNumber } from '../../utils/format';
import {
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  inferDifficulty,
  getDifficultyLabel,
} from '../../utils/constants';

// ---- Types ----

type CourseNav = NativeStackNavigationProp<CourseStackParamList, 'CourseList'>;

type SortMode = 'all' | 'popular' | 'newest' | 'nearby' | 'distance';

interface DistanceFilter {
  key: string;
  labelKey: string;
  maxDistance?: number; // meters, undefined = no filter
}

// ---- Constants ----

const OVERLAY_CARD_WIDTH = 200;
const OVERLAY_CARD_HEIGHT = 160;
const ROW_THUMB_SIZE = 56;

const DIFF_COLOR: Record<string, string> = {
  easy: '#6EE7A0',
  normal: '#FBBF54',
  hard: '#F87171',
  expert: '#F87171',
  legend: '#A78BFA',
};

const SORT_TABS: { key: SortMode; labelKey: string }[] = [
  { key: 'all', labelKey: 'course.sortAll' },
  { key: 'popular', labelKey: 'course.sortPopular' },
  { key: 'newest', labelKey: 'course.sortNewest' },
  { key: 'nearby', labelKey: 'course.sortNearby' },
  { key: 'distance', labelKey: 'course.sortDistance' },
];

const DISTANCE_FILTERS: DistanceFilter[] = [
  { key: 'all', labelKey: 'course.filterAll' },
  { key: '3k', labelKey: 'course.filter3k', maxDistance: 3000 },
  { key: '5k', labelKey: 'course.filter5kBelow', maxDistance: 5000 },
  { key: '10k', labelKey: 'course.filter10kBelow', maxDistance: 10000 },
  { key: 'half', labelKey: 'course.filterHalfBelow', maxDistance: 21100 },
  { key: 'full', labelKey: 'course.filterFull', maxDistance: 42200 },
];

// ---- Helpers ----

function buildFetchParams(
  sortMode: SortMode,
  distanceAsc: boolean,
  activeFilter: DistanceFilter,
  userLat?: number,
  userLng?: number,
): CourseListParams {
  const params: CourseListParams = { per_page: 20 };

  switch (sortMode) {
    case 'popular':
      params.order_by = 'total_runs';
      params.order = 'desc';
      break;
    case 'newest':
      params.order_by = 'created_at';
      params.order = 'desc';
      break;
    case 'nearby':
      params.order_by = 'distance_from_user';
      params.order = 'asc';
      if (userLat != null && userLng != null) {
        params.near_lat = userLat;
        params.near_lng = userLng;
      }
      break;
    case 'distance':
      params.order_by = 'distance_meters';
      params.order = distanceAsc ? 'asc' : 'desc';
      break;
    case 'all':
    default:
      params.order_by = 'total_runs';
      params.order = 'desc';
      break;
  }

  if (activeFilter.maxDistance) {
    params.max_distance = activeFilter.maxDistance;
  }

  return params;
}

// ---- Main Screen ----

export default function CourseListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<CourseNav>();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Sort & filter state
  const [sortMode, setSortMode] = useState<SortMode>('all');
  const [distanceAsc, setDistanceAsc] = useState(true);
  const [activeFilter, setActiveFilter] = useState<DistanceFilter>(DISTANCE_FILTERS[0]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat] = useState<number | undefined>(undefined);
  const [userLng, setUserLng] = useState<number | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLat(loc.coords.latitude);
          setUserLng(loc.coords.longitude);
        }
      } catch {}
    })();
  }, []);

  // Store
  const allCourses = useCourseListStore((s) => s.allCourses);
  const isLoadingAll = useCourseListStore((s) => s.isLoadingAll);
  const isLoadingMoreAll = useCourseListStore((s) => s.isLoadingMoreAll);
  const allHasNext = useCourseListStore((s) => s.allHasNext);
  const favoriteCourses = useCourseListStore((s) => s.favoriteCourses);
  const fetchAllCourses = useCourseListStore((s) => s.fetchAllCourses);
  const fetchMoreAllCourses = useCourseListStore((s) => s.fetchMoreAllCourses);
  const fetchFavoriteCourses = useCourseListStore((s) => s.fetchFavoriteCourses);

  // Build params from current sort/filter state
  const currentParams = useMemo(
    () => buildFetchParams(sortMode, distanceAsc, activeFilter, userLat, userLng),
    [sortMode, distanceAsc, activeFilter, userLat, userLng],
  );

  // Initial load
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchAllCourses(currentParams);
      fetchFavoriteCourses();
    });
    return () => task.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when sort/filter changes
  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    fetchAllCourses(currentParams);
  }, [currentParams, fetchAllCourses]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchAllCourses(currentParams),
      fetchFavoriteCourses(),
    ]);
    setRefreshing(false);
  }, [fetchAllCourses, fetchFavoriteCourses, currentParams]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMoreAll && allHasNext) {
      fetchMoreAllCourses(currentParams);
    }
  }, [isLoadingMoreAll, allHasNext, fetchMoreAllCourses, currentParams]);

  const handleCoursePress = useCallback(
    (courseId: string) => {
      navigation.navigate('CourseDetail', { courseId });
    },
    [navigation],
  );

  const handleSortPress = useCallback(
    (mode: SortMode) => {
      if (mode === 'distance' && sortMode === 'distance') {
        // Toggle asc/desc on repeated tap
        setDistanceAsc((prev) => !prev);
      } else {
        setSortMode(mode);
        if (mode === 'distance') {
          setDistanceAsc(true);
        }
      }
    },
    [sortMode],
  );

  const handleFilterSelect = useCallback((filter: DistanceFilter) => {
    setActiveFilter(filter);
    setFilterModalVisible(false);
  }, []);

  const isFilterActive = activeFilter.key !== 'all';

  // ---- Sort label for distance tab ----
  const getDistanceLabel = useCallback(() => {
    if (sortMode === 'distance') {
      return distanceAsc ? t('course.sortDistanceAsc') : t('course.sortDistanceDesc');
    }
    return t('course.sortDistance');
  }, [sortMode, distanceAsc, t]);

  // ---- Render helpers ----

  const renderSortTabs = () => (
    <View style={styles.sortRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortScrollContent}
      >
        {SORT_TABS.map((tab) => {
          const isActive = sortMode === tab.key;
          const label = tab.key === 'distance' ? getDistanceLabel() : t(tab.labelKey);
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.sortPill, isActive && styles.sortPillActive]}
              onPress={() => handleSortPress(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortPillText, isActive && styles.sortPillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={[styles.filterBtn, isFilterActive && styles.filterBtnActive]}
        onPress={() => setFilterModalVisible(true)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Ionicons
          name={isFilterActive ? 'funnel' : 'funnel-outline'}
          size={18}
          color={isFilterActive ? '#FFFFFF' : colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );

  const renderFavoritesSection = () => {
    if (favoriteCourses.length === 0) return null;
    return (
      <View style={styles.favoritesSection}>
        <View style={styles.favoritesTitleRow}>
          <View style={[styles.sectionIconBadge, { backgroundColor: '#FF3B3018' }]}>
            <Ionicons name="heart" size={14} color="#FF3B30" />
          </View>
          <Text style={styles.favoritesTitle}>{t('course.favorites')}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.overlayScrollContent}
        >
          {favoriteCourses.map((course: FavoriteCourseItem) => (
            <OverlayCard
              key={course.id}
              id={course.id}
              title={course.title}
              distanceMeters={course.distance_meters}
              totalRuns={course.total_runs ?? 0}
              routePreview={course.route_preview ?? []}
              thumbnailUrl={course.thumbnail_url}
              onPress={() => handleCoursePress(course.id)}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderCourseItem = useCallback(
    ({ item }: { item: CourseListItem }) => (
      <CourseRowCard
        course={item}
        onPress={() => handleCoursePress(item.id)}
      />
    ),
    [handleCoursePress],
  );

  const renderListHeader = () => (
    <>
      {renderFavoritesSection()}
      {allCourses.length === 0 && !isLoadingAll && (
        <View style={styles.emptyContainer}>
          <EmptyState
            ionicon="walk-outline"
            title={t('course.emptyAll')}
            description={t('course.emptyAllMsg')}
          />
        </View>
      )}
    </>
  );

  const renderListFooter = () => {
    if (!isLoadingMoreAll) return <View style={styles.bottomPadding} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const keyExtractor = useCallback((item: CourseListItem) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('course.discover')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('CourseSearch')}
          style={styles.searchBtn}
        >
          <Ionicons name="search" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Sort tabs + Filter */}
      {renderSortTabs()}

      {/* Unified course list */}
      <FlatList
        data={allCourses}
        renderItem={renderCourseItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderListHeader}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('course.sortDistance')}</Text>
            {DISTANCE_FILTERS.map((filter) => {
              const isSelected = activeFilter.key === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[styles.modalOption, isSelected && styles.modalOptionActive]}
                  onPress={() => handleFilterSelect(filter)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      isSelected && styles.modalOptionTextActive,
                    ]}
                  >
                    {t(filter.labelKey)}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ---- Overlay Card (Horizontal Scroll — Favorites) ----

interface OverlayCardProps {
  id: string;
  title: string;
  distanceMeters: number;
  totalRuns: number;
  routePreview: number[][];
  thumbnailUrl?: string | null;
  onPress: () => void;
}

const OverlayCard = React.memo(function OverlayCard({
  title,
  distanceMeters,
  totalRuns,
  routePreview,
  thumbnailUrl,
  onPress,
}: OverlayCardProps) {
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.overlayCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {thumbnailUrl || (routePreview && routePreview.length >= 2) ? (
        <CourseThumbnailMap
          routePreview={routePreview}
          thumbnailUrl={thumbnailUrl}
          width={OVERLAY_CARD_WIDTH}
          height={OVERLAY_CARD_HEIGHT}
          borderRadius={BORDER_RADIUS.md}
        />
      ) : (
        <View style={styles.overlayCardPlaceholder}>
          <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.overlayCardInfo}>
        <Text style={styles.overlayCardTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.overlayCardMeta}>
          {formatDistance(distanceMeters)}
          {totalRuns > 0 && ` · ${t('course.runCount', { count: totalRuns })}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ---- Course Row Card (Vertical List) ----

const CourseRowCard = React.memo(function CourseRowCard({
  course,
  onPress,
}: {
  course: CourseListItem;
  onPress: () => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const difficulty = inferDifficulty(course.distance_meters, course.elevation_gain_meters);

  return (
    <TouchableOpacity
      style={styles.rowCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {course.thumbnail_url || (course.route_preview && course.route_preview.length >= 2) ? (
        <CourseThumbnailMap
          routePreview={course.route_preview ?? []}
          thumbnailUrl={course.thumbnail_url}
          width={ROW_THUMB_SIZE}
          height={ROW_THUMB_SIZE}
          borderRadius={BORDER_RADIUS.sm}
        />
      ) : (
        <View style={[styles.rowThumb, styles.rowThumbPlaceholder]}>
          <Ionicons name="map-outline" size={22} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>{course.title}</Text>
        <Text style={styles.vCardMeta}>
          {formatDistance(course.distance_meters)}
          <Text style={styles.vCardMetaSep}>{' · '}</Text>
          <Text style={{ color: DIFF_COLOR[difficulty] ?? colors.textSecondary }}>
            {getDifficultyLabel(difficulty)}
          </Text>
          <Text style={styles.vCardMetaSep}>{' · '}</Text>
          {'참여 ' + formatNumber(course.stats.total_runs) + '회'}
        </Text>
        <Text style={styles.rowCreator} numberOfLines={1}>{course.creator.nickname}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },

    // -- Header --
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xxl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.md,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: '900',
      color: c.text,
      letterSpacing: -1,
    },
    searchBtn: {
      width: 40,
      height: 40,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // -- Sort tabs --
    sortRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingRight: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    sortScrollContent: {
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.sm,
      flexGrow: 1,
    },
    sortPill: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    sortPillActive: {
      backgroundColor: c.text,
      borderColor: c.text,
    },
    sortPillText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: c.textSecondary,
    },
    sortPillTextActive: {
      color: c.background,
    },
    filterBtn: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    filterBtnActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },

    // -- List --
    listContent: {
      paddingHorizontal: SPACING.xxl,
      flexGrow: 1,
    },

    // -- Favorites section --
    favoritesSection: {
      marginBottom: SPACING.lg,
      marginHorizontal: -SPACING.xxl, // counteract listContent padding for full-bleed scroll
    },
    favoritesTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    sectionIconBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    favoritesTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.3,
    },
    overlayScrollContent: {
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.md,
    },

    // -- Overlay Card (map-style with overlaid info) --
    overlayCard: {
      width: OVERLAY_CARD_WIDTH,
      height: OVERLAY_CARD_HEIGHT,
      borderRadius: BORDER_RADIUS.md,
      overflow: 'hidden',
      ...SHADOWS.sm,
    },
    overlayCardPlaceholder: {
      width: OVERLAY_CARD_WIDTH,
      height: OVERLAY_CARD_HEIGHT,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: BORDER_RADIUS.md,
    },
    overlayCardInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderBottomLeftRadius: BORDER_RADIUS.md,
      borderBottomRightRadius: BORDER_RADIUS.md,
    },
    overlayCardTitle: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    overlayCardMeta: {
      fontSize: FONT_SIZES.xs,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
      fontVariant: ['tabular-nums'] as const,
    },

    // -- Row Card --
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: SPACING.sm,
      ...SHADOWS.sm,
    },
    rowThumb: {
      width: ROW_THUMB_SIZE,
      height: ROW_THUMB_SIZE,
      borderRadius: BORDER_RADIUS.sm,
      resizeMode: 'cover',
    },
    rowThumbPlaceholder: {
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    rowContent: {
      flex: 1,
      justifyContent: 'center',
      gap: 2,
    },
    rowTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
    },
    rowCreator: {
      fontSize: 12,
      fontWeight: '400',
      color: c.text,
      opacity: 0.4,
    },
    vCardMeta: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '500',
      color: c.text,
      opacity: 0.6,
      fontVariant: ['tabular-nums'] as const,
    },
    vCardMetaSep: {
      color: c.text,
      opacity: 0.25,
    },

    // -- Empty state --
    emptyContainer: {
      paddingTop: SPACING.xxxl,
    },

    // -- Footer loader --
    footerLoader: {
      paddingVertical: SPACING.xl,
      alignItems: 'center',
    },

    // -- Bottom padding --
    bottomPadding: {
      height: SPACING.xxxl + SPACING.xl,
    },

    // -- Filter Modal --
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '80%',
      maxWidth: 320,
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.xl,
      ...SHADOWS.sm,
    },
    modalTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: c.text,
      marginBottom: SPACING.lg,
      letterSpacing: -0.3,
    },
    modalOption: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      paddingHorizontal: SPACING.sm,
      borderRadius: BORDER_RADIUS.sm,
    },
    modalOptionActive: {
      backgroundColor: c.primary + '14',
    },
    modalOptionText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '500',
      color: c.text,
    },
    modalOptionTextActive: {
      fontWeight: '700',
      color: c.primary,
    },
  });
