import React, { useState, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTheme } from '../../hooks/useTheme';
import type { ThemeColors } from '../../utils/constants';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import type { ReactionType, ReactionSummary } from '../../types/feed';
import { REACTION_EMOJIS, REACTION_TYPES } from '../../types/feed';

interface ReactionBarProps {
  reactions: ReactionSummary;
  userReactions: ReactionType[];
  onToggleReaction: (type: ReactionType) => void;
}

function ReactionBarInner({
  reactions,
  userReactions,
  onToggleReaction,
}: ReactionBarProps) {
  const colors = useTheme();
  const hapticEnabled = useSettingsStore((s) => s.hapticFeedback);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerAnchor, setPickerAnchor] = useState({ x: 0, y: 0 });
  const anchorRef = useRef<View>(null);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const triggerHaptic = useCallback(() => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [hapticEnabled]);

  const handleTap = useCallback(
    (type: ReactionType) => {
      triggerHaptic();
      onToggleReaction(type);
    },
    [onToggleReaction, triggerHaptic],
  );

  const handleLongPress = useCallback(() => {
    triggerHaptic();
    anchorRef.current?.measureInWindow((x, y) => {
      setPickerAnchor({ x, y: y - 52 });
      setPickerVisible(true);
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    });
  }, [triggerHaptic, scaleAnim]);

  const handlePickerSelect = useCallback(
    (type: ReactionType) => {
      triggerHaptic();
      onToggleReaction(type);
      scaleAnim.setValue(0);
      setPickerVisible(false);
    },
    [onToggleReaction, triggerHaptic, scaleAnim],
  );

  const closePicker = useCallback(() => {
    scaleAnim.setValue(0);
    setPickerVisible(false);
  }, [scaleAnim]);

  const s = createStyles(colors);

  // Show reactions that have counts or are user's own reactions
  const visibleReactions = REACTION_TYPES.filter(
    (type) => reactions[type] > 0 || userReactions.includes(type),
  );

  // If nothing visible, show clap as default
  if (visibleReactions.length === 0) {
    visibleReactions.push('clap');
  }

  return (
    <View ref={anchorRef} style={s.container}>
      {visibleReactions.map((type) => {
        const isActive = userReactions.includes(type);
        const count = reactions[type];
        return (
          <TouchableOpacity
            key={type}
            style={[s.reactionButton, isActive && s.reactionButtonActive]}
            onPress={() => handleTap(type)}
            onLongPress={handleLongPress}
            delayLongPress={400}
            activeOpacity={0.7}
          >
            <Text style={s.reactionEmoji}>{REACTION_EMOJIS[type]}</Text>
            {count > 0 && (
              <Text style={[s.reactionCount, isActive && s.reactionCountActive]}>
                {count}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Long-press picker showing all 5 reactions */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="none"
        onRequestClose={closePicker}
      >
        <Pressable style={s.pickerOverlay} onPress={closePicker}>
          <Animated.View
            style={[
              s.pickerContainer,
              {
                left: pickerAnchor.x,
                top: pickerAnchor.y,
                transform: [{ scale: scaleAnim }],
                opacity: scaleAnim,
              },
            ]}
          >
            {REACTION_TYPES.map((type) => {
              const isActive = userReactions.includes(type);
              return (
                <TouchableOpacity
                  key={type}
                  style={[s.pickerItem, isActive && s.pickerItemActive]}
                  onPress={() => handlePickerSelect(type)}
                  activeOpacity={0.7}
                >
                  <Text style={s.pickerEmoji}>{REACTION_EMOJIS[type]}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      marginTop: SPACING.md,
    },
    reactionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.surface,
    },
    reactionButtonActive: {
      backgroundColor: colors.primary + '1A', // 10% opacity
    },
    reactionEmoji: {
      fontSize: 20,
    },
    reactionCount: {
      fontSize: FONT_SIZES.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    reactionCountActive: {
      color: colors.primary,
    },
    // Picker overlay
    pickerOverlay: {
      flex: 1,
    },
    pickerContainer: {
      position: 'absolute',
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: BORDER_RADIUS.xl,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
      gap: SPACING.xs,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerItem: {
      padding: SPACING.sm,
      borderRadius: BORDER_RADIUS.full,
    },
    pickerItemActive: {
      backgroundColor: colors.primary + '1A',
    },
    pickerEmoji: {
      fontSize: 28,
    },
  });

export default memo(ReactionBarInner);
