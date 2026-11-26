import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius, spacing } from "@/theme";
import { AppText } from "./AppText";

/** Carte de surface : fond #171E24, bordure fine, coins arrondis. */
export function Card({ children, style, tone = "default" }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: "default" | "accent" }) {
  return <View style={[styles.card, tone === "accent" && styles.accent, style]}>{children}</View>;
}

/** Titre de section avec action facultative à droite. */
export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="h2">{title}</AppText>
      {right}
    </View>
  );
}

/** Ligne libellé / valeur des récapitulatifs. */
export function InfoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant={strong ? "bodyStrong" : "body"}>{label}</AppText>
      <AppText variant={strong ? "priceLarge" : "price"} color={strong ? colors.accent : colors.text} style={styles.value}>
        {value}
      </AppText>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  accent: { borderColor: colors.accentBorder, backgroundColor: "rgba(208, 245, 75, 0.05)" },
  section: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" },
  value: { textAlign: "right" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: spacing.md },
});
