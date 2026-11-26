import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import { formatCdf, formatDateTime, orderReference } from "@/lib/format";
import { useOrder } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { StatusBadge } from "@/ui/Badges";
import { Button } from "@/ui/Button";
import { Card, Divider, InfoRow } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { IconButton } from "@/ui/IconButton";
import { OrderLines, orderCountLabel } from "@/ui/OrderSummary";
import { Screen } from "@/ui/Screen";
import { EmptyState, LoadingState } from "@/ui/States";

/**
 * Écran 08 — Suivi de commande. Seuls les statuts réellement gérés par le
 * serveur sont affichés : « En attente » et « Payée » (pas de faux suivi de livraison).
 */
export default function OrderStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  const refresh = <IconButton icon="refresh" label="Actualiser le statut" onPress={() => void order.refetch()} disabled={order.isFetching} />;

  if (!order.data) {
    const notFound = order.error instanceof ApiError && order.error.code === "ORDER_NOT_FOUND";
    return (
      <Screen>
        <Header back right={refresh} />
        {order.isError ? (
          <EmptyState
            tone="danger"
            icon={notFound ? "help-circle-outline" : "cloud-offline-outline"}
            title={notFound ? "Commande introuvable" : "Serveur injoignable"}
            message={order.error instanceof ApiError ? order.error.message : undefined}
            action={<Button title="Réessayer" icon="refresh" onPress={() => void order.refetch()} />}
          />
        ) : (
          <LoadingState message="Chargement de la commande…" />
        )}
      </Screen>
    );
  }

  const current = order.data;
  const paid = current.status === "payee";

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header back right={refresh} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <AppText variant="h1">Suivi de commande</AppText>
          <AppText variant="body">Statut réel, fourni par le serveur.</AppText>
        </View>

        <Card style={styles.head}>
          <View style={{ gap: 2, flex: 1 }}>
            <AppText variant="caption">N° de commande</AppText>
            <AppText variant="h2" selectable>
              {orderReference(current.id)}
            </AppText>
          </View>
          <Animated.View key={current.status} entering={FadeIn.duration(motion.base)}>
            <StatusBadge status={current.status} />
          </Animated.View>
        </Card>

        <Card>
          <TimelineStep done title="Commande créée" detail={formatDateTime(current.createdAt)} />
          <View style={[styles.connector, paid && styles.connectorDone]} />
          <TimelineStep
            done={paid}
            title={paid ? "Paiement validé" : "En attente de paiement"}
            detail={paid && current.paidAt ? formatDateTime(current.paidAt) : "La commande sera confirmée dès le paiement."}
          />
        </Card>

        <Card>
          <OrderLines order={current} />
          <Divider />
          <InfoRow label="Articles" value={orderCountLabel(current)} />
          <Divider />
          <InfoRow label={paid ? "Total payé" : "Total à payer"} value={formatCdf(current.totalCdf)} strong />
          {current.paymentId ? (
            <AppText variant="caption" selectable style={styles.paymentId}>
              Identifiant de paiement : {current.paymentId}
            </AppText>
          ) : null}
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        {!paid ? (
          <Button
            title={`Payer ${formatCdf(current.totalCdf)}`}
            icon="lock-closed"
            onPress={() => router.push({ pathname: "/payment/[orderId]", params: { orderId: current.id } })}
          />
        ) : null}
        <Button title="Actualiser le statut" variant="secondary" icon="refresh" loading={order.isFetching} loadingLabel="Actualisation…" onPress={() => void order.refetch()} />
      </View>
    </Screen>
  );
}

function TimelineStep({ done, title, detail }: { done: boolean; title: string; detail: string }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, done && styles.stepDotDone]}>
        {done ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : <Ionicons name="time-outline" size={14} color={colors.warning} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" color={done ? colors.text : colors.warning}>
          {title}
        </AppText>
        <AppText variant="small">{detail}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  step: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  stepDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.warning, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  stepDotDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  connector: { width: 2, height: 22, marginLeft: 12, marginVertical: 4, backgroundColor: colors.border, borderRadius: radius.pill },
  connectorDone: { backgroundColor: colors.accent },
  paymentId: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm, maxWidth: 640, width: "100%", alignSelf: "center" },
});
