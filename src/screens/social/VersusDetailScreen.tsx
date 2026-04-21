import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import type { VersusChallenge } from '../../types/versus';
import { VERSUS_METRIC_LABELS, VERSUS_STATUS_LABELS, VERSUS_DURATION_LABELS } from '../../types/versus';
import { versusService } from '../../services/versusService';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { formatDistance, formatPace, formatRelativeTime } from '../../utils/format';
import { useAuthStore } from '../../stores/authStore';

type RouteParams = RouteProp<CommunityStackParamList, 'VersusDetail'>;
type Nav = NativeStackNavigationProp<CommunityStackParamList, 'VersusDetail'>;

function formatBattleValue(value: number, metric: 'distance' | 'count' | 'pace'): string {
  switch (metric) {
    case 'distance':
      return formatDistance(value * 1000);
    case 'count':
      return `${value}\uD68C`;
    case 'pace':
      return formatPace(value);
    default:
      return String(value);
  }
}

function formatRemainingTime(endsAt: string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diffMs = end - now;
  if (diffMs <= 0) return '\uC885\uB8CC';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}\uC77C ${hours}\uC2DC\uAC04`;
  return `${hours}\uC2DC\uAC04 ${minutes}\uBD84`;
}

export default function VersusDetailScreen() {
  const colors = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteParams>();
  const s = useMemo(() => createStyles(colors), [colors]);
  const currentUserId = useAuthStore((state) => state.user?.id);

  const { battleId } = route.params;

  const [battle, setBattle] = useState<VersusChallenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);

  const fetchBattle = useCallback(async () => {
    try {
      const data = await versusService.getBattle(battleId);
      setBattle(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [battleId]);

  useEffect(() => {
    fetchBattle();
  }, [fetchBattle]);

  const isOpponent =
    battle != null && currentUserId === battle.opponent.userId;
  const isPending = battle?.status === 'pending';
  const canAcceptOrDecline = isPending && isOpponent;

  const handleAccept = useCallback(async () => {
    if (!battle) return;
    setIsActioning(true);
    try {
      const updated = await versusService.acceptBattle(battle.id);
      setBattle(updated);
    } catch {
      Alert.alert('\uC624\uB958', '\uB300\uACB0 \uC218\uB77D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setIsActioning(false);
    }
  }, [battle]);

  const handleDecline = useCallback(async () => {
    if (!battle) return;
    Alert.alert(
      '\uB300\uACB0 \uAC70\uC808',
      '\uC815\uB9D0 \uAC70\uC808\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?',
      [
        { text: '\uCDE8\uC18C', style: 'cancel' },
        {
          text: '\uAC70\uC808',
          style: 'destructive',
          onPress: async () => {
            setIsActioning(true);
            try {
              await versusService.declineBattle(battle.id);
              navigation.goBack();
            } catch {
              Alert.alert('\uC624\uB958', '\uB300\uACB0 \uAC70\uC808\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.');
            } finally {
              setIsActioning(false);
            }
          },
        },
      ],
    );
  }, [battle, navigation]);

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!battle) {
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}>
        <View style={s.loader}>
          <Text style={s.errorText}>{'\uB300\uACB0\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const chalLeading = battle.challenger.currentValue >= battle.opponent.currentValue;
  const totalValue = battle.challenger.currentValue + battle.opponent.currentValue;
  const chalRatio = totalValue > 0 ? battle.challenger.currentValue / totalValue : 0.5;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{'\uB300\uACB0 \uC0C1\uC138'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Status badge */}
        <View style={s.statusRow}>
          <View
            style={[
              s.statusBadge,
              {
                backgroundColor:
                  battle.status === 'active'
                    ? colors.success + '20'
                    : colors.textTertiary + '20',
              },
            ]}
          >
            <Text
              style={[
                s.statusText,
                {
                  color:
                    battle.status === 'active'
                      ? colors.success
                      : colors.textTertiary,
                },
              ]}
            >
              {VERSUS_STATUS_LABELS[battle.status]}
            </Text>
          </View>
          <Text style={s.metricLabel}>
            {VERSUS_METRIC_LABELS[battle.metric]} {'\u00B7'}{' '}
            {VERSUS_DURATION_LABELS[battle.durationDays]}
          </Text>
        </View>

        {/* VS card */}
        <View style={s.vsCard}>
          {/* Challenger */}
          <TouchableOpacity
            style={s.participantCol}
            onPress={() => handleUserPress(battle.challenger.userId)}
            activeOpacity={0.7}
          >
            {battle.challenger.avatarUrl ? (
              <Image
                source={{ uri: battle.challenger.avatarUrl }}
                style={[s.bigAvatar, chalLeading && s.leadingAvatar]}
              />
            ) : (
              <View style={[s.bigAvatarPlaceholder, chalLeading && s.leadingAvatar]}>
                <Ionicons name="person" size={28} color={colors.textTertiary} />
              </View>
            )}
            <Text style={s.participantName} numberOfLines={1}>
              {battle.challenger.nickname}
            </Text>
            <Text style={[s.participantValue, chalLeading && { color: colors.primary }]}>
              {formatBattleValue(battle.challenger.currentValue, battle.metric)}
            </Text>
            <Text style={s.runCount}>
              {battle.challenger.runCount}\uD68C \uB7EC\uB2DD
            </Text>
          </TouchableOpacity>

          {/* VS */}
          <View style={s.vsCenter}>
            <Text style={s.vsBigText}>VS</Text>
          </View>

          {/* Opponent */}
          <TouchableOpacity
            style={s.participantCol}
            onPress={() => handleUserPress(battle.opponent.userId)}
            activeOpacity={0.7}
          >
            {battle.opponent.avatarUrl ? (
              <Image
                source={{ uri: battle.opponent.avatarUrl }}
                style={[s.bigAvatar, !chalLeading && s.leadingAvatar]}
              />
            ) : (
              <View style={[s.bigAvatarPlaceholder, !chalLeading && s.leadingAvatar]}>
                <Ionicons name="person" size={28} color={colors.textTertiary} />
              </View>
            )}
            <Text style={s.participantName} numberOfLines={1}>
              {battle.opponent.nickname}
            </Text>
            <Text style={[s.participantValue, !chalLeading && { color: colors.primary }]}>
              {formatBattleValue(battle.opponent.currentValue, battle.metric)}
            </Text>
            <Text style={s.runCount}>
              {battle.opponent.runCount}\uD68C \uB7EC\uB2DD
            </Text>
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {battle.status === 'active' && (
          <View style={s.progressBarContainer}>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFillLeft,
                  { width: `${chalRatio * 100}%` },
                ]}
              />
            </View>
          </View>
        )}

        {/* Remaining time */}
        {battle.endsAt && battle.status === 'active' && (
          <View style={s.infoCard}>
            <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
            <Text style={s.infoText}>
              {'\uB0A8\uC740 \uC2DC\uAC04: '}
              {formatRemainingTime(battle.endsAt)}
            </Text>
          </View>
        )}

        {/* Winner display */}
        {battle.status === 'completed' && battle.winnerId && (
          <View style={s.winnerCard}>
            <Ionicons name="trophy" size={24} color={colors.gold} />
            <Text style={s.winnerText}>
              {battle.winnerId === battle.challenger.userId
                ? battle.challenger.nickname
                : battle.opponent.nickname}
              {' \uC2B9\uB9AC!'}
            </Text>
          </View>
        )}

        {/* Timestamps */}
        <View style={s.metaSection}>
          <Text style={s.metaText}>
            {'\uC2E0\uCCAD\uC77C: '}
            {formatRelativeTime(battle.createdAt)}
          </Text>
          {battle.startedAt && (
            <Text style={s.metaText}>
              {'\uC2DC\uC791\uC77C: '}
              {formatRelativeTime(battle.startedAt)}
            </Text>
          )}
        </View>

        {/* Accept/Decline actions */}
        {canAcceptOrDecline && (
          <View style={s.actionRow}>
            <TouchableOpacity
              style={s.declineButton}
              onPress={handleDecline}
              disabled={isActioning}
              activeOpacity={0.7}
            >
              <Text style={s.declineText}>{'\uAC70\uC808'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.acceptButton}
              onPress={handleAccept}
              disabled={isActioning}
              activeOpacity={0.7}
            >
              {isActioning ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={s.acceptText}>{'\uC218\uB77D'}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    headerTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      padding: SPACING.lg,
      paddingBottom: SPACING.huge,
    },
    // Status
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      marginBottom: SPACING.xl,
    },
    statusBadge: {
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
    },
    statusText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
    },
    metricLabel: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    // VS card
    vsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      marginBottom: SPACING.lg,
    },
    participantCol: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.xs,
    },
    bigAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      marginBottom: SPACING.xs,
    },
    bigAvatarPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.xs,
    },
    leadingAvatar: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    participantName: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
      maxWidth: 100,
      textAlign: 'center',
    },
    participantValue: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '900',
      color: colors.text,
    },
    runCount: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
    },
    vsCenter: {
      paddingHorizontal: SPACING.lg,
    },
    vsBigText: {
      fontSize: FONT_SIZES.title,
      fontWeight: '900',
      color: colors.textTertiary,
    },
    // Progress bar
    progressBarContainer: {
      marginBottom: SPACING.lg,
    },
    progressTrack: {
      height: 8,
      backgroundColor: colors.error + '40',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFillLeft: {
      height: '100%',
      backgroundColor: colors.success,
      borderRadius: 4,
    },
    // Info
    infoCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    infoText: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    // Winner
    winnerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.gold + '15',
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginBottom: SPACING.lg,
    },
    winnerText: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: colors.gold,
    },
    // Meta
    metaSection: {
      gap: SPACING.xs,
      marginBottom: SPACING.xl,
    },
    metaText: {
      fontSize: FONT_SIZES.sm,
      color: colors.textTertiary,
    },
    // Actions
    actionRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    declineButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.surface,
    },
    declineText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.error,
    },
    acceptButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: SPACING.lg,
      borderRadius: BORDER_RADIUS.sm,
      backgroundColor: colors.primary,
    },
    acceptText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: '#FFF',
    },
  });
