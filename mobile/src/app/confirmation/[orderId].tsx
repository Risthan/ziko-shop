import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect } from "react";
import { BackHandler, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { formatCdf, formatDateTime, orderReference } from "@/lib/format";
import { useOrder } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Button } from "@/ui/Button";
import { Card, Divider, InfoRow } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { OrderLines } from "@/ui/OrderSummary";
import { Screen } from "@/ui/Screen";
import { LoadingState } from "@/ui/States";
import { SuccessMark } from "@/ui/SuccessMark";

const goHome = () => router.dismissTo("/");

/**
 * Écran 06 — Confirmation. Ne s'affiche QUE si le serveur confirme que la
 * commande est payée ; sinon on renvoie vers le paiement.
 */
export default function ConfirmationScreen() {
  const { orderId, deja, autre } = useLocalSearchParams<{ orderId: string; deja?: string; autre?: string }>();
  const order = useOrder(orderId);

  // Bouton retour Android : on revient au catalogue, pas au paiement.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    if (order.data && order.data.status !== "payee") {
      router.replace({ pathname: "/payment/[orderId]", params: { orderId } });
    }
  }, [order.data, orderId]);

  if (!order.data || order.data.status !== "payee") {
    return (
      <Screen>
        <Header />
        <LoadingState message="Vérification du paiement…" />
      </Screen>
    );
  }

  const current = order.data;
  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <SuccessMark />
          <Animated.View entering={FadeInDown.delay(250).duration(motion.slow)} style={styles.heroText}>
            <AppText variant="display" center>
              Commande{" "}
              {/* Espace insécable : le « ! » ne part jamais seul à la ligne. */}
              <AppText variant="display" color={colors.accent}>
                {"confirmée !"}
              </AppText>
            </AppText>
            <AppText variant="body" center>
              Votre paiement a bien été enregistré par le serveur.
            </AppText>
          </Animated.View>
        </View>

        {deja === "1" ? (
          <Notice
            tone="success"
            title={autre === "1" ? "Commande déjà payée" : "Paiement déjà enregistré"}
            message={
              autre === "1"
                ? "Cette commande avait déjà été réglée. Aucun paiement supplémentaire n'a été effectué."
                : "Votre paiement avait déjà été enregistré. Votre commande est confirmée. Aucun paiement supplémentaire n'a été effectué."
            }
          />
        ) : null}

        <Animated.View entering={FadeInDown.delay(380).duration(motion.slow)}>
          <View style={styles.reference}>
            <Ionicons name="receipt-outline" size={18} color={colors.accent} />
            <AppText variant="small">N° de commande</AppText>
            <AppText variant="h3" color={colors.accent} selectable>
              {orderReference(current.id)}
            </AppText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(460).duration(motion.slow)}>
          <Card>
            <View style={styles.statusRow}>
              <View style={styles.statusIcon}>
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Paiement réussi</AppText>
                <AppText variant="caption">{current.paidAt ? formatDateTime(current.paidAt) : ""}</AppText>
              </View>
              <AppText variant="bodyStrong" color={colors.accent}>
                Payée
              </AppText>
            </View>
            <Divider />
            <OrderLines order={current} />
            <Divider />
            <InfoRow label="Total payé" value={formatCdf(current.totalCdf)} strong />
            {current.paymentId ? (
              <AppText variant="caption" selectable style={styles.paymentId}>
                Identifiant de paiement : {current.paymentId}
              </AppText>
            ) : null}
          </Card>
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Retour à la boutique" icon="home-outline" onPress={goHome} />
        <Button
          title="Voir ma commande"
          variant="secondary"
          iconRight="arrow-forward"
          onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: current.id } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", gap: spacing.xs },
  heroText: { gap: spacing.sm, marginTop: -spacing.md },
  reference: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexWrap: "wrap",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  paymentId: { marginTop: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm, maxWidth: 640, width: "100%", alignSelf: "center" },
});
