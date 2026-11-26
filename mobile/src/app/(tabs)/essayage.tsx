import Ionicons from "@expo/vector-icons/Ionicons";
import { useCameraPermissions } from "expo-camera";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Linking, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { API_URL } from "@/config";
import { groupByModel, modelCopy } from "@/lib/catalog";
import { formatCdf, normalize, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useProducts, useTryOnConfig } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { StockBadge } from "@/ui/Badges";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ColorSwatches } from "@/ui/ColorSwatches";
import { Header } from "@/ui/Header";
import { IconButton } from "@/ui/IconButton";
import { PressableScale } from "@/ui/PressableScale";
import { ProductImage } from "@/ui/ProductImage";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { LoadingState } from "@/ui/States";
import { TryOnView, type TryOnStatus } from "@/ui/TryOnView";

/**
 * Écran 03 — Essayage virtuel en direct, DANS l'app.
 * La séance démarre toute seule dès que l'onglet est ouvert : la caméra
 * s'affiche dans le cadre ci-dessous, sans quitter l'app ni rien confirmer.
 * Changer de modèle ou de couleur relance l'essayage avec le nouveau pull.
 * L'achat reste toujours possible, même si le service d'essayage est indisponible.
 */
export default function TryOnScreen() {
  const { produit } = useLocalSearchParams<{ produit?: string }>();
  const products = useProducts();
  const config = useTryOnConfig();
  const [permission, requestPermission] = useCameraPermissions();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [active, setActive] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{ value: TryOnStatus; message?: string }>({ value: "loading" });

  // La caméra ne tourne que lorsque l'onglet est affiché et l'app au premier plan.
  useFocusEffect(
    useCallback(() => {
      setActive(true);
      return () => setActive(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => sub.remove();
  }, []);

  // Demande d'accès à la caméra dès l'arrivée sur l'onglet (fenêtre du système, une seule fois).
  const needsPermission = Platform.OS !== "web";
  useEffect(() => {
    if (needsPermission && permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [needsPermission, permission, requestPermission]);

  const onStatus = useCallback((value: TryOnStatus, message?: string) => {
    setStatus({ value, message });
    if (value === "live") haptics.success();
  }, []);

  const all = products.data ?? [];
  const groups = useMemo(() => groupByModel(all), [all]);
  const selected = all.find((p) => p.id === (pickedId ?? produit)) ?? all.find((p) => p.stock > 0) ?? all[0];

  // Nouveau pull ou nouvel essai : la séance repart de zéro.
  useEffect(() => setStatus({ value: "loading" }), [selected?.id, attempt]);

  if (!selected) {
    return (
      <Screen>
        <Header />
        <LoadingState message="Chargement de la collection…" />
      </Screen>
    );
  }

  const { model, color } = splitProductName(selected.name);
  const variants = groups.find((group) => group.model === model)?.variants ?? [selected];
  const mode = config.data?.mode;
  const available = mode === "decart" || mode === "anywear";
  const cameraAllowed = !needsPermission || permission?.granted === true;

  const pick = (id: string) => {
    haptics.select();
    setPickedId(id);
  };
  const pickModel = (target: string) => {
    const group = groups.find((g) => g.model === target);
    const sameColor = group?.variants.find((v) => normalize(splitProductName(v.name).color ?? "") === normalize(color ?? ""));
    const next = sameColor ?? group?.variants[0];
    if (next) pick(next.id);
  };
  const retry = () => {
    haptics.tap();
    setAttempt((n) => n + 1);
  };

  const renderStage = () => {
    if (config.isPending || !permission) return <LoadingState message="Préparation de l'essayage…" />;

    if (!available) {
      return (
        <StageMessage
          image={selected.imageUrl}
          name={selected.name}
          icon="pause-circle-outline"
          title="Essayage indisponible pour le moment"
          message={
            config.isError
              ? "Impossible de joindre le service d'essayage. Vous pouvez quand même commander ce pull."
              : "Le service d'essayage n'est pas activé. Vous pouvez quand même commander ce pull."
          }
        />
      );
    }

    if (!cameraAllowed) {
      return (
        <StageMessage
          image={selected.imageUrl}
          name={selected.name}
          icon="videocam-off-outline"
          title="Accès à la caméra nécessaire"
          message="Autorisez la caméra pour vous voir porter ce pull en direct."
          action={
            permission.canAskAgain ? (
              <Button title="Autoriser la caméra" icon="videocam-outline" size="md" onPress={() => void requestPermission()} />
            ) : (
              <Button title="Ouvrir les réglages" icon="settings-outline" size="md" variant="secondary" onPress={() => void Linking.openSettings()} />
            )
          }
        />
      );
    }

    if (!active) return <StageMessage image={selected.imageUrl} name={selected.name} icon="pause-outline" title="Essayage en pause" message="Il reprend dès que vous revenez." />;

    return (
      <>
        <TryOnView key={`${selected.id}-${attempt}`} url={`${API_URL}/essayage?produit=${selected.id}&embed=1`} onStatus={onStatus} />
        <StatusChip status={status.value} />
        {status.value === "ended" || status.value === "error" ? (
          <Animated.View entering={FadeIn.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={styles.endCard}>
            <AppText variant="bodyStrong" center>
              {status.value === "ended" ? "Séance terminée" : "L'essayage s'est interrompu"}
            </AppText>
            <AppText variant="small" center>
              {status.value === "ended" ? "Ce pull vous plaît ? Commandez-le ci-dessous." : (status.message ?? "Le service d'essayage ne répond pas pour le moment.")}
            </AppText>
            <Button title="Relancer l'essayage" icon="refresh" size="md" variant="secondary" onPress={retry} />
          </Animated.View>
        ) : null}
      </>
    );
  };

  return (
    <Screen>
      <Header right={<IconButton icon="help-circle-outline" label="Comment ça marche ?" onPress={() => setHelpOpen(true)} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.title}>
          <AppText variant="h1">Essayage en direct</AppText>
          <AppText variant="body">Placez-vous face à la caméra : vous portez le pull en temps réel.</AppText>
        </View>

        <View style={styles.stage}>{renderStage()}</View>
        <AppText variant="caption" center style={styles.privacy}>
          L'image de la caméra sert uniquement pendant la séance. Ziko Shop n'enregistre aucune image.
        </AppText>

        {/* Choix du modèle : l'essayage se relance avec le pull choisi. */}
        <View style={styles.models}>
          {groups.map((group) => {
            const isActive = group.model === model;
            const cover = group.variants.find((v) => normalize(splitProductName(v.name).color ?? "") === normalize(color ?? "")) ?? group.variants[0];
            return (
              <PressableScale
                key={group.model}
                onPress={() => pickModel(group.model)}
                style={[styles.modelCard, isActive && styles.modelActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`Essayer ${group.model}`}
              >
                {cover ? <ProductImage path={cover.imageUrl} name={group.model} style={styles.modelImage} /> : null}
                {isActive ? (
                  <View style={styles.check}>
                    <Ionicons name="checkmark" size={12} color={colors.onAccent} />
                  </View>
                ) : null}
              </PressableScale>
            );
          })}
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <AppText variant="h2">{model}</AppText>
              <AppText variant="small">{modelCopy(model).tagline}</AppText>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <AppText variant="price">{formatCdf(selected.priceCdf)}</AppText>
              <StockBadge stock={selected.stock} size="sm" />
            </View>
          </View>
          {variants.length > 1 ? (
            <View style={styles.colorBlock}>
              <AppText variant="small">Couleur : {color}</AppText>
              <ColorSwatches
                size={30}
                options={variants.map((v) => ({ id: v.id, color: splitProductName(v.name).color ?? "", disabled: v.stock <= 0 }))}
                selectedId={selected.id}
                onSelect={pick}
              />
            </View>
          ) : null}
        </Card>

        {/* L'achat n'est JAMAIS bloqué par le service d'essayage. */}
        <Button
          title={selected.stock > 0 ? `Commander ce pull · ${formatCdf(selected.priceCdf)}` : "Produit épuisé"}
          icon="bag-handle-outline"
          disabled={selected.stock <= 0}
          onPress={() => router.push({ pathname: "/order/[productId]", params: { productId: selected.id } })}
        />
      </ScrollView>

      <Sheet
        visible={helpOpen}
        onClose={() => setHelpOpen(false)}
        icon="scan-outline"
        tone="accent"
        title="Comment ça marche ?"
        message="L'essayage démarre tout seul dans le cadre. Placez-vous face à la caméra, le haut du corps bien visible, et reculez d'un pas si besoin. Touchez un autre modèle ou une autre couleur : le pull change aussitôt. Il vous plaît ? Commandez-le juste en dessous."
      >
        <Button title="J'ai compris" onPress={() => setHelpOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const STATUS_LABEL: Record<TryOnStatus, string> = {
  loading: "Préparation…",
  ready: "Connexion à la caméra…",
  live: "En direct",
  ended: "Séance terminée",
  error: "Interrompu",
};

function StatusChip({ status }: { status: TryOnStatus }) {
  const live = status === "live";
  return (
    <View pointerEvents="none" style={styles.chip}>
      <View style={[styles.dot, { backgroundColor: live ? colors.accent : status === "error" ? colors.danger : colors.textSecondary }]} />
      <AppText variant="caption" color={colors.text}>
        {STATUS_LABEL[status]}
      </AppText>
    </View>
  );
}

function StageMessage(props: { image: string | null; name: string; icon: keyof typeof Ionicons.glyphMap; title: string; message: string; action?: React.ReactNode }) {
  return (
    <Animated.View entering={FadeIn.duration(motion.base)} style={styles.fill}>
      <ProductImage path={props.image} name={props.name} style={styles.stageImage} />
      <View style={styles.endCard}>
        <Ionicons name={props.icon} size={26} color={colors.accent} />
        <AppText variant="bodyStrong" center>
          {props.title}
        </AppText>
        <AppText variant="small" center>
          {props.message}
        </AppText>
        {props.action}
      </View>
    </Animated.View>
  );
}

const CORNER = { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs },
  stage: {
    width: "100%",
    aspectRatio: 3 / 4,
    maxHeight: 560,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  privacy: { marginTop: -spacing.sm, color: colors.textTertiary },
  fill: { ...CORNER },
  stageImage: { ...CORNER, width: "100%", height: "100%", borderRadius: 0 },
  chip: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  endCard: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.overlay,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  models: { flexDirection: "row", gap: spacing.sm },
  modelCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: 3, backgroundColor: colors.surface },
  modelActive: { borderColor: colors.accent },
  modelImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  check: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  infoCard: { gap: spacing.md },
  infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  colorBlock: { gap: spacing.sm },
});
