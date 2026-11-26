import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "@/api/client";
import type { Product } from "@/api/types";
import { AppText } from "@/components/AppText";
import { ProductCard } from "@/components/ProductCard";
import { ErrorState, LoadingState } from "@/components/States";
import { normalize } from "@/lib/format";
import { productStore } from "@/lib/productStore";
import { colors, fonts, radius, spacing } from "@/theme";

const PADDING = spacing.lg;
const GAP = spacing.md;

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; products: Product[] };

/** Écran 1 — La liste des produits, chargée depuis l'API. */
export default function ProductListScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const { width } = useWindowDimensions();

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setState({ status: "loading" });
    else setRefreshing(true);
    try {
      const products = await api.listProducts();
      productStore.setAll(products);
      setState({ status: "ready", products });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Erreur inattendue.";
      setState({ status: "error", message });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Recherche par nom (bonus) : insensible aux accents et aux majuscules.
  const visible = useMemo(() => {
    if (state.status !== "ready") return [];
    const query = normalize(search);
    return query ? state.products.filter((product) => normalize(product.name).includes(query)) : state.products;
  }, [state, search]);

  const columns = width >= 720 ? 3 : 2;
  const cardWidth = (Math.min(width, 1100) - PADDING * 2 - GAP * (columns - 1)) / columns;

  const header = (
    <View style={styles.header}>
      <Image source={require("../../assets/logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="ZIKO SHOP" />
      <AppText variant="title" style={styles.tagline}>
        Trois pulls. Zéro compromis.
      </AppText>
      <AppText variant="caption" style={styles.subtitle}>
        Livraison à Kinshasa · Paiement Mobile Money
      </AppText>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un pull, une couleur…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Rechercher un produit par nom"
          maxFontSizeMultiplier={1.35}
        />
        {search ? (
          <Ionicons name="close-circle" size={18} color={colors.textMuted} onPress={() => setSearch("")} accessibilityLabel="Effacer la recherche" />
        ) : null}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {state.status === "loading" ? (
        <>
          {header}
          <LoadingState
            message="Chargement de la collection…"
            slowMessage="Le serveur se réveille (hébergement gratuit). Cela peut prendre jusqu'à une minute la première fois."
          />
        </>
      ) : state.status === "error" ? (
        <>
          {header}
          <ErrorState title="Impossible de charger la boutique" message={state.message} onRetry={() => void load()} />
        </>
      ) : (
        <FlatList
          key={columns}
          data={visible}
          numColumns={columns}
          keyExtractor={(product) => product.id}
          ListHeaderComponent={header}
          contentContainerStyle={styles.list}
          columnWrapperStyle={{ gap: GAP }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xl }} />}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} tintColor={colors.text} />}
          ListEmptyComponent={
            <AppText variant="caption" style={styles.empty}>
              {search ? `Aucun produit ne correspond à « ${search} ».` : "Aucun produit pour le moment."}
            </AppText>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              width={cardWidth}
              onPress={() => router.push({ pathname: "/product/[id]", params: { id: item.id } })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: PADDING, paddingTop: spacing.lg, paddingBottom: spacing.xl, alignItems: "center", alignSelf: "stretch" },
  logo: { width: 120, height: 68 },
  tagline: { marginTop: spacing.lg, textAlign: "center" },
  subtitle: { marginTop: spacing.xs, textAlign: "center" },
  search: {
    marginTop: spacing.xl,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, paddingVertical: 10 },
  list: { paddingHorizontal: PADDING, paddingBottom: spacing.xxl, maxWidth: 1100, width: "100%", alignSelf: "center" },
  empty: { textAlign: "center", marginTop: spacing.xl },
});
