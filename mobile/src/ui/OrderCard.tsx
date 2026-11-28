import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Order } from "@/api/types";
import { formatCdf, formatDateTime, orderReference, splitProductName } from "@/lib/format";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { StatusBadge } from "./Badges";
import { PressableScale } from "./PressableScale";
import { ProductImage } from "./ProductImage";

/** « Le Classique · Noir · M · Qté 2 », ou pour un panier « 2 articles · 3 pièces » (court, lisible sur petit écran). */
function describeOrder(order: Order): string {
  const first = order.items[0];
  if (!first) return "";
  if (order.items.length === 1) {
    const { model, color } = splitProductName(first.product.name);
    return `${[model, color, first.size].filter(Boolean).join(" · ")} · Qté ${first.quantity}`;
  }
  return `${order.items.length} articles · ${order.itemCount} pièce${order.itemCount > 1 ? "s" : ""}`;
}

/** Une commande de l'historique : vignette, référence, statut réel, montant, date. */
export function OrderCard({ order, index = 0 }: { order: Order; index?: number }) {
  const first = order.items[0];
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(motion.base)}>
      <PressableScale
        onPress={() => router.push({ pathname: "/orders/[id]", params: { id: order.id } })}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`Commande ${orderReference(order.id)}, ${formatCdf(order.totalCdf)}`}
      >
        <View>
          <ProductImage path={first?.product.imageUrl ?? null} name={first?.product.name ?? "Commande"} style={styles.thumb} />
          {order.items.length > 1 ? (
            <View style={styles.more}>
              <AppText variant="caption" color={colors.onAccent}>
                +{order.items.length - 1}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.body}>
          <View style={styles.line}>
            <AppText variant="bodyStrong">{orderReference(order.id)}</AppText>
            <StatusBadge status={order.status} />
          </View>
          <AppText variant="small" numberOfLines={1}>
            {describeOrder(order)}
          </AppText>
          <View style={styles.line}>
            <AppText variant="price">{formatCdf(order.totalCdf)}</AppText>
            <AppText variant="caption">{formatDateTime(order.createdAt)}</AppText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: { width: 64, height: 80, borderRadius: radius.sm },
  more: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
});
