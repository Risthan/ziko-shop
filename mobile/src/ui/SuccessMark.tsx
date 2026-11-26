import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { colors, shadows } from "@/theme";

/** Validation animée : le cercle apparaît, puis la coche « tombe » en place. */
export function SuccessMark({ size = 112 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const ring = useSharedValue(reduceMotion ? 1 : 0.6);
  const ringOpacity = useSharedValue(reduceMotion ? 1 : 0);
  const check = useSharedValue(reduceMotion ? 1 : 0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    ringOpacity.value = withTiming(1, { duration: 220 });
    ring.value = withSpring(1, { damping: 12, stiffness: 160 });
    check.value = withDelay(180, withSpring(1, { damping: 9, stiffness: 200 }));
    halo.value = withDelay(260, withSequence(withTiming(1, { duration: 420 }), withTiming(0, { duration: 700 })));
  }, [check, halo, reduceMotion, ring, ringOpacity]);

  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOpacity.value, transform: [{ scale: ring.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: check.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value * 0.5, transform: [{ scale: 1 + halo.value * 0.35 }] }));

  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: "center", justifyContent: "center" }} accessibilityLabel="Paiement confirmé">
      <Animated.View style={[styles.halo, { width: size, height: size, borderRadius: size / 2 }, haloStyle]} />
      <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, shadows.accentGlow, ringStyle]}>
        <Animated.View style={checkStyle}>
          <Ionicons name="checkmark" size={size * 0.52} color={colors.onAccent} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", borderWidth: 2, borderColor: colors.accent },
  ring: { backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
});
