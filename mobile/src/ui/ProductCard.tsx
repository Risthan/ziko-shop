import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import type { Product } from "@/api/types";
import { cart } from "@/lib/cart/useCart";
import { formatCdf, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { swatchFor } from "@/lib/swatches";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { StockBadge } from "./Badges";
import { PressableScale } from "./PressableScale";
import { ProductImage } from "./ProductImage";
import { Skeleton } from "./States";

interface Props {
  product: Product;
  width: number;
  index: number;
  onPress: () => void;
}

/**
 * Carte produit de la grille (2 par ligne sur téléphone), sous l'en-tête de son
 * modèle : elle montre donc la couleur (avec sa vraie pastille), le prix et le
 * stock. Photo en 4:5 : le pull entier est visible, capuche et poignets compris.
 * Le petit bouton « + » ajoute le pull au panier sans ouvrir la fiche : c'est la
 * deuxième façon d'ajouter au panier (la première est sur la fiche produit).
 */
export function ProductCard({ product, width, index, onPress }: Props) {
  const { model, color } = splitProductName(product.name);
  const swatch = color ? swatchFor(color) : null;
  const soldOut = product.stock <= 0;
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(timer);
  }, [added]);

  const quickAdd = () => {
    cart.add(product.id, 1, product.stock);
    haptics.success();
    setAdded(true);
  };

  // Le « + » est posé sur la photo, dans son coin bas droit. Il est À CÔTÉ de la
  // carte (pas dedans) : deux boutons ne sont jamais imbriqués, et toucher le
  // « + » n'ouvre pas la fiche.
  const inset = StyleSheet.hairlineWidth + spacing.sm;
  const imageHeight = ((width - inset * 2) * 5) / 4;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * motion.stagger).duration(motion.slow)} style={{ width }}>
      <PressableScale
        onPress={onPress}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={`${product.name}, ${formatCdf(product.priceCdf)}, ${soldOut ? "épuisé" : `${product.stock} en stock`}`}
      >
        <ProductImage path={product.imageUrl} name={product.name} fit="cover" style={[styles.image, soldOut && styles.soldOut]} />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
            <AppText variant="h3" numberOfLines={1} style={styles.name}>
              {color ?? model}
            </AppText>
          </View>
          <AppText variant="price" numberOfLines={1}>
            {formatCdf(product.priceCdf)}
          </AppText>
          <StockBadge stock={product.stock} size="sm" />
        </View>
      </PressableScale>
      {soldOut ? null : (
        <PressableScale
          haptic={false}
          onPress={quickAdd}
          hitSlop={8}
          style={[styles.quickAdd, { top: inset + imageHeight - QUICK_ADD - spacing.sm, right: inset + spacing.sm }, added && styles.quickAdded]}
          accessibilityRole="button"
          accessibilityLabel={added ? `${product.name} ajouté au panier` : `Ajouter ${product.name} au panier`}
        >
          <Animated.View key={added ? "ok" : "add"} entering={ZoomIn.duration(motion.fast)}>
            <Ionicons name={added ? "checkmark" : "add"} size={22} color={added ? colors.onAccent : colors.text} />
          </Animated.View>
        </PressableScale>
      )}
    </Animated.View>
  );
}

const QUICK_ADD = 38;

export function ProductCardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.card, { width }]}>
      <Skeleton style={styles.image} />
      <View style={styles.info}>
        <Skeleton style={{ height: 16, width: "70%" }} />
        <Skeleton style={{ height: 12, width: "40%" }} />
        <Skeleton style={{ height: 16, width: "55%" }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  image: { width: "100%", aspectRatio: 4 / 5, borderRadius: radius.md },
  soldOut: { opacity: 0.4 },
  quickAdd: {
    position: "absolute",
    width: QUICK_ADD,
    height: QUICK_ADD,
    borderRadius: QUICK_ADD / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  quickAdded: { backgroundColor: colors.accent, borderColor: colors.accent },
  info: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  name: { flex: 1 },
});
