import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import type { Product } from "@/api/types";
import { groupByModel, type ModelGroup } from "@/lib/catalog";
import { formatCdf, normalize, orderReference, splitProductName } from "@/lib/format";
import { orderHistory } from "@/lib/orderHistory";
import { prefetchProductImages } from "@/lib/prefetch";
import { paymentController } from "@/lib/payment/usePayment";
import { useOrder, useProducts } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Button } from "@/ui/Button";
import { SectionTitle } from "@/ui/Card";
import { CartButton } from "@/ui/CartButton";
import { ColorDots } from "@/ui/ColorSwatches";
import { Logo } from "@/ui/Logo";
import { ProductCard, ProductCardSkeleton } from "@/ui/ProductCard";
import { ProductImage } from "@/ui/ProductImage";
import { PressableScale } from "@/ui/PressableScale";
import { Screen } from "@/ui/Screen";
import { SearchField } from "@/ui/SearchField";
import { EmptyState } from "@/ui/States";

const PADDING = spacing.lg;
const GAP = spacing.md;

const openProduct = (id: string) => router.push({ pathname: "/product/[id]", params: { id } });

/** Une ligne de la grille : l'en-tête d'un modèle, ou une rangée de cartes. */
type Row =
  | { kind: "skeleton"; key: string }
  | { kind: "section"; key: string; group: ModelGroup; first: boolean }
  | { kind: "cards"; key: string; products: Product[]; startIndex: number };

const SKELETON_ROWS: Row[] = [
  { kind: "skeleton", key: "s1" },
  { kind: "skeleton", key: "s2" },
];

/** Chaque modèle forme une catégorie : son en-tête, puis ses couleurs, rangée par rangée. */
function buildRows(groups: ModelGroup[], columns: number, withHeaders: boolean): Row[] {
  const rows: Row[] = [];
  let index = 0;
  groups.forEach((group, groupIndex) => {
    if (withHeaders) rows.push({ kind: "section", key: `section-${group.model}`, group, first: groupIndex === 0 });
    for (let start = 0; start < group.variants.length; start += columns) {
      const products = group.variants.slice(start, start + columns);
      rows.push({ kind: "cards", key: products.map((product) => product.id).join("|"), products, startIndex: index });
      index += products.length;
    }
  });
  return rows;
}

