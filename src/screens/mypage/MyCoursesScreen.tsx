import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  BackHandler,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '../../lib/icons';
import { useCourseListStore } from '../../stores/courseListStore';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import type { MyPageStackParamList } from '../../types/navigation';
import type { MyCourse } from '../../types/api';
import { formatDistance } from '../../utils/format';
import { COLORS, FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';

const IS_ANDROID = Platform.OS === 'android';
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_HORIZONTAL_PADDING = SPACING.xxl * 2;
const CARD_WIDTH = SCREEN_WIDTH - CARD_HORIZONTAL_PADDING;
const CARD_HEIGHT = 180;

type Nav = NativeStackNavigationProp<MyPageStackParamList, 'MyCourses'>;

function MyCourseCard({
  course,
  onDetail,
  onDelete,
  onEdit,
}: {
  course: MyCourse;
  onDetail: (courseId: string) => void;
  onDelete: (course: MyCourse) => void;
  onEdit: (course: MyCourse) => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLongPress = () => {
    Alert.alert(
      t('courses.manageCourse'),
      course.title,
      [
        {
          text: t('common.edit'),
          onPress: () => onEdit(course),
        },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => onDelete(course),
        },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    );
  };

  return (
    <TouchableOpacity
      style={styles.overlayCard}
      onPress={() => onDetail(course.id)}
      onLongPress={handleLongPress}
      activeOpacity={0.8}
    >
      {/* Full-bleed thumbnail */}
      {course.thumbnail_url ? (
        <Image
          source={{ uri: course.thumbnail_url }}
          style={styles.overlayCardImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.overlayCardPlaceholder}>
          <Ionicons name="map-outline" size={40} color={colors.textTertiary} />
        </View>
      )}

      {/* Visibility badge — top right */}
      <View
        style={[
          styles.visibilityBadge,
          course.is_public ? styles.badgePublic : styles.badgePrivate,
        ]}
      >
        <Text
          style={[
            styles.visibilityText,
            course.is_public ? styles.badgePublicText : styles.badgePrivateText,
          ]}
        >
          {course.is_public ? t('common.public') : t('common.private')}
        </Text>
      </View>

      {/* Semi-transparent info overlay at bottom */}
      <View style={styles.overlayCardInfo}>
        <Text style={styles.overlayCardTitle} numberOfLines={1}>
          {course.title}
        </Text>
        <Text style={styles.overlayCardMeta}>
          {formatDistance(course.distance_meters)}
          {course.stats.total_runs > 0 &&
            ` · ${t('course.runCount', { count: course.stats.total_runs })}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MyCoursesScreen() {
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myCourses = useCourseListStore((s) => s.myCourses);
  const isLoadingMyCourses = useCourseListStore((s) => s.isLoadingMyCourses);
  const fetchMyCourses = useCourseListStore((s) => s.fetchMyCourses);
  const updateMyCourse = useCourseListStore((s) => s.updateMyCourse);
  const deleteMyCourse = useCourseListStore((s) => s.deleteMyCourse);
  // Edit modal state
  const [androidEditVisible, setAndroidEditVisible] = useState(false);
  const [editCourse, setEditCourse] = useState<MyCourse | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [editCourseType, setEditCourseType] = useState<'normal' | 'loop'>('normal');
  const [editLapCount, setEditLapCount] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMyCourses();
  }, [fetchMyCourses]);

  const handleCloseEdit = useCallback(() => {
    setEditCourse(null);
    if (IS_ANDROID) setAndroidEditVisible(false);
  }, []);

  const handleOpenEdit = useCallback((course: MyCourse) => {
    setEditCourse(course);
    setEditTitle(course.title);
    setEditDescription(course.description ?? '');
    setEditPublic(course.is_public);
    setEditCourseType(course.course_type === 'loop' ? 'loop' : 'normal');
    setEditLapCount(course.lap_count ?? 1);
    if (IS_ANDROID) setAndroidEditVisible(true);
  }, []);

  // Android back button handler for overlay
  useEffect(() => {
    if (!IS_ANDROID || !androidEditVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCloseEdit();
      return true;
    });
    return () => sub.remove();
  }, [androidEditVisible, handleCloseEdit]);

  const handleDetail = useCallback(
    (courseId: string) => {
      navigation.navigate('CourseDetail', { courseId });
    },
    [navigation],
  );

  const handleDelete = useCallback(
    (course: MyCourse) => {
      Alert.alert(
        t('courses.deleteCourse'),
        t('courses.deleteConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteMyCourse(course.id);
              } catch {
                Alert.alert(t('common.error'), t('common.errorRetry'));
              }
            },
          },
        ],
      );
    },
    [deleteMyCourse, t],
  );

  const handleSave = async () => {
    if (!editCourse) return;
    if (editTitle.trim().length < 1) {
      Alert.alert(t('course.detail.titleCheck'), t('course.detail.enterTitle'));
      return;
    }
    setIsSaving(true);
    try {
      const isLoopCourse = editCourse.course_type === 'loop';
      await updateMyCourse(editCourse.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        is_public: editPublic,
        ...(isLoopCourse ? {
          course_type: editCourseType,
          lap_count: editCourseType === 'loop' ? editLapCount : undefined,
        } : {}),
      });
      handleCloseEdit();
    } catch {
      Alert.alert(t('common.error'), t('common.errorRetry'));
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = useCallback(
    ({ item }: { item: MyCourse }) => (
      <MyCourseCard
        course={item}
        onDetail={handleDetail}
        onDelete={handleDelete}
        onEdit={handleOpenEdit}
      />
    ),
    [handleDetail, handleDelete, handleOpenEdit],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('courses.myCourses')}</Text>
        <View style={{ width: 28 }} />
      </View>

      {isLoadingMyCourses ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={myCourses}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          windowSize={10}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="map-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyText}>참여한 코스가 없습니다</Text>
            </View>
          }
        />
      )}

      {/* Edit Modal — shared content */}
      {(() => {
        const editModalContent = (
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleCloseEdit}>
                <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('course.detail.editTitle')}</Text>
              <TouchableOpacity onPress={handleSave} disabled={isSaving}>
                <Text style={[styles.modalSave, isSaving && { opacity: 0.4 }]}>
                  {t('common.save')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('course.detail.fieldTitle')}</Text>
              <TextInput
                style={styles.fieldInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder={t('course.detail.fieldTitlePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                maxLength={50}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('course.detail.fieldDescription')}</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder={t('course.detail.fieldDescPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={200}
              />
              <Text style={styles.charCount}>{editDescription.length}/200</Text>
            </View>

            {/* Course type (loop courses only) */}
            {editCourse?.course_type === 'loop' && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('course.detail.courseType')}</Text>
                <View style={styles.courseTypeRow}>
                  <TouchableOpacity
                    style={[
                      styles.courseTypeBtn,
                      editCourseType === 'normal' && styles.courseTypeBtnActive,
                    ]}
                    onPress={() => setEditCourseType('normal')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="arrow-forward"
                      size={16}
                      color={editCourseType === 'normal' ? COLORS.white : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.courseTypeBtnText,
                        editCourseType === 'normal' && styles.courseTypeBtnTextActive,
                      ]}
                    >
                      {t('course.detail.oneWay')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.courseTypeBtn,
                      editCourseType === 'loop' && styles.courseTypeBtnActive,
                    ]}
                    onPress={() => setEditCourseType('loop')}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="repeat"
                      size={16}
                      color={editCourseType === 'loop' ? COLORS.white : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.courseTypeBtnText,
                        editCourseType === 'loop' && styles.courseTypeBtnTextActive,
                      ]}
                    >
                      {t('course.detail.roundTrip')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {editCourseType === 'loop' && (
                  <View style={styles.lapCountRow}>
                    <Text style={styles.lapCountLabel}>{t('course.detail.lapCount')}</Text>
                    <View style={styles.lapCountControls}>
                      <TouchableOpacity
                        style={[styles.lapCountBtn, editLapCount <= 1 && styles.lapCountBtnDisabled]}
                        onPress={() => setEditLapCount(Math.max(1, editLapCount - 1))}
                        disabled={editLapCount <= 1}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="remove" size={18} color={editLapCount <= 1 ? colors.textTertiary : colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.lapCountValue}>{editLapCount}</Text>
                      <TouchableOpacity
                        style={styles.lapCountBtn}
                        onPress={() => setEditLapCount(Math.min(10, editLapCount + 1))}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="add" size={18} color={colors.text} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Public toggle */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleLabel}>{t('course.detail.publicLabel')}</Text>
                <Text style={styles.toggleDescription}>
                  {t('course.detail.publicHint')}
                </Text>
              </View>
              <Switch
                value={editPublic}
                onValueChange={setEditPublic}
                trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              />
            </View>
          </View>
        );

        if (IS_ANDROID) {
          // Android: absolute overlay instead of native Modal to avoid touch desync
          if (!androidEditVisible) return null;
          return (
            <View style={styles.androidOverlay}>
              <StatusBar backgroundColor="rgba(0,0,0,0.4)" barStyle="light-content" />
              <TouchableOpacity
                style={styles.androidOverlayBackdrop}
                activeOpacity={1}
                onPress={handleCloseEdit}
              />
              <KeyboardAvoidingView
                style={styles.androidOverlayContent}
                behavior="height"
                pointerEvents="box-none"
              >
                {editModalContent}
              </KeyboardAvoidingView>
            </View>
          );
        }

        // iOS: native Modal (no touch issues)
        return (
          <Modal
            visible={editCourse !== null}
            transparent
            animationType="slide"
            onRequestClose={handleCloseEdit}
          >
            <KeyboardAvoidingView
              style={styles.modalOverlay}
              behavior="padding"
            >
              {editModalContent}
            </KeyboardAvoidingView>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
    },
    headerTitle: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      color: c.text,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 100,
      gap: SPACING.md,
    },
    emptyText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.textTertiary,
    },
    listContent: {
      paddingHorizontal: SPACING.xxl,
      paddingBottom: SPACING.xxxl,
      gap: SPACING.md,
    },

    // Overlay Card (map thumbnail + bottom info)
    overlayCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      ...SHADOWS.sm,
    },
    overlayCardImage: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
    },
    overlayCardPlaceholder: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    overlayCardInfo: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    overlayCardTitle: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    overlayCardMeta: {
      fontSize: FONT_SIZES.sm,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
      fontVariant: ['tabular-nums'] as const,
    },

    // Visibility badge (top-right)
    visibilityBadge: {
      position: 'absolute',
      top: SPACING.sm,
      right: SPACING.sm,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    badgePublic: {
      backgroundColor: 'rgba(52,199,89,0.85)',
    },
    badgePrivate: {
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    visibilityText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
    },
    badgePublicText: {
      color: '#FFFFFF',
    },
    badgePrivateText: {
      color: 'rgba(255,255,255,0.9)',
    },

    // Modal
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: BORDER_RADIUS.xl,
      borderTopRightRadius: BORDER_RADIUS.xl,
      paddingHorizontal: SPACING.xxl,
      paddingBottom: SPACING.xxxl,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.xl,
    },
    modalCancel: {
      fontSize: FONT_SIZES.md,
      color: c.textSecondary,
      fontWeight: '500',
    },
    modalTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
    },
    modalSave: {
      fontSize: FONT_SIZES.md,
      color: c.primary,
      fontWeight: '700',
    },

    // Form fields
    fieldGroup: {
      marginBottom: SPACING.xl,
      gap: SPACING.sm,
    },
    fieldLabel: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: c.text,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    fieldInput: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '500',
      color: c.text,
      borderBottomWidth: 2,
      borderBottomColor: c.border,
      paddingVertical: SPACING.md,
    },
    fieldTextArea: {
      minHeight: 80,
      textAlignVertical: 'top',
      borderBottomWidth: 0,
      backgroundColor: c.surface,
      borderRadius: BORDER_RADIUS.md,
      padding: SPACING.md,
    },
    charCount: {
      fontSize: FONT_SIZES.xs,
      color: c.textTertiary,
      alignSelf: 'flex-end',
      fontVariant: ['tabular-nums'],
    },
    // Course type selector
    courseTypeRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    courseTypeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    courseTypeBtnActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    courseTypeBtnText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.textSecondary,
    },
    courseTypeBtnTextActive: {
      color: COLORS.white,
    },
    lapCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: SPACING.sm,
      marginTop: SPACING.sm,
    },
    lapCountLabel: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    lapCountControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    lapCountBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
    },
    lapCountBtnDisabled: {
      opacity: 0.4,
    },
    lapCountValue: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '800',
      color: c.text,
      fontVariant: ['tabular-nums'] as any,
      minWidth: 28,
      textAlign: 'center',
    },

    // Android overlay (replaces Modal)
    androidOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 9999,
      elevation: 9999,
    },
    androidOverlayBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    androidOverlayContent: {
      flex: 1,
      justifyContent: 'flex-end' as const,
    },

    toggleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.md,
    },
    toggleLabel: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    toggleDescription: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      marginTop: 2,
    },
  });
