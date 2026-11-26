import { StyleSheet, View } from "react-native";
import type { OrderStatus } from "@/api/types";
import { colors, fonts, radius } from "@/theme";
import { AppText } from "./AppText";

const LABELS: Record<OrderStatus, string> = { en_attente: "En attente", payee: "Payée" };

export function StatusBadge({ status }: { status: OrderStatus }) {
  const paid = status === "payee";
  return (
    <View style={[styles.badge, { backgroundColor: paid ? colors.successSoft : colors.warningSoft }]}>
      <View style={[styles.dot, { backgroundColor: paid ? colors.success : colors.warning }]} />
      <AppText style={[styles.text, { color: paid ? colors.success : colors.warning }]}>{LABELS[status]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
});
