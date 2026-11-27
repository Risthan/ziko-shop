import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { api } from "@/api/client";
import type { Order, User } from "@/api/types";
import { formErrorsFrom } from "@/lib/auth/formErrors";
import { useSession } from "@/lib/auth/session";
import { formatCdf } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { forgetPrivateData, signOut, useMe, useMyOrders } from "@/lib/queries";
import { colors, fonts, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Button, type IconName } from "@/ui/Button";
import { CartButton } from "@/ui/CartButton";
import { Card } from "@/ui/Card";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { OrderCard } from "@/ui/OrderCard";
import { PressableScale } from "@/ui/PressableScale";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { EmptyState, LoadingState, Skeleton } from "@/ui/States";
import { TextField } from "@/ui/TextField";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const memberSince = (iso: string) => {
  const date = new Date(iso);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");

/** Profil : connexion, ou identité + historique d'achats + réglages du compte. */
export default function ProfileScreen() {
  const { status, user } = useSession();
  return (
    <Screen>
      <Header right={<CartButton />} />
      {status === "loading" ? <LoadingState message="Chargement de votre compte…" /> : user ? <SignedIn user={user} /> : <SignedOut />}
    </Screen>
  );
}

function SignedOut() {
  return (
    <Animated.ScrollView entering={FadeIn.duration(motion.base)} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="person-outline" size={34} color={colors.accent} />
        </View>
        <AppText variant="h1" center>
          Votre compte Ziko
        </AppText>
        <AppText variant="body" center>
          Connectez-vous pour commander, suivre vos achats et retrouver tout votre historique.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button title="Se connecter" icon="log-in-outline" onPress={() => router.push("/auth/login")} />
        <Button title="Créer un compte" variant="secondary" icon="person-add-outline" onPress={() => router.push("/auth/register")} />
      </View>
      <Card style={styles.benefits}>
        <Benefit icon="receipt-outline" title="Historique d'achats" text="Toutes vos commandes et leur statut réel." />
        <Benefit icon="shield-checkmark-outline" title="Paiement protégé" text="Jamais débité deux fois, même si le réseau coupe." />
        <Benefit icon="cart-outline" title="Panier conservé" text="Ajoutez, essayez, commandez quand vous voulez." />
      </Card>
    </Animated.ScrollView>
  );
}

function Benefit({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Ionicons name={icon} size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small">{text}</AppText>
      </View>
    </View>
  );
}

function SignedIn({ user }: { user: User }) {
  const client = useQueryClient();
  useMe(); // rafraîchit le profil auprès du serveur
  const orders = useMyOrders();
  const [refreshing, setRefreshing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const list = orders.data ?? [];
  const paid = list.filter((order) => order.status === "payee");
  const spent = paid.reduce((sum, order) => sum + order.totalCdf, 0);

  const refresh = async () => {
    setRefreshing(true);
    await orders.refetch();
    setRefreshing(false);
  };

  const logout = async () => {
    haptics.tap();
    await signOut(client);
  };

  return (
    <>
      <FlatList
        data={list}
        keyExtractor={(order: Order) => order.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.accent} colors={[colors.accent]} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Card style={styles.identity}>
              <View style={styles.avatar}>
                <AppText style={styles.avatarText}>{initials(user.fullName) || "Z"}</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="h2" numberOfLines={1}>
                  {user.fullName}
                </AppText>
                <AppText variant="small" numberOfLines={1}>
                  {user.email}
                </AppText>
                {user.phone ? <AppText variant="small">{user.phone}</AppText> : null}
                <AppText variant="caption">Client depuis {memberSince(user.createdAt)}</AppText>
              </View>
            </Card>

            <View style={styles.stats}>
              <Stat label="Commandes" value={String(list.length)} />
              <Stat label="Payées" value={String(paid.length)} />
              <Stat label="Total dépensé" value={formatCdf(spent)} wide />
            </View>

            <AppText variant="h2" style={styles.sectionTitle}>
              Mes achats
            </AppText>
          </View>
        }
        renderItem={({ item, index }) => <OrderCard order={item} index={index} />}
        ListEmptyComponent={
          orders.isPending ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton style={styles.skeleton} />
              <Skeleton style={styles.skeleton} />
            </View>
          ) : orders.isError ? (
            <Notice
              tone="warning"
              title="Historique indisponible"
              message="Impossible de charger vos commandes pour le moment. Tirez vers le bas pour réessayer."
            />
          ) : (
            <Card style={styles.empty}>
              <Ionicons name="bag-handle-outline" size={26} color={colors.textSecondary} />
              <AppText variant="bodyStrong" center>
                Aucun achat pour l'instant
              </AppText>
              <AppText variant="small" center>
                Vos commandes apparaîtront ici, avec leur statut en temps réel.
              </AppText>
              <Button title="Découvrir la collection" size="md" iconRight="arrow-forward" onPress={() => router.navigate("/")} />
            </Card>
          )
        }
        ListFooterComponent={
          <View style={styles.account}>
            <AppText variant="h2" style={styles.sectionTitle}>
              Mon compte
            </AppText>
            <Card style={styles.rows}>
              <Row icon="create-outline" label="Modifier mon profil" onPress={() => router.push("/profile/edit")} />
              <View style={styles.hairline} />
              <Row icon="log-out-outline" label="Se déconnecter" onPress={() => void logout()} />
              <View style={styles.hairline} />
              <Row icon="trash-outline" label="Supprimer mon compte" danger onPress={() => setDeleteOpen(true)} />
            </Card>
          </View>
        }
      />
      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={() => void forgetPrivateData(client)} />
    </>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.stat, wide && styles.statWide]}>
      <AppText variant="h3" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </AppText>
    </View>
  );
}

