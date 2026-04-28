import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useTranslation } from 'react-i18next';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCourseListStore } from '../../stores/courseListStore';
import EmptyState from '../../components/common/EmptyState';
import CourseThumbnailMap from '../../components/course/CourseThumbnailMap';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import type { CourseStackParamList } from '../../types/navigation';
import type { CourseListItem, FavoriteCourseItem } from '../../types/api';
import { formatDistance, formatNumber } from '../../utils/format';
import {
  FONT_SIZES,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  inferDifficulty,
  getDifficultyLabel,
  type DifficultyLevel,
} from '../../utils/constants';

// ---- Types ----

type CourseNav = NativeStackNavigationProp<CourseStackParamList, 'CourseList'>;

// ---- Constants ----

const OVERLAY_CARD_WIDTH = 200;
const OVERLAY_CARD_HEIGHT = 160;
const ROW_THUMB_SIZE = 56;

/** Difficulty color map matching design spec */
const DIFF_COLOR: Record<string, string> = {
  easy: '#6EE7A0',
  normal: '#FBBF54',
  hard: '#F87171',
  expert: '#F87171',
  legend: '#A78BFA',
};
const PREVIEW_LIMIT = 3;

const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

// ---- Main Screen ----

export default function CourseListScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<CourseNav>();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [locationReady, setLocationReady] = useState(false);
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);

  const nearbyCourses = useCourseListStore((s) => s.nearbyCourses);
  const popularCourses = useCourseListStore((s) => s.popularCourses);
  const newCourses = useCourseListStore((s) => s.newCourses);
  const favoriteCourses = useCourseListStore((s) => s.favoriteCourses);
  const fetchNearbyCourses = useCourseListStore((s) => s.fetchNearbyCourses);
  const fetchPopularCourses = useCourseListStore((s) => s.fetchPopularCourses);
  const fetchNewCourses = useCourseListStore((s) => s.fetchNewCourses);
  const fetchFavoriteCourses = useCourseListStore((s) => s.fetchFavoriteCourses);

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLat(loc.coords.latitude);
        setUserLng(loc.coords.longitude);
        fetchNearbyCourses(loc.coords.latitude, loc.coords.longitude);
      } else {
        fetchNearbyCourses(DEFAULT_LAT, DEFAULT_LNG);
      }
    } catch {
      fetchNearbyCourses(DEFAULT_LAT, DEFAULT_LNG);
    } finally {
      setLocationReady(true);
    }
  }, [fetchNearbyCourses]);

  useEffect(() => {
    // Defer data fetching until tab transition animation completes
    // to prevent jank during tab switch (especially on iOS)
    const task = InteractionManager.runAfterInteractions(() => {
      fetchPopularCourses();
      fetchNewCourses();
      fetchFavoriteCourses();
      loadLocation();
    });
    return () => task.cancel();
  }, [fetchPopularCourses, fetchNewCourses, fetchFavoriteCourses, loadLocation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchPopularCourses(),
      fetchNewCourses(),
      fetchFavoriteCourses(),
      fetchNearbyCourses(userLat, userLng),
    ]);
    setRefreshing(false);
  }, [fetchPopularCourses, fetchNewCourses, fetchFavoriteCourses, fetchNearbyCourses, userLat, userLng]);

  const handleCoursePress = useCallback(
    (courseId: string) => {
      navigation.navigate('CourseDetail', { courseId });
    },
    [navigation],
  );

  const allEmpty =
    locationReady &&
    nearbyCourses.length === 0 &&
    popularCourses.length === 0 &&
    newCourses.length === 0;

  if (allEmpty) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('course.discover')}</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('CourseSearch')}
            style={styles.searchBtn}
          >
            <Ionicons name="search" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <EmptyState
          ionicon="walk-outline"
          title={t('course.emptyAll')}
          description={t('course.emptyAllMsg')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
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

        {/* Section 0: Favorites */}
        {favoriteCourses.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title={t('course.favorites')} ionicon="heart" iconColor="#FF3B30" />
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
        )}

        {/* Section 1: Nearby */}
        {locationReady && (
          <View style={styles.section}>
            <SectionHeader title={t('course.nearbySection')} ionicon="location" iconColor="#FF3B30" />
            {nearbyCourses.length === 0 ? (
              <View style={styles.nearbyEmptyContainer}>
                <Text style={styles.nearbyEmptyText}>{t('course.nearbyEmpty')}</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.overlayScrollContent}
              >
                {nearbyCourses.map((course) => (
                  <OverlayCard
                    key={course.id}
                    id={course.id}
                    title={course.title}
                    distanceMeters={course.distance_meters}
                    totalRuns={course.total_runs}
                    routePreview={course.route_preview ?? []}
                    thumbnailUrl={course.thumbnail_url}
                    onPress={() => handleCoursePress(course.id)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Section 2: Popular */}
        {popularCourses.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t('course.popularSection')}
              ionicon="flame"
              iconColor="#FF9500"
              onMore={() =>
                navigation.navigate('CourseSearch', { initialSort: 'total_runs' })
              }
            />
            <View style={styles.verticalList}>
              {popularCourses.slice(0, PREVIEW_LIMIT).map((course) => (
                <CourseRowCard
                  key={course.id}
                  course={course}

                  onPress={() => handleCoursePress(course.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Section 3: New */}
        {newCourses.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={t('course.newSection')}
              ionicon="sparkles"
              iconColor="#34C759"
              onMore={() =>
                navigation.navigate('CourseSearch', { initialSort: 'created_at' })
              }
            />
            <View style={styles.verticalList}>
              {newCourses.slice(0, PREVIEW_LIMIT).map((course) => (
                <CourseRowCard
                  key={course.id}
                  course={course}

                  onPress={() => handleCoursePress(course.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---- Section Header ----

function SectionHeader({
  title,
  ionicon,
  iconColor,
  onMore,
}: {
  title: string;
  ionicon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  onMore?: () => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {ionicon && (
          <View style={[styles.sectionIconBadge, { backgroundColor: (iconColor ?? colors.primary) + '18' }]}>
            <Ionicons name={ionicon} size={14} color={iconColor ?? colors.primary} />
          </View>
        )}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {onMore && (
        <TouchableOpacity
          onPress={onMore}
          style={styles.seeMoreHeaderBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.seeMoreHeaderText}>{t('course.seeMore')}</Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---- Overlay Card (Horizontal Scroll — Favorites / Nearby) ----

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
      {/* Full-bleed route map */}
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

      {/* Semi-transparent info overlay at bottom */}
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
      {/* Thumbnail */}
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

      {/* Content */}
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle} numberOfLines={1}>{course.title}</Text>
        <Text style={styles.vCardMeta}>
          {formatDistance(course.distance_meters)}
          <Text style={styles.vCardMetaSep}>{' · '}</Text>
          <Text style={{ color: DIFF_COLOR[difficulty] ?? colors.textSecondary }}>{getDifficultyLabel(difficulty)}</Text>
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
    scrollContent: {
      flexGrow: 1,
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

    // -- Section --
    section: {
      marginTop: SPACING.xl,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: SPACING.xxl,
      marginBottom: SPACING.md,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    sectionIconBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: c.text,
      letterSpacing: -0.3,
    },
    seeMoreHeaderBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeMoreHeaderText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: c.textTertiary,
    },

    // -- Overlay horizontal scroll (Favorites / Nearby) --
    overlayScrollContent: {
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.md,
    },
    nearbyEmptyContainer: {
      paddingHorizontal: SPACING.xxl,
      paddingVertical: SPACING.xl,
    },
    nearbyEmptyText: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      fontWeight: '500',
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

    // -- Vertical list --
    verticalList: {
      paddingHorizontal: SPACING.xxl,
      gap: SPACING.sm,
    },

    // -- Vertical Row Card (Popular / New) --
    rowCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
      gap: SPACING.md,
      borderWidth: 1,
      borderColor: c.border,
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

    // -- See More Button --
    seeMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: SPACING.md,
      marginHorizontal: SPACING.xxl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: c.surface,
      gap: 4,
    },
    seeMoreText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: c.primary,
    },

    // -- Bottom padding --
    bottomPadding: {
      height: SPACING.xxxl + SPACING.xl,
    },
  });
