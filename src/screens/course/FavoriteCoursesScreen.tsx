import React, { useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import BlurredBackground from '../../components/common/BlurredBackground';
import CourseThumbnailMap from '../../components/course/CourseThumbnailMap';
import { useCourseListStore } from '../../stores/courseListStore';
import { formatDistance } from '../../utils/format';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { ThemeColors } from '../../utils/constants';
import type { HomeStackParamList } from '../../types/navigation';
import type { FavoriteCourseItem } from '../../types/api';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'FavoriteCourses'>;

export default function FavoriteCoursesScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const favoriteCourses = useCourseListStore((s) => s.favoriteCourses);
  const fetchFavoriteCourses = useCourseListStore((s) => s.fetchFavoriteCourses);

  useEffect(() => {
    fetchFavoriteCourses();
  }, [fetchFavoriteCourses]);

  const renderItem = useCallback(
    ({ item }: { item: FavoriteCourseItem }) => (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('CourseDetail', { courseId: item.id })}
        activeOpacity={0.7}
      >
        <CourseThumbnailMap
          thumbnailUrl={item.thumbnail_url}
          thumbnailUrlLight={item.thumbnail_url_light}
          width={72}
          height={72}
          borderRadius={BORDER_RADIUS.sm}
        />
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.meta}>
            {formatDistance(item.distance_meters)}
            {item.creator_nickname && (
              <Text style={styles.metaSep}>{` · ${item.creator_nickname}`}</Text>
            )}
          </Text>
          {item.total_runs != null && item.total_runs > 0 && (
            <Text style={styles.runs}>
              {t('course.runCount', { count: item.total_runs })}
            </Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    ),
    [colors, navigation, styles, t],
  );

  return (
    <BlurredBackground>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('home.favoriteCourses')}</Text>
          <View style={{ width: 24 }} />
        </View>

        {favoriteCourses.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>{t('course.noFavorites')}</Text>
          </View>
        ) : (
          <FlatList
            data={favoriteCourses}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </BlurredBackground>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    headerTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
    },
    list: {
      paddingHorizontal: SPACING.xl,
      paddingBottom: SPACING.xxxl,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: c.divider,
    },
    info: {
      flex: 1,
      gap: 3,
    },
    title: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: c.text,
    },
    meta: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
      fontWeight: '500',
    },
    metaSep: {
      color: c.textTertiary,
    },
    runs: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
      fontWeight: '500',
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: SPACING.md,
    },
    emptyText: {
      fontSize: FONT_SIZES.md,
      color: c.textTertiary,
      fontWeight: '500',
    },
  });
