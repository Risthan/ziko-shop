import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { cart } from "@/lib/cart/useCart";
import { modelCopy, variantsOf } from "@/lib/catalog";
import { formatCdf, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useProduct, useProducts } from "@/lib/queries";
import { colors, fonts, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { StockBadge } from "@/ui/Badges";
import { AddedToCart } from "@/ui/AddedToCart";
import { CartButton } from "@/ui/CartButton";
import { Button, type IconName } from "@/ui/Button";
import { ColorSwatches } from "@/ui/ColorSwatches";
import { Header } from "@/ui/Header";
import { IconButton } from "@/ui/IconButton";
import { PressableScale } from "@/ui/PressableScale";
import { ProductImage } from "@/ui/ProductImage";
import { Screen } from "@/ui/Screen";
import { EmptyState, LoadingState } from "@/ui/States";

/** Écran 02 — Fiche produit. La variante choisie est gardée dans l'adresse de l'écran. */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const products = useProducts();
  const [addedId, setAddedId] = useState<string | null>(null);

  if (!product.data) {
    return (
      <Screen>
        <Header back />
        {product.isError ? (
          <EmptyState
            tone="danger"
            icon={product.error instanceof ApiError && product.error.status === 404 ? "help-circle-outline" : "cloud-offline-outline"}
            title={product.error instanceof ApiError && product.error.status === 404 ? "Produit introuvable" : "Serveur injoignable"}
            message={product.error instanceof ApiError ? product.error.message : undefined}
            action={<Button title="Réessayer" icon="refresh" onPress={() => void product.refetch()} />}
          />
        ) : (
          <LoadingState message="Chargement du produit…" />
        )}
      </Screen>
    );
  }

  const current = product.data;
  const { model, color } = splitProductName(current.name);
  const copy = modelCopy(model);
  const variants = variantsOf(products.data ?? [current], current);
  const soldOut = current.stock <= 0;
  // Changer de couleur = afficher la variante correspondante (image, prix et stock viennent de l'API).
  const selectVariant = (variantId: string) => router.setParams({ id: variantId });

  const share = () =>
    void Share.share({ message: `${current.name} — ${formatCdf(current.priceCdf)} sur Ziko Shop` }).catch(() => undefined);

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header
        back
        right={
          <View style={styles.headerActions}>
            <IconButton icon="share-outline" label="Partager ce produit" onPress={share} />
            <CartButton />
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Galerie : vignettes des couleurs + grande photo */}
        <View style={styles.gallery}>
          {variants.length > 1 ? (
            <View style={styles.thumbs}>
              {variants.map((variant) => (
                <PressableScale
                  key={variant.id}
                  onPress={() => selectVariant(variant.id)}
                  style={[styles.thumb, variant.id === current.id && styles.thumbActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir ${variant.name}`}
                  accessibilityState={{ selected: variant.id === current.id }}
                >
                  <ProductImage path={variant.imageUrl} name={variant.name} style={styles.thumbImage} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          <View style={styles.stage}>
            <LinearGradient
              colors={["rgba(208,245,75,0)", "rgba(208,245,75,0.10)", "rgba(208,245,75,0)"]}
              start={{ x: 0, y: 1 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <ProductImage path={current.imageUrl} name={current.name} style={styles.mainImage} />
          </View>
        </View>

        <Animated.View key={current.id} entering={FadeIn.duration(motion.base)} style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="display" numberOfLines={2}>
                {model}
              </AppText>
              <AppText variant="body">{copy.tagline}</AppText>
            </View>
            <StockBadge stock={current.stock} />
          </View>
          <AppText variant="priceLarge" style={styles.price}>
            {formatCdf(current.priceCdf)}
          </AppText>
        </Animated.View>

        {variants.length > 1 ? (
          <View style={styles.section}>
            <AppText variant="bodyStrong">
              Couleur : <AppText variant="body">{color}</AppText>
            </AppText>
            <ColorSwatches
              options={variants.map((variant) => ({
                id: variant.id,
                color: splitProductName(variant.name).color ?? "",
                disabled: variant.stock <= 0,
              }))}
              selectedId={current.id}
              onSelect={selectVariant}
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          {/* « Commander » reste l'action principale, comme le demande le sujet. */}
          <Button
            title={soldOut ? "Produit épuisé" : "Commander"}
            icon={soldOut ? "close-circle-outline" : "bag-handle-outline"}
            disabled={soldOut}
            onPress={() => router.push({ pathname: "/order/[productId]", params: { productId: current.id } })}
          />
          <View style={styles.actionRow}>
            <Button
              title="Au panier"
              variant="secondary"
              icon="cart-outline"
              disabled={soldOut}
              accessibilityHint="Ajoute ce pull au panier pour commander plusieurs articles"
              style={styles.half}
              onPress={() => {
                cart.add(current.id, 1, current.stock);
                haptics.success();
                setAddedId(current.id);
              }}
            />
            <Button
              title="Essayer"
              variant="secondary"
              icon="scan-outline"
              accessibilityHint="Ouvre l'essayage en direct avec la caméra"
              style={styles.half}
              onPress={() => router.navigate({ pathname: "/essayage", params: { produit: current.id } })}
            />
          </View>
          {addedId === current.id ? <AddedToCart name={model} /> : null}
        </View>

        <View style={styles.accordions}>
          <Accordion icon="document-text-outline" title="Description du produit" text={copy.description} initiallyOpen />
          <Accordion icon="layers-outline" title="Matière et entretien" text={copy.material} />
        </View>

        <View style={styles.trust}>
          <TrustItem icon="location-outline" title="Livraison" text="À Kinshasa" />
          <TrustItem icon="shield-checkmark-outline" title="Paiement" text="Jamais débité 2 fois" />
          <TrustItem icon="pulse-outline" title="Stock" text="En temps réel" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Accordion({ icon, title, text, initiallyOpen }: { icon: IconName; title: string; text: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(!!initiallyOpen);
  if (!text) return null;
  return (
    <View style={styles.accordion}>
      <PressableScale
        haptic={false}
        onPress={() => setOpen((value) => !value)}
        style={styles.accordionHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Ionicons name={icon} size={20} color={colors.textSecondary} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </AppText>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.textSecondary} />
      </PressableScale>
      {open ? (
        <Animated.View entering={FadeInDown.duration(motion.base)}>
          <AppText variant="body" style={styles.accordionText}>
            {text}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

function TrustItem({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={20} color={colors.text} />
      <AppText variant="bodyStrong" center style={styles.trustTitle}>
        {title}
      </AppText>
      <AppText variant="caption" center>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl, maxWidth: 640, width: "100%", alignSelf: "center" },
  gallery: { flexDirection: "row", gap: spacing.md },
  thumbs: { width: 62, gap: spacing.sm },
  thumb: { borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 2 },
  thumbActive: { borderColor: colors.accent },
  thumbImage: { width: "100%", borderRadius: radius.sm },
  stage: { flex: 1, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.surface },
  mainImage: { width: "100%", borderRadius: 0 },
  titleBlock: { gap: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  price: { marginTop: spacing.xs },
  section: { gap: spacing.md },
  actions: { gap: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.md },
  headerActions: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1, paddingHorizontal: spacing.sm },
  accordions: { gap: spacing.sm },
  accordion: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  accordionHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, minHeight: 56 },
  accordionText: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, marginTop: -spacing.xs },
  trust: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.xl },
  trustItem: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: spacing.xs },
  trustTitle: { fontFamily: fonts.bold, fontSize: 13 },
});
