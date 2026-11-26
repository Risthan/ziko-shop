import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ApiError } from "@/api/client";
import type { Order } from "@/api/types";
import { formatCdf, orderReference } from "@/lib/format";
import { usePayment } from "@/lib/payment/usePayment";
import { useOrder } from "@/lib/queries";
import { colors, fonts, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Badge, StatusBadge } from "@/ui/Badges";
import { Button, type IconName } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { OrderSummary } from "@/ui/OrderSummary";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { EmptyState, LoadingState } from "@/ui/States";

/** Écrans 05 et 07 — Paiement, et interruption réseau pendant le paiement. */
export default function PaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const order = useOrder(orderId);
  const [simulateCut, setSimulateCut] = useState(false);

  const onPaid = useCallback(
    (_order: Order, info: { alreadyRecorded: boolean; paidElsewhere: boolean }) =>
      router.replace({
        pathname: "/confirmation/[orderId]",
        params: { orderId, deja: info.alreadyRecorded ? "1" : "0", autre: info.paidElsewhere ? "1" : "0" },
      }),
    [orderId],
  );
  const payment = usePayment(orderId, { onPaid });

  if (!order.data) {
    const notFound = order.error instanceof ApiError && order.error.code === "ORDER_NOT_FOUND";
    return (
      <Screen>
        <Header back />
        {order.isError ? (
          <EmptyState
            tone="danger"
            icon={notFound ? "help-circle-outline" : "cloud-offline-outline"}
            title={notFound ? "Commande introuvable" : "Serveur injoignable"}
            message={order.error instanceof ApiError ? order.error.message : undefined}
            action={
              notFound ? (
                <Button title="Retour à la boutique" onPress={() => router.dismissTo("/")} />
              ) : (
                <Button title="Réessayer" icon="refresh" onPress={() => void order.refetch()} />
              )
            }
          />
        ) : (
          <LoadingState message="Chargement de la commande…" />
        )}
      </Screen>
    );
  }

  const current = order.data;

  if (payment.phase === "uncertain" || payment.phase === "checking") {
    return <Interrupted order={current} paymentId={payment.record?.paymentId} checking={payment.phase === "checking"} onRetry={payment.retry} onCheck={payment.checkStatus} />;
  }

  const paying = payment.phase === "paying";
  const alreadyPaid = current.status === "payee";
  const previousAttempt = payment.record && payment.record.attempts > 0 && !payment.record.confirmedAt;

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Steps active={1} />
        <View style={styles.title}>
          <AppText variant="h1">Paiement</AppText>
          <AppText variant="body">Vérifiez le montant puis payez en un geste.</AppText>
        </View>

        <OrderSummary order={current} title="Commande" />

        {alreadyPaid ? (
          <Notice tone="success" title="Cette commande est déjà payée" message="Aucun nouveau paiement n'est nécessaire." />
        ) : (
          <>
            <Card tone="accent" style={styles.method}>
              <View style={styles.methodIcon}>
                <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Mobile Money</AppText>
                <AppText variant="small">Paiement simulé pour la démonstration : aucun débit réel n'est effectué.</AppText>
              </View>
              <Badge label="Démo" tone="accent" size="sm" />
            </Card>

            {previousAttempt ? (
              <Notice
                tone="info"
                icon="refresh-circle-outline"
                title="Tentative précédente non confirmée"
                message={`Le même identifiant de paiement (${payment.record?.paymentId}) sera réutilisé : aucun risque de double débit.`}
              />
            ) : null}
            {payment.message && payment.phase === "idle" ? <Notice tone="info" title="Statut vérifié auprès du serveur" message={payment.message} /> : null}

            <Card style={styles.demo}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Mode démo : couper le réseau</AppText>
                <AppText variant="small">Le paiement arrive au serveur, mais la réponse se perd (premier essai uniquement).</AppText>
              </View>
              <Switch
                value={simulateCut}
                onValueChange={setSimulateCut}
                disabled={paying}
                trackColor={{ true: colors.accent, false: colors.borderStrong }}
                thumbColor={simulateCut ? colors.onAccent : colors.textSecondary}
                ios_backgroundColor={colors.borderStrong}
                accessibilityLabel="Simuler une coupure réseau pendant le paiement"
              />
            </Card>

            <Notice
              tone="success"
              title="Paiement protégé"
              message="En cas de coupure réseau, votre paiement reste sécurisé : il ne sera jamais débité deux fois."
            />
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {alreadyPaid ? (
          <Button title="Voir la confirmation" iconRight="arrow-forward" onPress={() => onPaid(current, { alreadyRecorded: true, paidElsewhere: false })} />
        ) : (
          <Button
            title={`Payer ${formatCdf(current.totalCdf)}`}
            icon="lock-closed"
            loading={paying}
            loadingLabel="Paiement en cours…"
            onPress={() => void payment.pay(simulateCut)}
          />
        )}
      </View>

      <Sheet
        visible={payment.phase === "refused"}
        onClose={payment.dismissRefusal}
        icon="close-circle-outline"
        tone="danger"
        title="Paiement refusé"
        message={`${payment.message ?? ""} Aucun débit n'a été effectué.`}
      >
        <Button title="Retour à la boutique" onPress={() => router.dismissTo("/")} />
        <Button title="Fermer" variant="secondary" onPress={payment.dismissRefusal} />
      </Sheet>
    </Screen>
  );
}