function Row({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const color = danger ? colors.danger : colors.text;
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={styles.row}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.textSecondary} />
      <AppText variant="bodyStrong" color={color} style={{ flex: 1 }}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </PressableScale>
  );
}

/** Suppression du compte : le mot de passe est redemandé, l'action est définitive. */
function DeleteAccountSheet({ visible, onClose, onDeleted }: { visible: boolean; onClose: () => void; onDeleted: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    if (!password) return setError("Entrez votre mot de passe pour confirmer.");
    setBusy(true);
    setError(null);
    try {
      await api.deleteMe(password);
      haptics.success();
      close();
      onDeleted();
      router.navigate("/");
    } catch (failure) {
      haptics.error();
      const { general, fields } = formErrorsFrom(failure);
      setError(fields.password ?? general);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      icon="trash-outline"
      tone="danger"
      title="Supprimer mon compte ?"
      message="Votre profil et vos sessions seront effacés définitivement. Vos commandes restent enregistrées pour la comptabilité, sans lien avec vous. Cette action est irréversible."
    >
      <TextField label="Mot de passe" icon="lock-closed-outline" value={password} onChange={setPassword} error={error} secret autoComplete="current-password" />
      <Button title="Supprimer définitivement" variant="danger" icon="trash-outline" loading={busy} loadingLabel="Suppression…" onPress={() => void confirm()} />
      <Button title="Annuler" variant="secondary" onPress={close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", gap: spacing.md, paddingTop: spacing.xl },
  heroIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accentBorder,
  },
  actions: { gap: spacing.md },
  benefits: { gap: spacing.lg },
  benefit: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  benefitIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentSoft },
  headerBlock: { gap: spacing.lg, marginBottom: spacing.md },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  avatarText: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.onAccent },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  statWide: { flex: 1.6 },
  sectionTitle: { marginTop: spacing.xs },
  skeleton: { height: 104, borderRadius: radius.lg },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  account: { gap: spacing.md, marginTop: spacing.xl },
  rows: { paddingVertical: spacing.xs, paddingHorizontal: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 56 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg + 20 + spacing.md },
});
