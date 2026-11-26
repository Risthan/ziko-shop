import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ApiError, api } from "@/api/client";
import { modelCopy } from "@/lib/catalog";
import { formatCdf, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { newIdempotencyKey } from "@/lib/ids";
import { queryKeys, rememberOrder, useProduct } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { StockBadge } from "@/ui/Badges";
import { Button } from "@/ui/Button";
import { Card, Divider, InfoRow } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { Notice, type NoticeTone } from "@/ui/Notice";
import { ProductImage } from "@/ui/ProductImage";
import { QuantityStepper } from "@/ui/QuantityStepper";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { EmptyState, LoadingState } from "@/ui/States";

const MAX_PER_ORDER = 10;

/**
 * Écran 04 — Commande : un produit et une quantité (comme le demande le sujet).
 * La commande est créée sur le serveur au moment de passer au paiement.
 */
export default function OrderScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const product = useProduct(productId);
  const client = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; title: string; message: string } | null>(null);
  const [stockSheet, setStockSheet] = useState<{ available: number; message: string } | null>(null);
  // Même clé si on renvoie la même commande (réseau coupé) : le serveur ne la crée pas deux fois.
  const orderKey = useRef<{ key: string; quantity: number } | null>(null);

  if (!product.data) {
    return (
      <Screen>
        <Header back />
        {product.isError ? (
          <EmptyState tone="danger" icon="cloud-offline-outline" title="Produit indisponible" action={<Button title="Réessayer" icon="refresh" onPress={() => void product.refetch()} />} />
        ) : (
          <LoadingState message="Préparation de la commande…" />
        )}
      </Screen>
    );
  }

  const current = product.data;
  const { model, color } = splitProductName(current.name);
  const maxQuantity = Math.max(1, Math.min(current.stock, MAX_PER_ORDER));
  const safeQuantity = Math.min(quantity, maxQuantity);
  const total = current.priceCdf * safeQuantity;
  const soldOut = current.stock <= 0;

  const createOrder = async () => {
    setCreating(true);
    setNotice(null);
    const previous = orderKey.current;
    const key = previous && previous.quantity === safeQuantity ? previous.key : newIdempotencyKey();
    orderKey.current = { key, quantity: safeQuantity };
    try {
      const order = await api.createOrder(current.id, safeQuantity, key);
      await rememberOrder(client, order);
      router.push({ pathname: "/payment/[orderId]", params: { orderId: order.id } });
    } catch (error) {
      const err = error instanceof ApiError ? error : new ApiError("network", "Erreur inattendue.");
      haptics.error();
      if (err.code === "INSUFFICIENT_STOCK") {
        const available = Number(err.details?.available ?? 0);
        setStockSheet({ available, message: err.message });
        void client.invalidateQueries({ queryKey: queryKeys.product(current.id) });
        void client.invalidateQueries({ queryKey: queryKeys.products });
      } else if (err.isConnectivityIssue) {
        setNotice({
          tone: "warning",
          title: "Serveur injoignable",
          message: `${err.message} Votre commande n'a pas été enregistrée et rien n'a été débité. Réessayez.`,
        });
      } else {
        setNotice({ tone: "danger", title: "Commande impossible", message: err.message });
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.title}>
          <AppText variant="h1">Votre commande</AppText>
          <AppText variant="body">Choisissez la quantité, le total se met à jour.</AppText>
        </View>

        <Card style={styles.productCard}>
          <ProductImage path={current.imageUrl} name={current.name} style={styles.thumb} />
          <View style={styles.productText}>
            <AppText variant="h2" numberOfLines={1}>
              {model}
            </AppText>
            <AppText variant="small" numberOfLines={1}>
              {modelCopy(model).tagline}
            </AppText>
            <AppText variant="small">Couleur : {color}</AppText>
            <View style={styles.productBottom}>
              <AppText variant="price">{formatCdf(current.priceCdf)}</AppText>
              <StockBadge stock={current.stock} size="sm" />
            </View>
          </View>
        </Card>

        <Card style={styles.quantityCard}>
          <View style={styles.quantityRow}>
            <View style={styles.quantityLabel}>
              <AppText variant="bodyStrong">Quantité</AppText>
              <AppText variant="caption">
                {soldOut ? "Épuisé" : `${current.stock} disponible${current.stock > 1 ? "s" : ""} · ${MAX_PER_ORDER} max. par commande`}
              </AppText>
            </View>
            <QuantityStepper value={safeQuantity} max={maxQuantity} onChange={setQuantity} disabled={creating || soldOut} />
          </View>
        </Card>

        <Card>
          <InfoRow label="Prix unitaire" value={formatCdf(current.priceCdf)} />
          <View style={{ height: spacing.sm }} />
          <InfoRow label="Quantité" value={`× ${safeQuantity}`} />
          <Divider />
          <Animated.View key={total} entering={FadeIn.duration(motion.fast)}>
            <InfoRow label="Total à payer" value={formatCdf(total)} strong />
          </Animated.View>
        </Card>

        {notice ? <Notice {...notice} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={soldOut ? "Produit épuisé" : "Continuer vers le paiement"}
          iconRight={soldOut ? undefined : "arrow-forward"}
          loading={creating}
          loadingLabel="Création de la commande…"
          disabled={soldOut}
          onPress={() => void createOrder()}
        />
      </View>

      <Sheet
        visible={!!stockSheet}
        onClose={() => setStockSheet(null)}
        icon="cube-outline"
        tone="warning"
        title={stockSheet?.available ? "Stock insuffisant" : "Produit épuisé"}
        message={`${stockSheet?.message ?? ""} Aucune commande n'a été créée.`}
      >
        {stockSheet && stockSheet.available > 0 ? (
          <Button
            title={`Commander ${stockSheet.available} pièce${stockSheet.available > 1 ? "s" : ""}`}
            onPress={() => {
              setQuantity(stockSheet.available);
              setStockSheet(null);
            }}
          />
        ) : null}
        <Button title="Retour à la boutique" variant="secondary" onPress={() => router.dismissTo("/")} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs },
  productCard: { flexDirection: "row", gap: spacing.lg, padding: spacing.md, alignItems: "center" },
  thumb: { width: 96, borderRadius: radius.md },
  productText: { flex: 1, gap: 3 },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, marginTop: spacing.xs, flexWrap: "wrap" },
  quantityCard: { paddingVertical: spacing.md },
  quantityRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
  quantityLabel: { flex: 1, gap: 2 },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, maxWidth: 640, width: "100%", alignSelf: "center", backgroundColor: colors.background },
});
