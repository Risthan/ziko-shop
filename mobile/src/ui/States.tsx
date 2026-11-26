import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";

/** Bloc gris qui « respire » pendant le chargement (skeleton loader). */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useSharedValue(0.45);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!reduceMotion) opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);
  }, [opacity, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, style, animated]} />;
}

/** Indicateur de chargement, avec une explication si l'attente dure (serveur gratuit qui se réveille). */
export function LoadingState({ message, slowMessage, slowAfterMs = 6_000 }: { message: string; slowMessage?: string; slowAfterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [slowAfterMs]);
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.accent} />
      <AppText variant="bodyStrong" center>
        {message}
      </AppText>
      {slow && slowMessage ? (
        <Animated.View entering={FadeIn}>
          <AppText variant="small" center style={styles.text}>
            {slowMessage}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** État vide ou d'erreur, avec une action pour s'en sortir. */
export function EmptyState({ icon, title, message, action, tone = "neutral" }: { icon: IconName; title: string; message?: string; action?: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.center} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, tone === "danger" && styles.iconDanger]}>
        <Ionicons name={icon} size={30} color={tone === "danger" ? colors.danger : colors.textSecondary} />
      </View>
      <AppText variant="h2" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" center style={styles.text}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  text: { maxWidth: 320 },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  iconDanger: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSoft },
  action: { marginTop: spacing.sm, alignSelf: "stretch", maxWidth: 320, width: "100%", alignItems: "stretch" },
});
