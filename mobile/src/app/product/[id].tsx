import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { PixelRatio, ScrollView, Share, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { cart } from "@/lib/cart/useCart";
import { modelCopy, variantsOf } from "@/lib/catalog";
import { formatCdf, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { prefetchProductImages } from "@/lib/prefetch";
import { useProduct, useProducts } from "@/lib/queries";
import { colors, fonts, motion, photoBackdrop, radius, spacing } from "@/theme";
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

const MAX_CONTENT = 640;
const THUMB_MAX = 62;
/** Bordure (1,5) et marge intérieure (2) d'une vignette, des deux côtés. */
const THUMB_CHROME = 7;
const THUMB_MIN = 40;

/**
 * Tailles exactes de la galerie : la grande photo (3:4) et la colonne de
 * vignettes (3:4) ont la même hauteur, quel que soit le nombre de couleurs.
 * On prend la plus grande vignette (62 pt au plus) pour laquelle la colonne
 * tient dans la hauteur de la grande photo ; au-delà de ~7 couleurs, les
 * vignettes deviendraient trop petites et la photo prend toute la largeur
 * (les pastilles restent là pour changer de couleur).
 */
function galleryLayout(contentWidth: number, count: number) {
  const round = PixelRatio.roundToNearestPixel;
  const gapX = spacing.md;
  const gapY = spacing.sm;
  const fit =
    ((4 / 3) * (contentWidth - gapX) - (count - 1) * gapY + (count * THUMB_CHROME) / 3) / ((4 / 3) * (count + 1));
  const thumbWidth = count > 1 && fit >= THUMB_MIN ? Math.floor(Math.min(THUMB_MAX, fit)) : 0;
  const mainWidth = round(thumbWidth ? contentWidth - thumbWidth - gapX : contentWidth);
  const height = round((mainWidth * 4) / 3);
  // Quand les vignettes remplissent presque la hauteur, on les répartit sur toute
  // la hauteur : la dernière s'arrête pile au bas de la grande photo.
  const columnHeight = count * (((thumbWidth - THUMB_CHROME) * 4) / 3 + THUMB_CHROME) + (count - 1) * gapY;
  const fillColumn = thumbWidth > 0 && height - columnHeight <= gapY * 2;
  return { thumbWidth, thumbImageWidth: thumbWidth - THUMB_CHROME, mainWidth, height, fillColumn };
}

/** Écran 02 — Fiche produit. La variante choisie est gardée dans l'adresse de l'écran. */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useProduct(id);
  const products = useProducts();
  const [addedId, setAddedId] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const current = product.data;
  const variants = current ? variantsOf(products.data ?? [current], current) : [];

  // Les photos des autres couleurs sont chargées d'avance : changer de couleur est instantané.
  const variantKey = variants.map((variant) => variant.imageUrl).join("|");
  useEffect(() => {
    prefetchProductImages(variants);
  }, [variantKey]); // la liste change d'identité à chaque rendu : on suit les photos

  if (!current) {
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

  const { model, color } = splitProductName(current.name);
  const copy = modelCopy(model);
  const gallery = galleryLayout(Math.min(windowWidth, MAX_CONTENT) - spacing.lg * 2, variants.length);
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
        <View style={[styles.gallery, { height: gallery.height }]}>
          {gallery.thumbWidth ? (
            <View style={[styles.thumbs, { width: gallery.thumbWidth }, gallery.fillColumn && { height: gallery.height, justifyContent: "space-between" }]}>
              {variants.map((variant) => (
                <PressableScale
                  key={variant.id}
                  onPress={() => selectVariant(variant.id)}
                  style={[styles.thumb, variant.id === current.id && styles.thumbActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir ${variant.name}`}
                  accessibilityState={{ selected: variant.id === current.id }}
                >
                  <ProductImage path={variant.imageUrl} name={variant.name} style={[styles.thumbImage, { width: gallery.thumbImageWidth }]} />
                </PressableScale>
              ))}
            </View>
          ) : null}
          <View style={[styles.stage, { width: gallery.mainWidth, height: gallery.height }]}>
            <ProductImage path={current.imageUrl} name={current.name} style={[styles.mainImage, { width: gallery.mainWidth, height: gallery.height }]} />
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.xl, maxWidth: MAX_CONTENT, width: "100%", alignSelf: "center" },
  gallery: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  thumbs: { gap: spacing.sm },
  thumb: { borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: 2 },
  thumbActive: { borderColor: colors.accent },
  thumbImage: { borderRadius: radius.sm },
  stage: { borderRadius: radius.xl, overflow: "hidden", backgroundColor: photoBackdrop },
  mainImage: { borderRadius: 0 },
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
