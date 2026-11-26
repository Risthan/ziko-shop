import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "@/api/client";
import type { Product } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { Notice } from "@/components/Notice";
import { ProductImage } from "@/components/ProductImage";
import { QuantityStepper } from "@/components/QuantityStepper";
import { ErrorState, LoadingState } from "@/components/States";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCdf, shortOrderNumber, splitProductName } from "@/lib/format";
import { productStore } from "@/lib/productStore";
import { usePaymentFlow } from "@/lib/usePaymentFlow";
import { colors, radius, spacing } from "@/theme";

const MAX_PER_ORDER = 10;

/** Écran 3 — La commande et son paiement. */
export default function OrderScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | undefined>(() => productStore.get(productId));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [simulateCut, setSimulateCut] = useState(false);
  const flow = usePaymentFlow(productId);

  useEffect(() => {
    if (product) return;
    api
      .getProduct(productId)
      .then(setProduct)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Erreur inattendue."));
  }, [product, productId]);

  if (!product) {
    return loadError ? <ErrorState title="Produit indisponible" message={loadError} /> : <LoadingState message="Préparation de la commande…" />;
  }

  const { model, color } = splitProductName(product.name);
  const maxQuantity = Math.max(1, Math.min(product.stock, MAX_PER_ORDER));
  const orderLocked = flow.order !== null; // une fois la commande créée, la quantité est figée
  const total = flow.order?.totalCdf ?? product.priceCdf * quantity;
  const busy = flow.phase === "creating" || flow.phase === "paying";

  const onPay = async () => {
    const { availableStock } = await flow.pay(quantity, simulateCut);
    if (availableStock !== undefined) {
      // Le stock a changé entre-temps : on ajuste la fiche et la quantité possible.
      setProduct({ ...product, stock: availableStock });
      setQuantity((current) => Math.max(1, Math.min(current, availableStock)));
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Récapitulatif du produit */}
        <View style={styles.summary}>
          <ProductImage path={product.imageUrl} name={product.name} style={styles.thumb} />
          <View style={styles.summaryText}>
            <AppText variant="heading">{model}</AppText>
            {color ? <AppText variant="caption">{color}</AppText> : null}
            <AppText variant="caption">Prix unitaire : {formatCdf(flow.order?.unitPriceCdf ?? product.priceCdf)}</AppText>
          </View>
        </View>

        {/* Quantité et total */}
        <View style={styles.card}>
          <View style={styles.row}>
            <AppText variant="label">Quantité</AppText>
            {orderLocked ? (
              <AppText variant="price">{flow.order?.quantity}</AppText>
            ) : (
              <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} disabled={busy} />
            )}
          </View>
          {!orderLocked && product.stock <= MAX_PER_ORDER ? (
            <AppText variant="caption">
              {product.stock} pièce{product.stock > 1 ? "s" : ""} disponible{product.stock > 1 ? "s" : ""}
            </AppText>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.row}>
            <AppText variant="label">Total</AppText>
            <AppText variant="price" style={styles.total} accessibilityLiveRegion="polite">
              {formatCdf(total)}
            </AppText>
          </View>
        </View>

        {/* Ce qui s'est réellement passé */}
        {flow.notice ? <Notice {...flow.notice} /> : null}

        {/* Suivi de la commande, dès qu'elle existe */}
        {flow.order ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <AppText variant="label">Commande n° {shortOrderNumber(flow.order.id)}</AppText>
              <StatusBadge status={flow.order.status} />
            </View>
            {flow.paymentId ? (
              <AppText variant="caption" selectable>
                Identifiant de paiement : {flow.paymentId}
                {flow.attempts > 1 ? `\nRenvoyé à l'identique — tentative n° ${flow.attempts}` : ""}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {/* Actions, selon l'étape */}
      <View style={styles.actions}>
        {flow.phase === "paid" || flow.phase === "refused" ? (
          <Button title="Retour à la boutique" onPress={() => router.dismissAll()} />
        ) : flow.phase === "interrupted" ? (
          <>
            <Button title="Réessayer le paiement" icon="refresh" onPress={() => void flow.retry()} />
            <Button title="Vérifier le statut de la commande" variant="ghost" onPress={() => void flow.checkStatus()} />
          </>
        ) : (
          <>
            <Button
              title={`Payer ${formatCdf(total)}`}
              loading={busy}
              disabled={product.stock <= 0}
              onPress={() => void onPay()}
            />
            <AppText variant="caption" style={styles.hint}>
              Paiement Mobile Money simulé : l'app crée un identifiant de paiement unique et l'envoie au serveur.
            </AppText>
            <View style={styles.demo}>
              <View style={styles.demoText}>
                <AppText variant="caption" color={colors.text}>
                  Mode démo : couper le réseau
                </AppText>
                <AppText variant="caption">Le paiement arrive au serveur, mais la réponse se perd.</AppText>
              </View>
              <Switch
                value={simulateCut}
                onValueChange={setSimulateCut}
                disabled={busy}
                trackColor={{ true: colors.accent, false: colors.border }}
                accessibilityLabel="Simuler une coupure réseau pendant le paiement"
              />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  summary: { flexDirection: "row", gap: spacing.lg, alignItems: "center" },
  thumb: { width: 72 },
  summaryText: { flex: 1, gap: 2 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  total: { fontSize: 22, lineHeight: 28 },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  hint: { textAlign: "center" },
  demo: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingTop: spacing.xs },
  demoText: { flex: 1 },
});
