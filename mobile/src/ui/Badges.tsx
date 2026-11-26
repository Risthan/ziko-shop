import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import type { OrderStatus } from "@/api/types";
import { colors, fonts, radius } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";

type Tone = "accent" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, { fg: string; bg: string; border: string }> = {
  accent: { fg: colors.accent, bg: colors.accentSoft, border: colors.accentBorder },
  warning: { fg: colors.warning, bg: colors.warningSoft, border: colors.warningBorder },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: colors.dangerBorder },
  neutral: { fg: colors.textSecondary, bg: colors.surfaceRaised, border: colors.border },
};

export function Badge({ label, tone, icon, size = "md" }: { label: string; tone: Tone; icon?: IconName; size?: "md" | "sm" }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, size === "sm" && styles.small, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Ionicons name={icon} size={size === "sm" ? 11 : 14} color={t.fg} /> : null}
      <AppText style={[styles.text, size === "sm" && styles.textSmall, { color: t.fg }]} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/** Indicateur de stock : le client voit tout de suite s'il peut commander. */
export function StockBadge({ stock, size }: { stock: number; size?: "md" | "sm" }) {
  if (stock <= 0) return <Badge label="Épuisé" tone="danger" size={size} />;
  if (stock <= 3) return <Badge label={`Plus que ${stock}`} tone="warning" size={size} />;
  return <Badge label={`Stock : ${stock}`} tone="accent" size={size} />;
}

/**
 * Statut d'une commande, tel que renvoyé par le serveur. « unknown » : la
 * connexion a coupé et le serveur n'a pas encore confirmé — on ne prétend rien.
 */
export function StatusBadge({ status }: { status: OrderStatus | "unknown" }) {
  if (status === "payee") return <Badge label="Payée" tone="accent" icon="checkmark-circle" />;
  if (status === "en_attente") return <Badge label="En attente" tone="warning" icon="time-outline" />;
  return <Badge label="À confirmer" tone="neutral" icon="help-circle-outline" />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 9, paddingVertical: 3, gap: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13 },
  textSmall: { fontSize: 11 },
});
