import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, FadeOut, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { colors, radius } from "@/theme";
import { AppText } from "./AppText";
import { Logo } from "./Logo";

/**
 * Écran d'accueil animé, affiché UNIQUEMENT à la toute première ouverture de
 * l'app : le logo apparaît, une fine ligne de chargement se remplit, puis
 * l'écran s'efface. Pendant ce temps, l'app charge déjà le catalogue.
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const reduceMotion = useReducedMotion();
  const logo = useSharedValue(0);
  const progress = useSharedValue(0);
  const tagline = useSharedValue(0);

  useEffect(() => {
    const total = reduceMotion ? 600 : 1900;
    logo.value = withTiming(1, { duration: reduceMotion ? 0 : 650, easing: Easing.out(Easing.cubic) });
    tagline.value = withDelay(reduceMotion ? 0 : 450, withTiming(1, { duration: 500 }));
    progress.value = withTiming(1, { duration: total, easing: Easing.inOut(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [logo, onDone, progress, reduceMotion, tagline]);

  const logoStyle = useAnimatedStyle(() => ({ opacity: logo.value, transform: [{ scale: 0.92 + logo.value * 0.08 }] }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value, transform: [{ translateY: (1 - tagline.value) * 6 }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <Animated.View exiting={FadeOut.duration(380)} style={styles.root} accessibilityLabel="Chargement de Ziko Shop">
      <Animated.View style={logoStyle}>
        <Logo width={210} />
      </Animated.View>
      <Animated.View style={taglineStyle}>
        <AppText variant="small" center style={styles.tagline}>
          Modern Wear. Smart Shopping.
        </AppText>
      </Animated.View>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    zIndex: 100,
  },
  tagline: { letterSpacing: 1.2 },
  track: { width: 140, height: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised, overflow: "hidden", marginTop: 10 },
  bar: { height: "100%", backgroundColor: colors.accent, borderRadius: radius.pill },
});