/** Écran 01 — Accueil et catalogue, chargé depuis l'API et rangé par modèle. */
export default function HomeScreen() {
  const products = useProducts();
  const client = useQueryClient();
  const listRef = useRef<FlatList<Row>>(null);
  const [search, setSearch] = useState("");
  const [collection, setCollection] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();

  const all = products.data ?? [];
  const groups = useMemo(() => groupByModel(all), [all]);

  // Toutes les photos sont chargées d'avance : la grille et les fiches s'affichent sans attente.
  useEffect(() => {
    prefetchProductImages(all);
  }, [all]);

  const visibleGroups = useMemo(() => {
    const query = normalize(search);
    return groups
      .filter((group) => !collection || group.model === collection)
      .map((group) => ({ ...group, variants: group.variants.filter((product) => !query || normalize(product.name).includes(query)) }))
      .filter((group) => group.variants.length > 0);
  }, [groups, collection, search]);
  const visibleCount = visibleGroups.reduce((total, group) => total + group.variants.length, 0);

  const columns = width >= 700 ? 3 : 2;
  const contentWidth = Math.min(width, 1000);
  const cardWidth = (contentWidth - PADDING * 2 - GAP * (columns - 1)) / columns;

  const refresh = async () => {
    setRefreshing(true);
    await client.invalidateQueries();
    setRefreshing(false);
  };

  const loading = products.isPending;
  const failed = products.isError && all.length === 0;
  // Une seule collection choisie : son nom est déjà le titre, pas besoin d'en-tête en plus.
  const rows = loading ? SKELETON_ROWS : failed ? [] : buildRows(visibleGroups, columns, !collection);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Logo width={128} />
        <CartButton />
      </View>
      <SearchField value={search} onChange={setSearch} placeholder="Rechercher un pull…" />
      <PendingPaymentBanner />
      {!search ? <Hero onDiscover={() => listRef.current?.scrollToOffset({ offset: 520, animated: true })} /> : null}
      {groups.length > 0 && !search ? (
        <View style={styles.block}>
          <SectionTitle
            title="Nos collections"
            right={collection ? <Button title="Voir tout" variant="ghost" size="sm" onPress={() => setCollection(null)} /> : undefined}
          />
          <View style={styles.collections}>
            {groups.map((group, index) => (
              <CollectionCard
                key={group.model}
                group={group}
                index={index}
                selected={collection === group.model}
                onPress={() => setCollection((current) => (current === group.model ? null : group.model))}
              />
            ))}
          </View>
        </View>
      ) : null}
      {!failed ? (
        <SectionTitle
          title={search ? "Résultats" : collection ?? "Toute la collection"}
          right={!loading ? <AppText variant="small">{visibleCount} pull{visibleCount > 1 ? "s" : ""}</AppText> : undefined}
        />
      ) : null}
      {loading ? <SlowServerHint /> : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(row) => row.key}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={9}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} colors={[colors.accent]} />}
        renderItem={({ item: row }) =>
          row.kind === "section" ? (
            <ModelHeader group={row.group} first={row.first} />
          ) : (
            <View style={styles.cardsRow}>
              {row.kind === "skeleton"
                ? Array.from({ length: columns }, (_, index) => <ProductCardSkeleton key={index} width={cardWidth} />)
                : row.products.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      width={cardWidth}
                      index={row.startIndex + index}
                      onPress={() => openProduct(product.id)}
                    />
                  ))}
            </View>
          )
        }
        ListEmptyComponent={
          failed ? (
            <EmptyState
              tone="danger"
              icon="cloud-offline-outline"
              title="Serveur injoignable"
              message={products.error instanceof ApiError ? products.error.message : "Vérifiez votre connexion internet puis réessayez."}
              action={<Button title="Réessayer" icon="refresh" onPress={() => void products.refetch()} loading={products.isFetching} />}
            />
          ) : search ? (
            <EmptyState
              icon="search-outline"
              title="Aucun résultat"
              message={`Aucun pull ne correspond à « ${search} ».`}
              action={<Button title="Effacer la recherche" variant="secondary" onPress={() => setSearch("")} />}
            />
          ) : (
            <EmptyState icon="shirt-outline" title="Aucun produit pour le moment" message="La collection arrive bientôt." />
          )
        }
      />
    </Screen>
  );
}

/** En-tête d'une catégorie : le modèle, son type de pull, son prix et ses couleurs. */
function ModelHeader({ group, first }: { group: ModelGroup; first: boolean }) {
  const prices = group.variants.map((variant) => variant.priceCdf);
  const lowest = Math.min(...prices);
  const samePrice = prices.every((price) => price === lowest);
  const count = group.variants.length;
  return (
    <View style={[styles.modelHeader, !first && styles.modelHeaderSpaced]} accessibilityRole="header">
      <View style={styles.modelText}>
        <AppText variant="h2" numberOfLines={1}>
          {group.model}
        </AppText>
        <AppText variant="small" numberOfLines={1}>
          {group.tagline} · {samePrice ? "" : "dès "}
          {formatCdf(lowest)}
        </AppText>
      </View>
      <View style={styles.modelColors}>
        <ColorDots colorsList={group.variants.map((variant) => splitProductName(variant.name).color ?? "")} />
        <AppText variant="caption">
          {count} couleur{count > 1 ? "s" : ""}
        </AppText>
      </View>
    </View>
  );
}

/** Bannière immersive de la collection. */
function Hero({ onDiscover }: { onDiscover: () => void }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.hero}>
      <Image source={require("../../../assets/hero.jpg")} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right center" />
      <LinearGradient
        colors={["rgba(9,13,16,0.96)", "rgba(9,13,16,0.75)", "rgba(9,13,16,0)"]}
        locations={[0, 0.42, 0.8]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroText}>
        <AppText variant="overline">Collection 01</AppText>
        <AppText variant="h1" style={styles.heroTitle}>
          Votre style.{"\n"}
          <AppText variant="h1" color={colors.accent}>
            Vos règles.
          </AppText>
        </AppText>
        <AppText variant="small" style={styles.heroSubtitle}>
          Des pulls premium pensés pour le confort et le style.
        </AppText>
        <Button title="Découvrir" size="sm" iconRight="arrow-forward" onPress={onDiscover} style={styles.heroButton} />
      </View>
    </Animated.View>
  );
}

