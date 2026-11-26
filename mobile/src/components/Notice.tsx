import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/theme";
import { AppText } from "./AppText";

export type NoticeTone = "success" | "warning" | "danger" | "info";

const tones: Record<NoticeTone, { bg: string; fg: string; icon: ComponentProps<typeof Ionicons>["name"] }> = {
  success: { bg: colors.successSoft, fg: colors.success, icon: "checkmark-circle" },
  warning: { bg: colors.warningSoft, fg: colors.warning, icon: "wifi-outline" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, icon: "alert-circle" },
  info: { bg: colors.surface, fg: colors.text, icon: "information-circle-outline" },
};

/** Encadré de message : ce qui s'est RÉELLEMENT passé, en mots simples. */
export function Notice({ tone, title, message }: { tone: NoticeTone; title: string; message: string }) {
  const style = tones[tone];
  return (
    <View
      style={[styles.box, { backgroundColor: style.bg, borderColor: style.fg }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={style.icon} size={22} color={style.fg} style={styles.icon} />
      <View style={styles.texts}>
        <AppText style={[styles.title, { color: style.fg }]}>{title}</AppText>
        <AppText variant="caption" color={colors.text}>
          {message}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: { marginTop: 1 },
  texts: { flex: 1, gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 15 },
});
