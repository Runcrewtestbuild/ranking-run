import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { CommunityStackParamList } from '../../types/navigation';
import type { RankingSummaryItem, LeaderboardCategory, LeaderboardScope, LeaderboardEntry } from '../../types/leaderboard';
import type { VersusChallenge } from '../../types/versus';
import type { SeasonProgress } from '../../types/season';
import { LEADERBOARD_CATEGORY_LABELS, LEADERBOARD_SCOPE_LABELS } from '../../types/leaderboard';
import { VERSUS_METRIC_LABELS } from '../../types/versus';
import { leaderboardService } from '../../services/leaderboardService';
import { versusService } from '../../services/versusService';
import { seasonService } from '../../services/seasonService';
import { useToastStore } from '../../stores/toastStore';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { formatDistance, formatPace } from '../../utils/format';
import SeasonBanner from '../../components/social/SeasonBanner';
import LeaderboardRow from '../../components/social/LeaderboardRow';
import HorizontalBarChart from '../../components/charts/HorizontalBarChart';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'CommunityFeed'>;

const CATEGORY_CHIP_KEYS: { key: LeaderboardCategory; i18nKey: string }[] = [
  { key: 'weekly_distance', i18nKey: 'social.versus.categoryWeeklyDistance' },
  { key: 'monthly_count', i18nKey: 'social.versus.categoryMonthlyCount' },
  { key: 'pace', i18nKey: 'social.versus.categoryPace' },
  { key: 'course', i18nKey: 'social.versus.categoryCourse' },
];

const SCOPE_OPTION_KEYS: { key: LeaderboardScope; i18nKey: string }[] = [
  { key: 'nearby', i18nKey: 'social.versus.scopeNearby' },
  { key: 'global', i18nKey: 'social.versus.scopeGlobal' },

  { key: 'crew', i18nKey: 'social.versus.scopeCrew' },
];

function getRankChangeIndicator(
  current: number,
  previous: number | null,
): { symbol: string; color: string } {
  if (previous == null) return { symbol: '\u2500\u2500 0', color: '#808080' };
  const diff = previous - current;
  if (diff > 0) return { symbol: `\u25B2 ${diff}`, color: '#10B981' };
  if (diff < 0) return { symbol: `\u25BC ${Math.abs(diff)}`, color: '#EF4444' };
  return { symbol: '\u2500\u2500 0', color: '#808080' };
}

function formatSummaryValue(item: RankingSummaryItem): string {
  switch (item.category) {
    case 'weekly_distance':
      return formatDistance(item.value * 1000);
    case 'monthly_count':
      return `${item.value}`;
    case 'pace':
    case 'course':
      return formatPace(item.value);
    default:
      return String(item.value);
  }
}

function formatRemainingTime(endsAt: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  const diffMs = end - now;
  if (diffMs <= 0) return t('social.versus.ended');
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return t('social.versus.daysHours', { days, hours });
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return t('social.versus.hoursMinutes', { hours, minutes });
}

