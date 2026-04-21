/**
 * Android: Plain View for layout + invisible RectButton for tap detection.
 * For long-press buttons (onPressIn/onPressOut), uses responder system instead.
 */
import React from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';

interface TouchableOpacityProps {
  onPress?: () => void;
  onLongPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  activeOpacity?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: any;
  disabled?: boolean;
  children?: React.ReactNode;
  [key: string]: any;
}

export function TouchableOpacity({
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  activeOpacity,
  style,
  hitSlop,
  disabled,
  children,
  ...rest
}: TouchableOpacityProps) {
  // Long-press buttons (stop, lock unlock): use responder system
  if (onPressIn || onPressOut) {
    return (
      <View
        style={style}
        onStartShouldSetResponder={() => true}
        onResponderGrant={() => onPressIn?.()}
        onResponderRelease={() => { onPressOut?.(); onPress?.(); }}
        onResponderTerminate={() => onPressOut?.()}
        hitSlop={hitSlop}
        {...rest}
      >
        {children}
      </View>
    );
  }

  // Regular tap buttons: invisible RectButton overlay
  return (
    <View style={style} {...rest}>
      {children}
      <RectButton
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
        hitSlop={hitSlop}
        enabled={!disabled}
        rippleColor="transparent"
        underlayColor="transparent"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

interface PressableProps {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  hitSlop?: any;
  disabled?: boolean;
  children?: React.ReactNode;
  android_ripple?: any;
  [key: string]: any;
}

export function Pressable({
  onPress,
  onLongPress,
  style,
  hitSlop,
  disabled,
  children,
  android_ripple,
  ...rest
}: PressableProps) {
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;

  return (
    <View style={resolvedStyle as StyleProp<ViewStyle>} {...rest}>
      {children}
      <RectButton
        onPress={disabled ? undefined : onPress}
        onLongPress={disabled ? undefined : onLongPress}
        hitSlop={hitSlop}
        enabled={!disabled}
        rippleColor={android_ripple?.color || 'transparent'}
        underlayColor="transparent"
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export { TouchableHighlight, TouchableWithoutFeedback } from 'react-native';
