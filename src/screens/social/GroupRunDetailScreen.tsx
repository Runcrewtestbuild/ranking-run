import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker } from 'react-native-maps';
import BlurredBackground from '../../components/common/BlurredBackground';
import ScreenHeader from '../../components/common/ScreenHeader';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { CommunityStackParamList } from '../../types/navigation';
import type { ScheduledRunDetail, ScheduledRunParticipant } from '../../types/crewFeed';
import { crewFeedService } from '../../services/crewFeedService';
import { useToastStore } from '../../stores/toastStore';
import * as Haptics from 'expo-haptics';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'GroupRunDetail'>;
type Route = RouteProp<CommunityStackParamList, 'GroupRunDetail'>;

// ---- Helpers ----

function formatScheduleDate(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();

  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return `${dateStr} ${timeStr}`;
}

// ---- Main Component ----

export default function GroupRunDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { groupRunId } = route.params;
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showToast = useToastStore((s) => s.showToast);

  const [detail, setDetail] = useState<ScheduledRunDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      const data = await crewFeedService.getScheduledRunDetail(groupRunId);
      setDetail(data);
    } catch {
      showToast('error', t('groupRun.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [groupRunId, showToast, t]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDetail();
    setIsRefreshing(false);
  }, [loadDetail]);

  const handleToggleJoin = useCallback(async () => {
    if (!detail || isToggling) return;
    setIsToggling(true);

    // Optimistic update
    const wasJoined = detail.isJoined;
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            isJoined: !wasJoined,
            participantCount: prev.participantCount + (wasJoined ? -1 : 1),
          }
        : prev,
    );

    try {
      if (wasJoined) {
        await crewFeedService.leaveGroupRun(detail.id);
      } else {
        await crewFeedService.joinGroupRun(detail.id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Reload for fresh participant list
      await loadDetail();
    } catch {
      // Revert
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              isJoined: wasJoined,
              participantCount: prev.participantCount + (wasJoined ? 1 : -1),
            }
          : prev,
      );
      showToast('error', t('common.errorRetry'));
    } finally {
      setIsToggling(false);
    }
  }, [detail, isToggling, loadDetail, showToast, t]);

  const handleParticipantPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  // Loading state
  if (isLoading) {
    return (
      <BlurredBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScreenHeader title="" onBack={() => navigation.goBack()} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </SafeAreaView>
      </BlurredBackground>
    );
  }

  // Error state
  if (!detail) {
    return (
      <BlurredBackground>
        <SafeAreaView style={styles.container} edges={['top']}>
          <ScreenHeader title="" onBack={() => navigation.goBack()} />
          <View style={styles.loadingContainer}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.errorText}>{t('groupRun.loadError')}</Text>
          </View>
        </SafeAreaView>
      </BlurredBackground>
    );
  }

  const hasLocation = detail.latitude != null && detail.longitude != null;

  return (
    <BlurredBackground>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title={t('social.groupRunDetail')} onBack={() => navigation.goBack()} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {/* Live badge */}
          {detail.isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Title & Crew */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{detail.title}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CrewDetail', { crewId: detail.crewId })}
              activeOpacity={0.7}
            >
              <Text style={styles.crewName}>{detail.crewName}</Text>
            </TouchableOpacity>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{formatScheduleDate(detail.scheduledAt)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{detail.location || t('social.locationTbd')}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="footsteps-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>{detail.distanceKm}km</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>
                {t('social.participantCount', { count: detail.participantCount })}
              </Text>
            </View>
          </View>

          {/* Description */}
          {detail.description && (
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionText}>{detail.description}</Text>
            </View>
          )}

          {/* Map */}
          {hasLocation && (
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: detail.latitude!,
                  longitude: detail.longitude!,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={{
                    latitude: detail.latitude!,
                    longitude: detail.longitude!,
                  }}
                  title={detail.location}
                />
              </MapView>
            </View>
          )}

          {/* Participants */}
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              {t('social.participants')} ({detail.participantCount})
            </Text>
            {detail.participants.map((participant) => (
              <ParticipantRow
                key={participant.id}
                participant={participant}
                onPress={handleParticipantPress}
              />
            ))}
            {detail.participants.length === 0 && (
              <View style={styles.emptyParticipants}>
                <Ionicons name="people-outline" size={32} color={colors.textTertiary} />
                <Text style={styles.emptyParticipantsText}>
                  {t('social.noParticipantsYet')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Join/Leave Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.joinButton,
              detail.isJoined ? styles.joinButtonLeave : styles.joinButtonJoin,
            ]}
            onPress={handleToggleJoin}
            activeOpacity={0.7}
            disabled={isToggling}
          >
            {isToggling ? (
              <ActivityIndicator
                size="small"
                color={detail.isJoined ? colors.textSecondary : '#FFFFFF'}
              />
            ) : (
              <>
                <Ionicons
                  name={detail.isJoined ? 'close-circle-outline' : 'add-circle-outline'}
                  size={20}
                  color={detail.isJoined ? colors.textSecondary : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.joinButtonText,
                    detail.isJoined ? styles.joinButtonTextLeave : styles.joinButtonTextJoin,
                  ]}
                >
                  {detail.isJoined ? t('social.cancelJoin') : t('social.joinRun')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </BlurredBackground>
  );
}

// ---- Sub-component ----

const ParticipantRow = React.memo(function ParticipantRow({
  participant,
  onPress,
}: {
  participant: ScheduledRunParticipant;
  onPress: (userId: string) => void;
}) {
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.participantRow}
      onPress={() => onPress(participant.id)}
      activeOpacity={0.7}
    >
      {participant.avatarUrl ? (
        <Image source={{ uri: participant.avatarUrl }} style={styles.participantAvatar} />
      ) : (
        <View style={[styles.participantAvatar, styles.participantAvatarPlaceholder]}>
          <Ionicons name="person" size={16} color={colors.textTertiary} />
        </View>
      )}
      <Text style={styles.participantName} numberOfLines={1}>
        {participant.nickname}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: SPACING.lg,
      paddingBottom: 100,
      gap: SPACING.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: SPACING.md,
    },
    errorText: {
      fontSize: FONT_SIZES.md,
      color: c.textSecondary,
      textAlign: 'center',
    },

    // Live badge
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: '#10B981' + '20',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10B981',
    },
    liveText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: '#10B981',
    },

    // Title section
    titleSection: {
      gap: SPACING.xs,
    },
    title: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '800',
      color: c.text,
    },
    crewName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.primary,
    },

    // Info card
    infoCard: {
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      gap: SPACING.md,
      ...SHADOWS.sm,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    infoText: {
      fontSize: FONT_SIZES.md,
      color: c.text,
      flex: 1,
    },

    // Description
    descriptionCard: {
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      ...SHADOWS.sm,
    },
    descriptionText: {
      fontSize: FONT_SIZES.md,
      color: c.text,
      lineHeight: FONT_SIZES.md * 1.5,
    },

    // Map
    mapContainer: {
      height: 180,
      borderRadius: BORDER_RADIUS.lg,
      overflow: 'hidden',
      ...SHADOWS.sm,
    },
    map: {
      flex: 1,
    },

    // Participants
    participantsSection: {
      gap: SPACING.sm,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: c.text,
      marginBottom: SPACING.xs,
    },
    participantRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      padding: SPACING.md,
      borderRadius: BORDER_RADIUS.md,
      gap: SPACING.md,
    },
    participantAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    participantAvatarPlaceholder: {
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    participantName: {
      flex: 1,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: c.text,
    },
    emptyParticipants: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
      gap: SPACING.sm,
    },
    emptyParticipantsText: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
    },

    // Bottom bar
    bottomBar: {
      padding: SPACING.lg,
      paddingBottom: SPACING.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.divider,
    },
    joinButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.lg,
      gap: SPACING.sm,
    },
    joinButtonJoin: {
      backgroundColor: c.primary,
    },
    joinButtonLeave: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    joinButtonText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
    },
    joinButtonTextJoin: {
      color: '#FFFFFF',
    },
    joinButtonTextLeave: {
      color: c.textSecondary,
    },
  });