function buildEncouragement(
  myEntry: LeaderboardEntry | null,
  entries: LeaderboardEntry[],
  category: LeaderboardCategory,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string | null {
  if (!myEntry || myEntry.rank <= 1) return null;
  const above = entries.find((e) => e.rank === myEntry.rank - 1);
  if (!above) return null;
  const diff = above.value - myEntry.value;
  if (diff <= 0) return null;

  switch (category) {
    case 'weekly_distance':
      return t('social.versus.encourageDistance', { rank: myEntry.rank - 1, distance: formatDistance(diff * 1000) });
    case 'monthly_count':
      return t('social.versus.encourageCount', { rank: myEntry.rank - 1, count: diff });
    default:
      return null;
  }
}

export default function VersusScreen() {
  const colors = useTheme();
  const navigation = useNavigation<Nav>();
  const { t } = useTranslation();
  const showToast = useToastStore((st) => st.showToast);
  const s = useMemo(() => createStyles(colors), [colors]);

  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rankingSummary, setRankingSummary] = useState<RankingSummaryItem[]>([]);
  const [seasonProgress, setSeasonProgress] = useState<SeasonProgress | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategory>('weekly_distance');
  const [selectedScope, setSelectedScope] = useState<LeaderboardScope>('nearby');
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null);
  const [activeBattles, setActiveBattles] = useState<VersusChallenge[]>([]);
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

  // Data fetching
  const fetchAll = useCallback(async () => {
    try {
      const [summary, season, battles] = await Promise.allSettled([
        leaderboardService.getMyRankingSummary(),
        seasonService.getMyProgress(),
        versusService.getActiveBattles(),
      ]);

      if (summary.status === 'fulfilled') setRankingSummary(summary.value);
      if (season.status === 'fulfilled') setSeasonProgress(season.value);
      if (battles.status === 'fulfilled') setActiveBattles(battles.value);
    } catch {
      showToast('error', '랭킹 데이터를 불러오지 못했어요');
    }
  }, [showToast]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await leaderboardService.getLeaderboard(
        selectedCategory,
        selectedScope,
      );
      setLeaderboardEntries(res.entries);
      setMyEntry(res.myEntry);
    } catch {
      showToast('error', '리더보드를 불러오지 못했어요');
    }
  }, [selectedCategory, selectedScope, showToast]);

  // Initial load — once
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchAll(), fetchLeaderboard()]).finally(() =>
      setIsLoading(false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category/scope change — fetch leaderboard only (no full loading state)
  const initialMountRef = useRef(true);
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    fetchLeaderboard();
  }, [selectedCategory, selectedScope, fetchLeaderboard]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAll(), fetchLeaderboard()]);
    setIsRefreshing(false);
  }, [fetchAll, fetchLeaderboard]);

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserProfile', { userId });
    },
    [navigation],
  );

  const handleBattlePress = useCallback(
    (battle: VersusChallenge) => {
      navigation.navigate('VersusDetail', { battleId: battle.id });
    },
    [navigation],
  );

  const handleCreateBattle = useCallback(() => {
    navigation.navigate('VersusCreate');
  }, [navigation]);

  const topValue = useMemo(() => {
    if (leaderboardEntries.length === 0) return 0;
    return leaderboardEntries[0].value;
  }, [leaderboardEntries]);

  const encouragement = useMemo(
    () => buildEncouragement(myEntry, leaderboardEntries, selectedCategory, t),
    [myEntry, leaderboardEntries, selectedCategory, t],
  );

  const barChartData = useMemo(() => {
    return leaderboardEntries.slice(0, 10).map((entry) => ({
      label: entry.nickname,
      value: entry.value,
      avatarUrl: entry.avatarUrl ?? null,
      isMe: myEntry ? entry.userId === myEntry.userId : entry.isCurrentUser,
    }));
  }, [leaderboardEntries, myEntry]);

  const barFormatValue = useCallback(
    (v: number): string => {
      switch (selectedCategory) {
        case 'weekly_distance':
          return formatDistance(v * 1000);
        case 'monthly_count':
          return `${v}회`;
        case 'pace':
        case 'course':
          return formatPace(v);
        default:
          return String(v);
      }
    },
    [selectedCategory],
  );

  if (isLoading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={s.scrollContent}
      >
        {/* Season Banner */}
        {seasonProgress && <SeasonBanner progress={seasonProgress} />}

        {/* My Ranking Summary */}
        {rankingSummary.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('social.versus.myRankingSummary')}</Text>
            <View style={s.summaryRow}>
              {rankingSummary.slice(0, 3).map((item) => {
                const change = getRankChangeIndicator(item.rank, item.previousRank);
                return (
                  <View key={item.category} style={s.summaryCard}>
                    <Text style={s.summaryLabel}>
                      {LEADERBOARD_CATEGORY_LABELS[item.category]}
                    </Text>
                    <Text style={s.summaryRank}>#{item.rank}</Text>
                    <Text style={[s.summaryChange, { color: change.color }]}>
                      {change.symbol}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Leaderboard */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('social.versus.leaderboard')}</Text>

          {/* Category chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipsContainer}
          >
            {CATEGORY_CHIP_KEYS.map((chip) => {
              const isActive = selectedCategory === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[s.chip, isActive && s.chipActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedCategory(chip.key);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.chipText,
                      isActive ? s.chipTextActive : s.chipTextInactive,
                    ]}
                  >
                    {t(chip.i18nKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Scope selector */}
          <View style={s.scopeRow}>
            <Text style={s.scopeLabel}>{t('social.versus.scopePrefix')}</Text>
            <TouchableOpacity
              style={s.scopeButton}
              onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)}
              activeOpacity={0.7}
            >
              <Text style={s.scopeButtonText}>
                {LEADERBOARD_SCOPE_LABELS[selectedScope]}
              </Text>
              <Ionicons
                name={scopeDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {scopeDropdownOpen && (
            <View style={s.scopeDropdown}>
              {SCOPE_OPTION_KEYS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    s.scopeOption,
                    selectedScope === opt.key && s.scopeOptionActive,
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedScope(opt.key);
                    setScopeDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.scopeOptionText,
                      selectedScope === opt.key && s.scopeOptionTextActive,
                    ]}
                  >
                    {t(opt.i18nKey)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Bar Chart (top 10) */}
          {barChartData.length > 0 && (
            <HorizontalBarChart
              data={barChartData}
              maxItems={10}
              formatValue={barFormatValue}
              barColor={colors.primary}
            />
          )}

          {/* My entry if not in visible top 10 */}
          {myEntry &&
            !leaderboardEntries.slice(0, 10).some((e) => e.userId === myEntry.userId) && (
              <>
                <View style={s.separatorDots}>
                  <Text style={s.dots}>{'...'}</Text>
                </View>
                <LeaderboardRow
                  entry={myEntry}
                  category={selectedCategory}
                  topValue={topValue}
                  onPress={handleUserPress}
                  encouragement={encouragement}
                />
              </>
            )}

          {leaderboardEntries.length === 0 && (
            <View style={s.emptyLeaderboard}>
              <Ionicons
                name="podium-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={s.emptyText}>
                {t('social.versus.emptyLeaderboard')}
              </Text>
            </View>
          )}
        </View>

        {/* Active Battles */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('social.versus.activeBattles')}</Text>
          {activeBattles.length > 0 ? (
            activeBattles.map((battle) => (
              <TouchableOpacity
                key={battle.id}
                style={s.battleCard}
                onPress={() => handleBattlePress(battle)}
                activeOpacity={0.7}
              >
                <View style={s.battleParticipants}>
                  {/* Challenger */}
                  <View style={s.battleSide}>
                    {battle.challenger.avatarUrl ? (
                      <Image
                        source={{ uri: battle.challenger.avatarUrl }}
                        style={s.battleAvatar}
                      />
                    ) : (
                      <View style={s.battleAvatarPlaceholder}>
                        <Ionicons
                          name="person"
                          size={20}
                          color={colors.textTertiary}
                        />
                      </View>
                    )}
                    <Text style={s.battleName} numberOfLines={1}>
                      {battle.challenger.nickname}
                    </Text>
                    <Text style={s.battleValue}>
                      {formatBattleValue(
                        battle.challenger.currentValue,
                        battle.metric,
                        t('social.versus.countSuffix'),
                      )}
                    </Text>
                  </View>

                  {/* VS */}
                  <View style={s.vsContainer}>
                    <Text style={s.vsText}>VS</Text>
                    <Text style={s.battleMetric}>
                      {VERSUS_METRIC_LABELS[battle.metric]}
                    </Text>
                  </View>

                  {/* Opponent */}
                  <View style={s.battleSide}>
                    {battle.opponent.avatarUrl ? (
                      <Image
                        source={{ uri: battle.opponent.avatarUrl }}
                        style={s.battleAvatar}
                      />
                    ) : (
                      <View style={s.battleAvatarPlaceholder}>
                        <Ionicons
                          name="person"
                          size={20}
                          color={colors.textTertiary}
                        />
                      </View>
                    )}
                    <Text style={s.battleName} numberOfLines={1}>
                      {battle.opponent.nickname}
                    </Text>
                    <Text style={s.battleValue}>
                      {formatBattleValue(
                        battle.opponent.currentValue,
                        battle.metric,
                        t('social.versus.countSuffix'),
                      )}
                    </Text>
                  </View>
                </View>

                {battle.endsAt && (
                  <Text style={s.battleRemaining}>
                    {t('social.versus.remainingTime')}
                    {formatRemainingTime(battle.endsAt, t)}
                  </Text>
                )}
              </TouchableOpacity>
            ))
          ) : (
            <View style={s.emptyBattles}>
              <Ionicons
                name="flash-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={s.emptyText}>
                {t('social.versus.emptyBattles')}
              </Text>
              <Text style={s.emptySubtext}>
                {t('social.versus.emptyBattlesHint')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={handleCreateBattle}
        activeOpacity={0.8}
      >
        <Ionicons name="flash" size={24} color="#FFF" />
        <Text style={s.fabText}>{t('social.versus.createBattle')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatBattleValue(
  value: number,
  metric: 'distance' | 'count' | 'pace',
  countSuffix = '회',
): string {
  switch (metric) {
    case 'distance':
      return formatDistance(value * 1000);
    case 'count':
      return `${value}${countSuffix}`;
    case 'pace':
      return formatPace(value);
    default:
      return String(value);
  }
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      paddingTop: SPACING.md,
      paddingBottom: SPACING.huge + SPACING.xxxl + 56,
    },
    // Sections
    section: {
      marginBottom: SPACING.xl,
    },
    sectionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: colors.text,
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
    },
    // Summary cards
    summaryRow: {
      flexDirection: 'row',
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.md,
      alignItems: 'center',
      gap: SPACING.xs,
    },
    summaryLabel: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
      fontWeight: '600',
    },
    summaryRank: {
      fontSize: FONT_SIZES.xxl,
      fontWeight: '800',
      color: colors.text,
    },
    summaryChange: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
    },
    // Chips
    chipsContainer: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    chip: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
    },
    chipActive: {
      backgroundColor: colors.text,
    },
    chipText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    chipTextActive: {
      color: colors.background,
    },
    chipTextInactive: {
      color: colors.textSecondary,
    },
    // Scope
    scopeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      gap: SPACING.sm,
    },
    scopeLabel: {
      fontSize: FONT_SIZES.sm,
      color: colors.textTertiary,
    },
    scopeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.sm,
    },
    scopeButtonText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.text,
    },
    scopeDropdown: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.sm,
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.sm,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    scopeOption: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
    },
    scopeOptionActive: {
      backgroundColor: colors.primary + '18',
    },
    scopeOptionText: {
      fontSize: FONT_SIZES.sm,
      color: colors.text,
    },
    scopeOptionTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    // Separator
    separatorDots: {
      alignItems: 'center',
      paddingVertical: SPACING.xs,
    },
    dots: {
      fontSize: FONT_SIZES.lg,
      color: colors.textTertiary,
      letterSpacing: 4,
    },
    // Empty
    emptyLeaderboard: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
    },
    emptyText: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    emptySubtext: {
      fontSize: FONT_SIZES.sm,
      color: colors.textTertiary,
    },
    // Battle cards
    battleCard: {
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.lg,
    },
    battleParticipants: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    battleSide: {
      flex: 1,
      alignItems: 'center',
      gap: SPACING.xs,
    },
    battleAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    battleAvatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    battleName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.text,
      maxWidth: 80,
      textAlign: 'center',
    },
    battleValue: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: colors.primary,
    },
    vsContainer: {
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
    },
    vsText: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '900',
      color: colors.textTertiary,
    },
    battleMetric: {
      fontSize: FONT_SIZES.xs,
      color: colors.textTertiary,
      marginTop: SPACING.xs,
    },
    battleRemaining: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: SPACING.md,
    },
    emptyBattles: {
      alignItems: 'center',
      paddingVertical: SPACING.xxl,
      gap: SPACING.sm,
    },
    // FAB
    fab: {
      position: 'absolute',
      right: SPACING.xl,
      bottom: SPACING.xl,
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
      paddingVertical: SPACING.md,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    fabText: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: '#FFF',
    },
  });