/**
 * Écran 07 — La réponse du serveur n'est pas arrivée. On ne conclut PAS à un
 * échec : le serveur a peut-être enregistré le paiement avant la coupure.
 */
function Interrupted({ order, paymentId, checking, onRetry, onCheck }: { order: Order; paymentId?: string; checking: boolean; onRetry: () => void; onCheck: () => void }) {
  return (
    <Screen glow="danger" edges={["top", "left", "right", "bottom"]}>
      <Header back />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(motion.slow)} style={styles.alertIcon}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.danger} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(80).duration(motion.base)} style={styles.alertText}>
          <AppText variant="display" center>
            Connexion interrompue
          </AppText>
          <AppText variant="body" center>
            Nous n'avons pas encore pu confirmer le statut de votre paiement.
          </AppText>
        </Animated.View>

        <Card tone="accent" style={styles.reassure}>
          <Ionicons name="shield-checkmark-outline" size={28} color={colors.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText style={styles.reassureTitle}>Aucun double paiement</AppText>
            <AppText variant="small">
              Si le paiement a été enregistré, votre commande sera confirmée. Sinon, réessayez : le même identifiant de paiement sera renvoyé.
            </AppText>
          </View>
        </Card>

        <Card style={styles.recap}>
          <View style={styles.recapRow}>
            <View style={{ gap: 2 }}>
              <AppText variant="caption">Commande</AppText>
              <AppText variant="h3" selectable>
                {orderReference(order.id)}
              </AppText>
            </View>
            <StatusBadge status="unknown" />
          </View>
          <View style={styles.recapRow}>
            <AppText variant="body">Montant</AppText>
            <AppText variant="priceLarge" color={colors.accent}>
              {formatCdf(order.totalCdf)}
            </AppText>
          </View>
          {paymentId ? (
            <AppText variant="caption" selectable>
              Identifiant de paiement : {paymentId}
            </AppText>
          ) : null}
        </Card>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Réessayer le paiement" icon="refresh" onPress={onRetry} disabled={checking} />
        <Button title="Vérifier le statut de ma commande" variant="secondary" icon="search-outline" loading={checking} loadingLabel="Vérification…" onPress={onCheck} />
      </View>
    </Screen>
  );
}

const STEPS: { label: string; icon: IconName }[] = [
  { label: "Commande", icon: "bag-handle-outline" },
  { label: "Paiement", icon: "card-outline" },
  { label: "Confirmation", icon: "checkmark" },
];

/** Étapes du parcours (indicatif, non cliquable). */
function Steps({ active }: { active: number }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Étape ${active + 1} sur 3 : ${STEPS[active]?.label}`}>
      {STEPS.map((step, index) => {
        const done = index < active;
        const current = index === active;
        return (
          <View key={step.label} style={styles.step}>
            {index > 0 ? <View style={[styles.stepLine, (done || current) && styles.stepLineActive]} /> : null}
            <View style={[styles.stepDot, (done || current) && styles.stepDotActive, current && styles.stepDotCurrent]}>
              <Ionicons name={done ? "checkmark" : step.icon} size={15} color={current ? colors.onAccent : done ? colors.accent : colors.textTertiary} />
            </View>
            <AppText variant="caption" color={current ? colors.accent : done ? colors.text : colors.textTertiary} style={styles.stepLabel}>
              {step.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs },
  method: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  methodIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" },
  demo: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm, gap: spacing.sm, maxWidth: 640, width: "100%", alignSelf: "center", backgroundColor: colors.background },
  alertIcon: {
    alignSelf: "center",
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  alertText: { gap: spacing.sm },
  reassure: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  reassureTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
  recap: { gap: spacing.md },
  recapRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, flexWrap: "wrap" },
  steps: { flexDirection: "row", alignItems: "flex-start" },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepLine: { position: "absolute", top: 15, right: "50%", width: "100%", height: 2, backgroundColor: colors.border },
  stepLineActive: { backgroundColor: colors.accent },
  stepDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  stepDotActive: { borderColor: colors.accent },
  stepDotCurrent: { backgroundColor: colors.accent },
  stepLabel: { fontFamily: fonts.semibold },
});
