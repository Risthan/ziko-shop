import { StyleSheet, View } from "react-native";
import type { OrderStatus } from "@/api/types";
import { colors, fonts, radius } from "@/theme";
import { AppText } from "./AppText";

/** "unknown" : le réseau a coupé, l'app ne sait pas encore ce que le serveur a fait. */
type BadgeStatus = OrderStatus | "unknown";

const STYLES: Record<BadgeStatus, { label: string; bg: string; fg: string }> = {
  en_attente: { label: "En attente", bg: colors.warningSoft, fg: colors.warning },
  payee: { label: "Payée", bg: colors.successSoft, fg: colors.success },
  unknown: { label: "À confirmer", bg: colors.border, fg: colors.textMuted },
};

export function StatusBadge({ status }: { status: BadgeStatus }) {
  const style = STYLES[status];
  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <View style={[styles.dot, { backgroundColor: style.fg }]} />
      <AppText style={[styles.text, { color: style.fg }]}>{style.label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
});
