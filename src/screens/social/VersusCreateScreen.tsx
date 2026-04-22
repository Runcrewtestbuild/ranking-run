import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '../../lib/icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../../types/navigation';
import type { VersusMetric, VersusDuration, VersusCreateRequest } from '../../types/versus';
import { VERSUS_METRIC_LABELS, VERSUS_DURATION_LABELS } from '../../types/versus';
import type { UserProfile } from '../../types/api';
import { versusService } from '../../services/versusService';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import api from '../../services/api';

type Nav = NativeStackNavigationProp<CommunityStackParamList, 'VersusCreate'>;

type Step = 'opponent' | 'metric' | 'duration' | 'confirm';

const METRICS: VersusMetric[] = ['distance', 'count'];
const DURATIONS: VersusDuration[] = [3, 7, 14];

interface SearchResult {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export default function VersusCreateScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const navigation = useNavigation<Nav>();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('opponent');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedOpponent, setSelectedOpponent] = useState<SearchResult | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<VersusMetric>('distance');
  const [selectedDuration, setSelectedDuration] = useState<VersusDuration>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search users
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const sp = new URLSearchParams();
      sp.set('q', query);
      sp.set('limit', '20');
      const results = await api.get<SearchResult[]>(`/users/search?${sp.toString()}`);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSelectOpponent = useCallback((user: SearchResult) => {
    setSelectedOpponent(user);
    setStep('metric');
  }, []);

  const handleSelectMetric = useCallback((metric: VersusMetric) => {
    setSelectedMetric(metric);
    setStep('duration');
  }, []);

  const handleSelectDuration = useCallback((duration: VersusDuration) => {
    setSelectedDuration(duration);
    setStep('confirm');
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedOpponent) return;
    setIsSubmitting(true);
    try {
      const req: VersusCreateRequest = {
        opponentId: selectedOpponent.id,
        metric: selectedMetric,
        durationDays: selectedDuration,
      };
      await versusService.createBattle(req);
      Alert.alert(
        t('social.versusCreate.successTitle'),
        t('social.versusCreate.successMsg', { name: selectedOpponent.nickname }),
        [{ text: t('social.versusCreate.successConfirm'), onPress: () => navigation.goBack() }],
      );
    } catch {
      Alert.alert(t('social.versusCreate.errorTitle'), t('social.versusCreate.errorMsg'));
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedOpponent, selectedMetric, selectedDuration, navigation]);

  const handleBack = useCallback(() => {
    switch (step) {
      case 'opponent':
        navigation.goBack();
        break;
      case 'metric':
        setStep('opponent');
        break;
      case 'duration':
        setStep('metric');
        break;
      case 'confirm':
        setStep('duration');
        break;
    }
  }, [step, navigation]);

  const stepTitle = useMemo(() => {
    switch (step) {
      case 'opponent':
        return t('social.versusCreate.stepOpponent');
      case 'metric':
        return t('social.versusCreate.stepMetric');
      case 'duration':
        return t('social.versusCreate.stepDuration');
      case 'confirm':
        return t('social.versusCreate.stepConfirm');
    }
  }, [step, t]);

  const renderSearchResult = useCallback(
    ({ item }: { item: SearchResult }) => (
      <TouchableOpacity
        style={s.userRow}
        onPress={() => handleSelectOpponent(item)}
        activeOpacity={0.7}
      >
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={s.userAvatar} />
        ) : (
          <View style={s.userAvatarPlaceholder}>
            <Ionicons name="person" size={18} color={colors.textTertiary} />
          </View>
        )}
        <Text style={s.userName}>{item.nickname}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    ),
    [s, colors, handleSelectOpponent],
  );

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{stepTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Step indicator */}
      <View style={s.stepIndicator}>
        {(['opponent', 'metric', 'duration', 'confirm'] as Step[]).map((st, idx) => (
          <View
            key={st}
            style={[
              s.stepDot,
              {
                backgroundColor:
                  step === st
                    ? colors.primary
                    : idx < ['opponent', 'metric', 'duration', 'confirm'].indexOf(step)
                      ? colors.success
                      : colors.surface,
              },
            ]}
          />
        ))}
      </View>

      <KeyboardAvoidingView
        style={s.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Step: Opponent selection */}
        {step === 'opponent' && (
          <View style={s.stepContent}>
            <TextInput
              style={s.searchInput}
              placeholder={t('social.versusCreate.searchPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
            />
            {isSearching && (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginVertical: SPACING.md }}
              />
            )}
            <FlatList
              data={searchResults}
              renderItem={renderSearchResult}
              keyExtractor={(item) => item.id}
              contentContainerStyle={s.searchList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                searchQuery.length >= 2 && !isSearching ? (
                  <Text style={s.emptySearch}>
                    {t('social.versusCreate.noResults')}
                  </Text>
                ) : null
              }
            />
          </View>
        )}

        {/* Step: Metric selection */}
        {step === 'metric' && (
          <View style={s.stepContent}>
            <Text style={s.stepDescription}>
              {t('social.versusCreate.metricQuestion')}
            </Text>
            {METRICS.map((metric) => (
              <TouchableOpacity
                key={metric}
                style={[
                  s.optionCard,
                  selectedMetric === metric && step !== 'metric' && s.optionCardSelected,
                ]}
                onPress={() => handleSelectMetric(metric)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={
                    metric === 'distance'
                      ? 'navigate-outline'
                      : 'repeat-outline'
                  }
                  size={24}
                  color={colors.primary}
                />
                <View style={s.optionTextContainer}>
                  <Text style={s.optionTitle}>
                    {VERSUS_METRIC_LABELS[metric]}
                  </Text>
                  <Text style={s.optionDescription}>
                    {metric === 'distance'
                      ? t('social.versusCreate.metricDistanceDesc')
                      : t('social.versusCreate.metricCountDesc')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step: Duration selection */}
        {step === 'duration' && (
          <View style={s.stepContent}>
            <Text style={s.stepDescription}>
              {t('social.versusCreate.durationQuestion')}
            </Text>
            <View style={s.durationRow}>
              {DURATIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[
                    s.durationCard,
                    selectedDuration === d && s.durationCardSelected,
                  ]}
                  onPress={() => handleSelectDuration(d)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      s.durationValue,
                      selectedDuration === d && { color: colors.primary },
                    ]}
                  >
                    {d}
                  </Text>
                  <Text style={s.durationLabel}>
                    {VERSUS_DURATION_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && selectedOpponent && (
          <View style={s.stepContent}>
            <View style={s.confirmCard}>
              <Text style={s.confirmTitle}>{t('social.versusCreate.confirmTitle')}</Text>

              <View style={s.confirmRow}>
                <Text style={s.confirmLabel}>{t('social.versusCreate.confirmOpponent')}</Text>
                <View style={s.confirmValueRow}>
                  {selectedOpponent.avatar_url ? (
                    <Image
                      source={{ uri: selectedOpponent.avatar_url }}
                      style={s.confirmAvatar}
                    />
                  ) : (
                    <View style={s.confirmAvatarPlaceholder}>
                      <Ionicons name="person" size={12} color={colors.textTertiary} />
                    </View>
                  )}
                  <Text style={s.confirmValue}>
                    {selectedOpponent.nickname}
                  </Text>
                </View>
              </View>

              <View style={s.confirmRow}>
                <Text style={s.confirmLabel}>{t('social.versusCreate.confirmMetric')}</Text>
                <Text style={s.confirmValue}>
                  {VERSUS_METRIC_LABELS[selectedMetric]}
                </Text>
              </View>

              <View style={s.confirmRow}>
                <Text style={s.confirmLabel}>{t('social.versusCreate.confirmDuration')}</Text>
                <Text style={s.confirmValue}>
                  {VERSUS_DURATION_LABELS[selectedDuration]}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={s.submitButton}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <Ionicons name="flash" size={20} color="#FFF" />
                  <Text style={s.submitText}>{t('social.versusCreate.submitButton')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
    },
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
    // Step indicator
    stepIndicator: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: SPACING.sm,
      paddingVertical: SPACING.md,
    },
    stepDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    body: {
      flex: 1,
    },
    stepContent: {
      flex: 1,
      padding: SPACING.lg,
    },
    stepDescription: {
      fontSize: FONT_SIZES.xl,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xl,
    },
    // Search
    searchInput: {
      backgroundColor: colors.surface,
      borderRadius: BORDER_RADIUS.sm,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      fontSize: FONT_SIZES.md,
      color: colors.text,
      marginBottom: SPACING.md,
    },
    searchList: {
      paddingBottom: SPACING.xl,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    userAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    userAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userName: {
      flex: 1,
      fontSize: FONT_SIZES.md,
      fontWeight: '600',
      color: colors.text,
    },
    emptySearch: {
      fontSize: FONT_SIZES.md,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: SPACING.xxl,
    },
    // Options
    optionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      marginBottom: SPACING.md,
    },
    optionCardSelected: {
      borderColor: colors.primary,
    },
    optionTextContainer: {
      flex: 1,
    },
    optionTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: colors.text,
      marginBottom: SPACING.xs,
    },
    optionDescription: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
    },
    // Duration
    durationRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    durationCard: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      gap: SPACING.xs,
    },
    durationCardSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '10',
    },
    durationValue: {
      fontSize: FONT_SIZES.display,
      fontWeight: '900',
      color: colors.text,
    },
    durationLabel: {
      fontSize: FONT_SIZES.sm,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    // Confirm
    confirmCard: {
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.xl,
      marginBottom: SPACING.xxl,
    },
    confirmTitle: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '800',
      color: colors.text,
      marginBottom: SPACING.lg,
    },
    confirmRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    confirmLabel: {
      fontSize: FONT_SIZES.md,
      color: colors.textSecondary,
    },
    confirmValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    confirmAvatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    confirmAvatarPlaceholder: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmValue: {
      fontSize: FONT_SIZES.md,
      fontWeight: '700',
      color: colors.text,
    },
    // Submit
    submitButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      borderRadius: BORDER_RADIUS.sm,
      paddingVertical: SPACING.lg,
    },
    submitText: {
      fontSize: FONT_SIZES.lg,
      fontWeight: '700',
      color: '#FFF',
    },
  });
