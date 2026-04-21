import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS, SHADOWS } from '../../utils/constants';
import type { UpcomingGroupRun } from '../../types/crewFeed';

// ---- Helpers ----

function formatSchedule(isoDate: string, t: (key: string) => string): string {
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

  if (isToday) return `${t('social.today')} ${timeStr}`;
  if (isTomorrow) return `${t('social.tomorrow')} ${timeStr}`;

  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}/${day} ${timeStr}`;
}

// ---- Component ----

interface GroupRunCardProps {
  groupRun: UpcomingGroupRun;
  onToggleJoin: (id: string, currentlyJoined: boolean) => void;
  onPress?: (id: string) => void;
}

function GroupRunCard({ groupRun, onToggleJoin, onPress }: GroupRunCardProps) {
  const colors = useTheme();
  const { t } = useTranslation();
  const s = useMemo(() => createStyles(colors), [colors]);

  const handleToggle = useCallback(() => {
    onToggleJoin(groupRun.id, groupRun.isJoined);
  }, [groupRun.id, groupRun.isJoined, onToggleJoin]);

  const handlePress = useCallback(() => {
    onPress?.(groupRun.id);
  }, [groupRun.id, onPress]);

  const maxAvatars = 3;
  const visibleAvatars = groupRun.participantAvatars.slice(0, maxAvatars);
  const extraCount = Math.max(0, groupRun.participantCount - maxAvatars);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {/* Header row */}
      <View style={s.headerRow}>
        {groupRun.isLive && (
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>LIVE</Text>
          </View>
        )}
        <Text style={s.crewName} numberOfLines={1}>
          {groupRun.crewName}
        </Text>
        <Text style={s.title} numberOfLines={1}>
          {groupRun.title}
        </Text>
      </View>

      {/* Info row */}
      <View style={s.infoRow}>
        <Text style={s.infoText}>
          {formatSchedule(groupRun.scheduledAt, t)}
          {'  \u00B7  '}
          {groupRun.location}
          {'  \u00B7  '}
          {groupRun.distanceKm}km
        </Text>
      </View>

      {/* Bottom row: avatars + RSVP */}
      <View style={s.bottomRow}>
        <View style={s.avatarRow}>
          {visibleAvatars.map((url, i) => (
            <Image
              key={`avatar-${i}`}
              source={{ uri: url }}
              style={[s.avatar, i > 0 && { marginLeft: -8 }]}
            />
          ))}
          {visibleAvatars.length === 0 && (
            <Ionicons name="people" size={20} color={colors.textTertiary} />
          )}
          {extraCount > 0 && (
            <Text style={s.extraText}>+{extraCount}명</Text>
          )}
          {extraCount === 0 && groupRun.participantCount > 0 && (
            <Text style={s.extraText}>{groupRun.participantCount}명</Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            s.rsvpButton,
            groupRun.isJoined ? s.rsvpJoined : s.rsvpDefault,
          ]}
          onPress={handleToggle}
          activeOpacity={0.7}
        >
          <Text
            style={[
              s.rsvpText,
              groupRun.isJoined ? s.rsvpTextJoined : s.rsvpTextDefault,
            ]}
          >
            {groupRun.isJoined ? t('social.cancelJoin') : t('social.joinRun')}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(GroupRunCard);

// ---- Styles ----

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderRadius: BORDER_RADIUS.lg,
      padding: SPACING.lg,
      marginHorizontal: SPACING.lg,
      marginBottom: SPACING.md,
      ...SHADOWS.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10B981' + '20',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 2,
      borderRadius: BORDER_RADIUS.full,
      gap: 4,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#10B981',
    },
    liveText: {
      fontSize: FONT_SIZES.xs,
      fontWeight: '700',
      color: '#10B981',
    },
    crewName: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '700',
      color: c.text,
      flexShrink: 1,
    },
    title: {
      fontSize: FONT_SIZES.sm,
      color: c.textSecondary,
      flexShrink: 1,
    },
    infoRow: {
      marginBottom: SPACING.md,
    },
    infoText: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: c.card,
    },
    extraText: {
      fontSize: FONT_SIZES.sm,
      color: c.textTertiary,
      marginLeft: SPACING.sm,
    },
    rsvpButton: {
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    rsvpDefault: {
      backgroundColor: c.primary,
    },
    rsvpJoined: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    rsvpText: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
    },
    rsvpTextDefault: {
      color: '#FFFFFF',
    },
    rsvpTextJoined: {
      color: c.textSecondary,
    },
  });
