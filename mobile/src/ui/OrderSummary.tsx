import { StyleSheet, View } from "react-native";
import type { Order, OrderItem } from "@/api/types";
import { formatCdf, orderReference, splitProductName } from "@/lib/format";
import { colors, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { StatusBadge } from "./Badges";
import { Card, Divider, InfoRow } from "./Card";
import { ProductImage } from "./ProductImage";

/** Ligne article compacte : vignette, modèle, couleur, taille, quantité, montant. */
export function OrderLine({ item }: { item: OrderItem }) {
  const { model, color } = splitProductName(item.product.name);
  return (
    <View style={styles.line}>
      <ProductImage path={item.product.imageUrl} name={item.product.name} style={styles.thumb} />
      <View style={styles.lineText}>
        <AppText variant="h3" numberOfLines={1}>
          {model}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {[color, item.size ? `Taille ${item.size}` : null, `Qté : ${item.quantity}`].filter(Boolean).join("  ·  ")}
        </AppText>
        <AppText variant="small">{formatCdf(item.unitPriceCdf)} / pièce</AppText>
      </View>
      {item.quantity > 1 ? <AppText variant="bodyStrong">{formatCdf(item.lineTotalCdf)}</AppText> : null}
    </View>
  );
}

/** Tous les articles d'une commande, séparés par un trait fin. */
export function OrderLines({ order }: { order: Order }) {
  return (
    <View style={styles.lines}>
      {order.items.map((item, index) => (
        <View key={item.productId} style={styles.lines}>
          {index > 0 ? <View style={styles.hairline} /> : null}
          <OrderLine item={item} />
        </View>
      ))}
    </View>
  );
}

/** « 3 pièces · 2 articles » ou « 1 pièce ». */
export function orderCountLabel(order: Order): string {
  const pieces = `${order.itemCount} pièce${order.itemCount > 1 ? "s" : ""}`;
  return order.items.length > 1 ? `${pieces} · ${order.items.length} articles` : pieces;
}

/**
 * Récapitulatif d'une commande telle que le serveur la décrit (référence,
 * articles, quantités, montant, statut). `statusOverride` sert à afficher
 * « À confirmer » quand la réponse du serveur n'est pas arrivée.
 */
export function OrderSummary({ order, statusOverride, title = "Récapitulatif" }: { order: Order; statusOverride?: "unknown"; title?: string }) {
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <AppText variant="caption">{title}</AppText>
          <AppText variant="h3" selectable>
            {orderReference(order.id)}
          </AppText>
        </View>
        <StatusBadge status={statusOverride ?? order.status} />
      </View>
      <Divider />
      <OrderLines order={order} />
      <Divider />
      <InfoRow label={`Total · ${order.itemCount} pièce${order.itemCount > 1 ? "s" : ""}`} value={formatCdf(order.totalCdf)} strong />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  lines: { gap: spacing.md },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  line: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 64, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lineText: { flex: 1, gap: 2 },
});
