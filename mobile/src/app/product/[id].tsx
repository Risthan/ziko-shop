import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "@/api/client";
import type { Product } from "@/api/types";
import { AppText } from "@/components/AppText";
import { Button } from "@/components/Button";
import { ProductImage } from "@/components/ProductImage";
import { ErrorState, LoadingState } from "@/components/States";
import { API_URL } from "@/config";
import { formatCdf, normalize, splitProductName, stockLabel } from "@/lib/format";
import { productStore } from "@/lib/productStore";
import { useFeatures } from "@/lib/useFeatures";
import { colors, radius, spacing, swatchColors } from "@/theme";

/** Quelques mots sur chaque modèle (le nom, le prix et le stock viennent de l'API). */
const DESCRIPTIONS: Record<string, string> = {
  "Le Classique": "Sweat col rond en molleton épais 450 g/m², coupe ample, logo ZIKO SHOP brodé sur la poitrine.",
  "L'Essentiel": "Hoodie en molleton épais, capuche doublée sans cordons, grande poche kangourou, logo brodé.",
  "Le Signature": "Pull demi-zip en maille épaisse, col montant côtelé, zip métal gunmetal, logo brodé côté cœur.",
};

/** Écran 2 — La fiche produit : nom, prix, stock et bouton « Commander ». */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cached = productStore.get(id);
  const [product, setProduct] = useState<Product | undefined>(cached);
  const [error, setError] = useState<string | null>(null);
  const features = useFeatures();

  const load = useCallback(async () => {
    setError(null);
    try {
      const fresh = await api.getProduct(id);
      productStore.update(fresh);
      setProduct(fresh);
    } catch (err) {
      // Si on a déjà la version de la liste, on la garde affichée.
      if (!productStore.get(id)) setError(err instanceof ApiError ? err.message : "Erreur inattendue.");
    }
  }, [id]);

  useEffect(() => {
    setProduct(productStore.get(id));
    void load();
  }, [id, load]);

  if (!product) {
    return error ? (
      <ErrorState title="Produit indisponible" message={error} onRetry={() => void load()} />
    ) : (
      <LoadingState message="Chargement du produit…" />
    );
  }

  const { model, color } = splitProductName(product.name);
  const variants = productStore.variantsOf(model).filter((variant) => splitProductName(variant.name).color);
  const soldOut = product.stock <= 0;

  return (
    <SafeAreaView style={styles.screen} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProductImage path={product.imageUrl} name={product.name} style={styles.image} />

        <View style={styles.block}>
          <AppText variant="display">{model}</AppText>
          {color ? <AppText variant="caption">Couleur : {color}</AppText> : null}
          <AppText variant="price" style={styles.price}>
            {formatCdf(product.priceCdf)}
          </AppText>
          <View style={styles.stockRow}>
            <View style={[styles.dot, { backgroundColor: soldOut ? colors.danger : product.stock <= 3 ? colors.accent : colors.success }]} />
            <AppText variant="caption" color={colors.text}>
              {soldOut ? "Rupture de stock" : `Stock disponible : ${product.stock} pièce${product.stock > 1 ? "s" : ""}`}
            </AppText>
          </View>
        </View>

        {variants.length > 1 ? (
          <View style={styles.block}>
            <AppText variant="label">Couleurs</AppText>
            <View style={styles.swatches}>
              {variants.map((variant) => {
                const variantColor = splitProductName(variant.name).color ?? "";
                const selected = variant.id === product.id;
                return (
                  <Pressable
                    key={variant.id}
                    onPress={() => router.replace({ pathname: "/product/[id]", params: { id: variant.id } })}
                    style={[styles.swatchRing, selected && styles.swatchSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={`Couleur ${variantColor}, ${stockLabel(variant.stock)}`}
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.swatch, { backgroundColor: swatchColors[normalize(variantColor)] ?? colors.border }]} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {DESCRIPTIONS[model] ? (
          <AppText variant="body" muted style={styles.block}>
            {DESCRIPTIONS[model]}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title={soldOut ? "Rupture de stock" : "Commander"}
          disabled={soldOut}
          onPress={() => router.push({ pathname: "/order/[productId]", params: { productId: product.id } })}
        />
        {features.liveTryOn ? (
          <Button
            title="Essayer en direct"
            variant="secondary"
            icon="videocam-outline"
            accessibilityHint="Ouvre la caméra pour vous voir porter ce pull en direct"
            onPress={() => void WebBrowser.openBrowserAsync(`${API_URL}/essayage?produit=${product.id}`)}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl, maxWidth: 640, width: "100%", alignSelf: "center" },
  image: { width: "100%" },
  block: { gap: spacing.sm },
  price: { fontSize: 20, marginTop: spacing.xs },
  stockRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  swatches: { flexDirection: "row", gap: spacing.md },
  swatchRing: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" },
  swatchSelected: { borderColor: colors.text },
  swatch: { width: 30, height: 30, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
});
