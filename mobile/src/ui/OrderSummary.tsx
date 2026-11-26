import { StyleSheet, View } from "react-native";
import type { Order } from "@/api/types";
import { formatCdf, orderReference, splitProductName } from "@/lib/format";
import { colors, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { StatusBadge } from "./Badges";
import { Card, Divider, InfoRow } from "./Card";
import { ProductImage } from "./ProductImage";

/** Ligne produit compacte : vignette, modèle, couleur, quantité. */
export function OrderLine({ order }: { order: Order }) {
  const { model, color } = splitProductName(order.product.name);
  return (
    <View style={styles.line}>
      <ProductImage path={order.product.imageUrl} name={order.product.name} style={styles.thumb} />
      <View style={styles.lineText}>
        <AppText variant="h3" numberOfLines={1}>
          {model}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {[color, `Qté : ${order.quantity}`].filter(Boolean).join("  ·  ")}
        </AppText>
        <AppText variant="small">{formatCdf(order.unitPriceCdf)} / pièce</AppText>
      </View>
    </View>
  );
}

/**
 * Récapitulatif d'une commande telle que le serveur la décrit (référence,
 * produit, quantité, montant, statut). `statusOverride` sert à afficher
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
      <OrderLine order={order} />
      <Divider />
      <InfoRow label="Total" value={formatCdf(order.totalCdf)} strong />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  line: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 64, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lineText: { flex: 1, gap: 2 },
});
