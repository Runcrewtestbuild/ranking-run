import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { CrewMiniCard } from '../../types/crewFeed';

interface CrewSelectorProps {
  crews: CrewMiniCard[];
  selectedCrewId: string | null;
  onSelectCrew: (crewId: string) => void;
}

function CrewSelector({ crews, selectedCrewId, onSelectCrew }: CrewSelectorProps) {
  const colors = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const renderItem = useCallback(
    (crew: CrewMiniCard) => {
      const isSelected = crew.id === selectedCrewId;
      return (
        <TouchableOpacity
          key={crew.id}
          style={[s.crewCard, isSelected && s.crewCardSelected]}
          onPress={() => onSelectCrew(crew.id)}
          activeOpacity={0.7}
        >
          {crew.logoUrl ? (
            <Image source={{ uri: crew.logoUrl }} style={s.logo} />
          ) : (
            <View style={[s.logo, s.logoPlaceholder, { backgroundColor: crew.badgeColor + '30' }]}>
              <Text style={{ fontSize: 20 }}>{crew.badgeIcon || '\uD83C\uDFC3'}</Text>
            </View>
          )}
          <Text style={[s.crewName, isSelected && s.crewNameSelected]} numberOfLines={2}>
            {crew.name}
          </Text>
          {crew.unreadCount > 0 && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadText}>
                {crew.unreadCount > 99 ? '99+' : crew.unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [selectedCrewId, onSelectCrew, s, colors],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.scrollContent}
    >
      {crews.map(renderItem)}
    </ScrollView>
  );
}

export default React.memo(CrewSelector);

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: SPACING.lg,
      gap: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    crewCard: {
      width: 88,
      alignItems: 'center',
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.md,
      ...SHADOWS.sm,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    crewCardSelected: {
      borderColor: c.primary,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      marginBottom: SPACING.sm,
    },
    logoPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    crewName: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '600',
      color: c.text,
      textAlign: 'center',
      lineHeight: FONT_SIZES.xs * 1.3,
    },
    crewNameSelected: {
      color: c.primary,
    },
    unreadBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: c.error,
      borderRadius: BORDER_RADIUS.full,
      minWidth: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    unreadText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
