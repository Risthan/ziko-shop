import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from "react-native-reanimated";
import { ApiError, api } from "@/api/client";
import type { Product } from "@/api/types";
import { MAX_PER_LINE } from "@/lib/cart/cartLogic";
import { cart, useCart } from "@/lib/cart/useCart";
import { formatCdf, splitProductName } from "@/lib/format";
import { useSession } from "@/lib/auth/session";
import { haptics } from "@/lib/haptics";
import { newIdempotencyKey } from "@/lib/ids";
import { queryKeys, rememberOrder, useProducts } from "@/lib/queries";
import type { Size } from "@/lib/sizes";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Button } from "@/ui/Button";
import { Card, Divider, InfoRow } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { Notice, type NoticeTone } from "@/ui/Notice";
import { PressableScale } from "@/ui/PressableScale";
import { ProductImage } from "@/ui/ProductImage";
import { QuantityStepper } from "@/ui/QuantityStepper";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { SizePicker } from "@/ui/SizePicker";
import { EmptyState, LoadingState } from "@/ui/States";

/**
 * Panier : plusieurs pulls, chacun avec sa quantité, essayables en direct.
 * « Commander » crée UNE commande pour tout le panier ; le panier se vide
 * quand elle est payée.
 */
export default function CartScreen() {
  const { lines, count } = useCart();
  const { status } = useSession();
  const signedIn = status === "signedIn";
  const products = useProducts();
  const client = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; title: string; message: string } | null>(null);
  const [stockSheet, setStockSheet] = useState<{ productId: string; available: number; message: string } | null>(null);

  const catalog = new Map((products.data ?? []).map((product) => [product.id, product]));
  const rows = lines.flatMap((line) => {
    const product = catalog.get(line.productId);
    return product ? [{ line, product }] : [];
  });
  const total = rows.reduce((sum, { line, product }) => sum + product.priceCdf * line.quantity, 0);
  const blocked = rows.filter(({ line, product }) => product.stock < line.quantity);

  const checkout = async () => {
    // Un compte est demandé pour commander ; le panier est conservé pendant la connexion.
    if (!signedIn) {
      router.push({ pathname: "/auth/login", params: { raison: "commande" } });
      return;
    }
    setCreating(true);
    setNotice(null);
    const { key, signature } = cart.checkoutKey(newIdempotencyKey);
    try {
      const order = await api.createOrder(
        rows.map(({ line }) => ({ productId: line.productId, quantity: line.quantity, size: line.size })),
        key,
      );
      cart.markOrdered(key, signature, order.id);
      await rememberOrder(client, order);
      router.push({ pathname: "/payment/[orderId]", params: { orderId: order.id } });
    } catch (error) {
      const err = error instanceof ApiError ? error : new ApiError("network", "Erreur inattendue.");
      haptics.error();
      if (err.code === "INSUFFICIENT_STOCK" && typeof err.details?.productId === "string") {
        setStockSheet({ productId: err.details.productId, available: Number(err.details.available ?? 0), message: err.message });
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

  if (lines.length > 0 && !products.data) {
    return (
      <Screen>
        <Header />
        {products.isError ? (
          <EmptyState tone="danger" icon="cloud-offline-outline" title="Serveur injoignable" action={<Button title="Réessayer" icon="refresh" onPress={() => void products.refetch()} />} />
        ) : (
          <LoadingState message="Chargement du panier…" />
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      {rows.length === 0 ? (
        <EmptyState
          icon="cart-outline"
          title="Votre panier est vide"
          message="Ajoutez un ou plusieurs pulls depuis la boutique ou l'essayage en direct."
          action={<Button title="Découvrir la collection" iconRight="arrow-forward" onPress={() => router.navigate("/")} />}
        />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.title}>
              <AppText variant="h1">Panier</AppText>
              <AppText variant="body">
                {count} pièce{count > 1 ? "s" : ""} · essayez chaque pull avant de commander.
              </AppText>
            </View>

            {rows.map(({ line, product }, index) => (
              <Animated.View
                key={product.id}
                entering={FadeInDown.delay(Math.min(index, 5) * motion.stagger).duration(motion.base)}
                exiting={FadeOut.duration(motion.fast)}
                layout={LinearTransition.duration(motion.base)}
              >
                <CartRow product={product} quantity={line.quantity} size={line.size} disabled={creating} />
              </Animated.View>
            ))}

            <Animated.View layout={LinearTransition.duration(motion.base)}>
              <Card>
                <InfoRow label={`Sous-total · ${count} pièce${count > 1 ? "s" : ""}`} value={formatCdf(total)} />
                <View style={{ height: spacing.sm }} />
                <InfoRow label="Livraison" value="À Kinshasa" />
                <Divider />
                <Animated.View key={total} entering={FadeIn.duration(motion.fast)}>
                  <InfoRow label="Total à payer" value={formatCdf(total)} strong />
                </Animated.View>
              </Card>
            </Animated.View>

            {blocked.length > 0 ? (
              <Notice
                tone="warning"
                title="Stock insuffisant"
                message={`Réduisez la quantité de : ${blocked.map(({ product }) => splitProductName(product.name).model + " " + (splitProductName(product.name).color ?? "")).join(", ")}.`}
              />
            ) : null}
            {notice ? <Notice {...notice} /> : null}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              title={signedIn ? `Commander · ${formatCdf(total)}` : "Se connecter pour commander"}
              icon={signedIn ? undefined : "log-in-outline"}
              iconRight={signedIn ? "arrow-forward" : undefined}
              loading={creating}
              loadingLabel="Création de la commande…"
              disabled={blocked.length > 0}
              onPress={() => void checkout()}
            />
          </View>
        </>
      )}

      <Sheet
        visible={!!stockSheet}
        onClose={() => setStockSheet(null)}
        icon="cube-outline"
        tone="warning"
        title={stockSheet?.available ? "Stock insuffisant" : "Article épuisé"}
        message={`${stockSheet?.message ?? ""} Aucune commande n'a été créée.`}
      >
        <Button
          title={stockSheet?.available ? `Passer à ${stockSheet.available} pièce${stockSheet.available > 1 ? "s" : ""}` : "Retirer l'article"}
          onPress={() => {
            if (stockSheet) cart.setQuantity(stockSheet.productId, stockSheet.available);
            setStockSheet(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}

function CartRow({ product, quantity, size, disabled }: { product: Product; quantity: number; size: Size; disabled: boolean }) {
  const { model, color } = splitProductName(product.name);
  const max = Math.max(1, Math.min(product.stock, MAX_PER_LINE));
  const soldOut = product.stock <= 0;
  return (
    <Card style={styles.row}>
      <PressableScale
        onPress={() => router.push({ pathname: "/product/[id]", params: { id: product.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Voir ${product.name}`}
      >
        <ProductImage path={product.imageUrl} name={product.name} style={styles.thumb} />
      </PressableScale>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3" numberOfLines={1}>
              {model}
            </AppText>
            <AppText variant="small" numberOfLines={1}>
              {color} · {formatCdf(product.priceCdf)}
            </AppText>
          </View>
          <PressableScale
            onPress={() => {
              haptics.tap();
              cart.remove(product.id);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Retirer ${product.name} du panier`}
            style={styles.remove}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
          </PressableScale>
        </View>
        {soldOut ? (
          <AppText variant="caption" color={colors.danger}>
            Épuisé — retirez-le pour commander le reste
          </AppText>
        ) : product.stock < quantity ? (
          <AppText variant="caption" color={colors.warning}>
            Plus que {product.stock} en stock
          </AppText>
        ) : null}
        <SizePicker compact value={size} onChange={(next) => cart.setSize(product.id, next)} disabled={disabled || soldOut} />
        <View style={styles.rowBottom}>
          <PressableScale
            onPress={() => router.navigate({ pathname: "/essayage", params: { produit: product.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Essayer ${product.name} en direct`}
            style={styles.tryOn}
          >
            <Ionicons name="scan-outline" size={15} color={colors.accent} />
            <AppText variant="small" color={colors.accent}>
              Essayer
            </AppText>
          </PressableScale>
          <QuantityStepper
            value={Math.min(quantity, max)}
            max={max}
            min={1}
            disabled={disabled || soldOut}
            onChange={(next) => cart.setQuantity(product.id, next, max)}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md, padding: spacing.md },
  thumb: { width: 84, borderRadius: radius.md },
  rowBody: { flex: 1, gap: spacing.sm, justifyContent: "space-between" },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  remove: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.backgroundSecondary },
  rowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  tryOn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, maxWidth: 640, width: "100%", alignSelf: "center", backgroundColor: colors.background },
});
