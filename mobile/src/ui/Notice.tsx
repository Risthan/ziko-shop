import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { colors, fonts, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";

export type NoticeTone = "success" | "warning" | "danger" | "info";

const TONES: Record<NoticeTone, { fg: string; bg: string; border: string; icon: IconName }> = {
  success: { fg: colors.accent, bg: "rgba(208, 245, 75, 0.06)", border: colors.accentBorder, icon: "shield-checkmark-outline" },
  warning: { fg: colors.warning, bg: colors.warningSoft, border: colors.warningBorder, icon: "alert-circle-outline" },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: colors.dangerBorder, icon: "close-circle-outline" },
  info: { fg: colors.text, bg: colors.surface, border: colors.border, icon: "information-circle-outline" },
};

/** Message intégré : ce qui s'est réellement passé, en mots simples. */
export function Notice({ tone, title, message, icon }: { tone: NoticeTone; title: string; message?: string; icon?: IconName }) {
  const t = TONES[tone];
  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      style={[styles.box, { backgroundColor: t.bg, borderColor: t.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={icon ?? t.icon} size={24} color={t.fg} />
      <View style={styles.texts}>
        <AppText style={[styles.title, { color: t.fg }]}>{title}</AppText>
        {message ? <AppText variant="small">{message}</AppText> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, alignItems: "flex-start" },
  texts: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
});
