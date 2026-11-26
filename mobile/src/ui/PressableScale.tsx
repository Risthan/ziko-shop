import type { ReactNode } from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";
import { haptics } from "@/lib/haptics";
import { motion } from "@/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, "style" | "children"> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Échelle au moment de l'appui (micro-interaction). */
  scaleTo?: number;
  haptic?: boolean;
}

/** Zone cliquable qui se « tasse » légèrement sous le doigt. Respecte « réduire les animations ». */
export function PressableScale({ children, style, scaleTo = motion.pressScale, haptic = true, onPressIn, onPressOut, onPress, disabled, ...props }: Props) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reduceMotion) scale.value = withSpring(scaleTo, motion.spring);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.value = withSpring(1, motion.spring);
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic) haptics.tap();
        onPress?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
