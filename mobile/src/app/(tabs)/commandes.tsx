import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { formatCdf, formatDateTime, orderReference, splitProductName } from "@/lib/format";
import { queryKeys, useMyOrders } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { StatusBadge } from "@/ui/Badges";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { PressableScale } from "@/ui/PressableScale";
import { ProductImage } from "@/ui/ProductImage";
import { Screen } from "@/ui/Screen";
import { EmptyState, LoadingState, Skeleton } from "@/ui/States";

/** Les commandes passées depuis ce téléphone. Le statut est TOUJOURS celui du serveur. */
export default function OrdersScreen() {
  const { history, orders } = useMyOrders();
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const entries = history.data ?? [];

  const refresh = async () => {
    setRefreshing(true);
    await client.invalidateQueries({ queryKey: queryKeys.myOrders });
    await Promise.all(entries.map((entry) => client.invalidateQueries({ queryKey: queryKeys.order(entry.id) })));
    setRefreshing(false);
  };

  return (
    <Screen>
      <Header />
      {history.isPending ? (
        <LoadingState message="Chargement de vos commandes…" />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} colors={[colors.accent]} />}
          ListHeaderComponent={
            <View style={styles.header}>
              <AppText variant="h1">Mes commandes</AppText>
              <AppText variant="body">Commandes passées depuis ce téléphone. Tirez vers le bas pour actualiser leur statut.</AppText>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="bag-handle-outline"
              title="Aucune commande"
              message="Vos commandes apparaîtront ici, avec leur statut en temps réel."
              action={<Button title="Découvrir la collection" iconRight="arrow-forward" onPress={() => router.navigate("/")} />}
            />
          }
          renderItem={({ item, index }) => {
            const query = orders[index];
            const order = query?.data;
            return (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * motion.stagger).duration(motion.base)}>
                <PressableScale
                  onPress={() => router.push({ pathname: "/orders/[id]", params: { id: item.id } })}
                  style={styles.card}
                  accessibilityRole="button"
                  accessibilityLabel={`Commande ${orderReference(item.id)}`}
                >
                  {order ? (
                    <ProductImage path={order.product.imageUrl} name={order.product.name} style={styles.thumb} />
                  ) : (
                    <Skeleton style={styles.thumb} />
                  )}
                  <View style={styles.body}>
                    <View style={styles.topLine}>
                      <AppText variant="bodyStrong">{orderReference(item.id)}</AppText>
                      {order ? <StatusBadge status={order.status} /> : null}
                    </View>
                    {order ? (
                      <>
                        <AppText variant="small" numberOfLines={1}>
                          {splitProductName(order.product.name).model} · {splitProductName(order.product.name).color} · Qté {order.quantity}
                        </AppText>
                        <View style={styles.bottomLine}>
                          <AppText variant="price">{formatCdf(order.totalCdf)}</AppText>
                          <AppText variant="caption">{formatDateTime(order.createdAt)}</AppText>
                        </View>
                      </>
                    ) : query?.isError ? (
                      <AppText variant="small" color={colors.warning}>
                        Statut indisponible pour le moment
                      </AppText>
                    ) : (
                      <Skeleton style={{ height: 14, width: "70%" }} />
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </PressableScale>
              </Animated.View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1, maxWidth: 640, width: "100%", alignSelf: "center" },
  header: { gap: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: { width: 64, height: 80, borderRadius: radius.sm },
  body: { flex: 1, gap: 4 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
  bottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" },
});