function CollectionCard({ group, selected, index, onPress }: { group: ModelGroup; selected: boolean; index: number; onPress: () => void }) {
  const cover = group.variants[0];
  return (
    <Animated.View entering={FadeInDown.delay(index * motion.stagger).duration(motion.base)} style={styles.collectionWrap}>
      <PressableScale
        onPress={onPress}
        style={[styles.collection, selected && styles.collectionSelected]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`Collection ${group.model}`}
      >
        {cover ? <ProductImage path={cover.imageUrl} name={group.model} style={styles.collectionImage} /> : null}
        <AppText variant="h3" numberOfLines={1} color={selected ? colors.onAccent : colors.text} style={styles.collectionName}>
          {group.model.replace(/^(Le |L')/, "")}
        </AppText>
        <AppText variant="caption" numberOfLines={1} color={selected ? colors.onAccent : colors.textSecondary}>
          {group.tagline}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

/** Rappel si un paiement n'a pas été confirmé (app fermée en plein paiement, réseau coupé…). */
function PendingPaymentBanner() {
  const [orderId, setOrderId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      for (const entry of await orderHistory.list()) {
        const record = await paymentController.getRecord(entry.id);
        if (record && !record.confirmedAt) return setOrderId(entry.id);
      }
    })();
  }, []);
  if (!orderId) return null;
  return <PendingBannerFor orderId={orderId} />;
}

function PendingBannerFor({ orderId }: { orderId: string }) {
  const order = useOrder(orderId);
  if (!order.data || order.data.status === "payee") return null;
  return (
    <Animated.View entering={FadeInDown}>
      <PressableScale
        onPress={() => router.push({ pathname: "/payment/[orderId]", params: { orderId } })}
        style={styles.pending}
        accessibilityRole="button"
        accessibilityLabel="Reprendre le paiement non confirmé"
      >
        <View style={styles.pendingDot} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Paiement à confirmer</AppText>
          <AppText variant="small">{orderReference(orderId)} · touchez pour vérifier, sans risque de double débit</AppText>
        </View>
        <AppText variant="h3" color={colors.warning}>
          ›
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

function SlowServerHint() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 6_000);
    return () => clearTimeout(timer);
  }, []);
  if (!slow) return null;
  return (
    <Animated.View entering={FadeIn}>
      <AppText variant="small">Le serveur se réveille (hébergement gratuit) : cela peut prendre jusqu'à une minute la première fois.</AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: PADDING, paddingBottom: spacing.xxl, maxWidth: 1000, width: "100%", alignSelf: "center" },
  cardsRow: { flexDirection: "row", gap: GAP },
  modelHeader: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  modelHeaderSpaced: { marginTop: spacing.md, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  modelText: { flex: 1, gap: 2 },
  modelColors: { alignItems: "flex-end", gap: 4 },
  header: { gap: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  block: { gap: spacing.md },
  hero: {
    height: 212,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    justifyContent: "center",
  },
  heroText: { paddingHorizontal: spacing.xl, gap: spacing.sm, maxWidth: "68%" },
  heroTitle: { marginTop: 2 },
  heroSubtitle: { color: colors.textSecondary },
  heroButton: { alignSelf: "flex-start", marginTop: spacing.xs },
  collections: { flexDirection: "row", gap: spacing.sm },
  collectionWrap: { flex: 1 },
  collection: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.sm,
    paddingBottom: spacing.md,
    gap: 2,
  },
  collectionSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  collectionImage: { width: "100%", aspectRatio: 4 / 5, borderRadius: radius.md, marginBottom: spacing.sm },
  collectionName: { paddingHorizontal: 2 },
  pending: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  pendingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.warning },
});
