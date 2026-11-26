import { Pressable, StyleSheet, View } from "react-native";
import type { Product } from "@/api/types";
import { formatCdf, splitProductName, stockLabel } from "@/lib/format";
import { colors, fonts, spacing } from "@/theme";
import { AppText } from "./AppText";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product, width, onPress }: { product: Product; width: number; onPress: () => void }) {
  const { model, color } = splitProductName(product.name);
  const soldOut = product.stock <= 0;
  const lowStock = !soldOut && product.stock <= 3;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatCdf(product.priceCdf)}, ${stockLabel(product.stock)}`}
    >
      <ProductImage path={product.imageUrl} name={product.name} style={soldOut && styles.soldOutImage} />
      <View style={styles.info}>
        <AppText variant="heading" numberOfLines={1}>
          {model}
        </AppText>
        {color ? (
          <AppText variant="caption" numberOfLines={1}>
            {color}
          </AppText>
        ) : null}
        <AppText variant="price" style={styles.price}>
          {formatCdf(product.priceCdf)}
        </AppText>
        <AppText
          variant="caption"
          color={soldOut ? colors.danger : lowStock ? colors.accent : colors.textMuted}
          style={lowStock || soldOut ? styles.stockAlert : undefined}
        >
          {stockLabel(product.stock)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.75 },
  soldOutImage: { opacity: 0.5 },
  info: { paddingTop: spacing.sm, gap: 2 },
  price: { marginTop: 4 },
  stockAlert: { fontFamily: fonts.medium },
});
