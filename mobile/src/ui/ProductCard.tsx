import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Product } from "@/api/types";
import { formatCdf, splitProductName } from "@/lib/format";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { StockBadge } from "./Badges";
import { ColorDots } from "./ColorSwatches";
import { PressableScale } from "./PressableScale";
import { ProductImage } from "./ProductImage";
import { Skeleton } from "./States";

interface Props {
  product: Product;
  width: number;
  /** Couleurs disponibles pour ce modèle (aperçu). */
  modelColors: string[];
  index: number;
  onPress: () => void;
}

/** Carte produit de la grille (2 par ligne sur téléphone). Apparition en cascade. */
export function ProductCard({ product, width, modelColors, index, onPress }: Props) {
  const { model, color } = splitProductName(product.name);
  const soldOut = product.stock <= 0;

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
            <AppText variant="h3" numberOfLines={1} style={styles.name}>
              {model}
            </AppText>
          </View>
          <View style={styles.colorRow}>
            <AppText variant="caption" numberOfLines={1} style={styles.colorName}>
              {color ?? "Pull"}
            </AppText>
            {modelColors.length > 1 ? <ColorDots colorsList={modelColors} active={color ?? undefined} /> : null}
          </View>
          <AppText variant="price" numberOfLines={1}>
            {formatCdf(product.priceCdf)}
          </AppText>
          <StockBadge stock={product.stock} size="sm" />
        </View>
      </PressableScale>
    </Animated.View>
  );
}

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
  image: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  soldOut: { opacity: 0.4 },
  info: { paddingHorizontal: spacing.xs, paddingBottom: spacing.xs, gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1 },
  colorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs, marginTop: -4 },
  colorName: { flexShrink: 1 },
});
