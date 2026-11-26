import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { API_URL } from "@/config";
import { groupByModel, modelCopy } from "@/lib/catalog";
import { formatCdf, normalize, splitProductName } from "@/lib/format";
import { haptics } from "@/lib/haptics";
import { useProducts, useTryOnConfig } from "@/lib/queries";
import { colors, motion, radius, spacing } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Badge, StockBadge } from "@/ui/Badges";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { ColorSwatches } from "@/ui/ColorSwatches";
import { Header } from "@/ui/Header";
import { IconButton } from "@/ui/IconButton";
import { Notice } from "@/ui/Notice";
import { PressableScale } from "@/ui/PressableScale";
import { ProductImage } from "@/ui/ProductImage";
import { Screen } from "@/ui/Screen";
import { Sheet } from "@/ui/Sheet";
import { LoadingState } from "@/ui/States";

/**
 * Écran 03 — Essayage virtuel en direct.
 * Le flux vidéo (caméra + IA) s'ouvre dans le navigateur du téléphone : c'est
 * ce qui fonctionne dans Expo Go sur iPhone et Android, sans module natif.
 * Ici, on choisit le pull, on donne son accord, et on peut toujours commander.
 */
export default function TryOnScreen() {
  const { produit } = useLocalSearchParams<{ produit?: string }>();
  const products = useProducts();
  const config = useTryOnConfig();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const all = products.data ?? [];
  const groups = useMemo(() => groupByModel(all), [all]);
  const selected = all.find((p) => p.id === (pickedId ?? produit)) ?? all.find((p) => p.stock > 0) ?? all[0];

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

  const pickModel = (target: string) => {
    const group = groups.find((g) => g.model === target);
    const sameColor = group?.variants.find((v) => normalize(splitProductName(v.name).color ?? "") === normalize(color ?? ""));
    const next = sameColor ?? group?.variants[0];
    if (next) {
      haptics.select();
      setPickedId(next.id);
      setSessionDone(false);
    }
  };

  const start = async () => {
    setSessionDone(false);
    await WebBrowser.openBrowserAsync(`${API_URL}/essayage?produit=${selected.id}`, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      controlsColor: colors.accent,
      toolbarColor: colors.background,
    });
    setSessionDone(true);
  };

  return (
    <Screen>
      <Header right={<IconButton icon="help-circle-outline" label="Comment ça marche ?" onPress={() => setHelpOpen(true)} />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <AppText variant="h1">Essayage en direct</AppText>
          <Badge label="IA" tone="accent" icon="sparkles" size="sm" />
        </View>
        <AppText variant="body" style={styles.subtitle}>
          Voyez-vous porter le pull en temps réel, avec la caméra de votre téléphone.
        </AppText>

        {/* Aperçu du vêtement choisi (photo produit, PAS un flux vidéo) */}
        <View style={styles.preview}>
          <ProductImage path={selected.imageUrl} name={selected.name} style={styles.previewImage} />
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={styles.previewTag}>
            <Ionicons name="shirt-outline" size={14} color={colors.text} />
            <AppText variant="caption" color={colors.text}>
              Aperçu du vêtement
            </AppText>
          </View>
          <View style={styles.serviceTag}>
            {config.isPending ? (
              <Badge label="Vérification…" tone="neutral" size="sm" />
            ) : available ? (
              <Badge label="Service disponible" tone="accent" icon="radio-button-on" size="sm" />
            ) : (
              <Badge label="Service indisponible" tone="warning" icon="pause-circle-outline" size="sm" />
            )}
          </View>
        </View>

        {/* Choix du modèle */}
        <View style={styles.models}>
          {groups.map((group) => {
            const active = group.model === model;
            const cover = group.variants.find((v) => normalize(splitProductName(v.name).color ?? "") === normalize(color ?? "")) ?? group.variants[0];
            return (
              <PressableScale
                key={group.model}
                onPress={() => pickModel(group.model)}
                style={[styles.modelCard, active && styles.modelActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Essayer ${group.model}`}
              >
                {cover ? <ProductImage path={cover.imageUrl} name={group.model} style={styles.modelImage} /> : null}
                {active ? (
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
                onSelect={(variantId) => {
                  setPickedId(variantId);
                  setSessionDone(false);
                }}
              />
            </View>
          ) : null}
        </Card>

        {sessionDone ? <Notice tone="info" title="Séance terminée" message="Ce pull vous plaît ? Vous pouvez le commander directement." /> : null}

        {available ? (
          <>
            <PressableScale
              haptic
              onPress={() => setConsent((value) => !value)}
              style={styles.consent}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consent }}
            >
              <View style={[styles.checkbox, consent && styles.checkboxOn]}>
                {consent ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
              </View>
              <AppText variant="small" style={{ flex: 1 }}>
                J'accepte que l'image de ma caméra soit transmise au service d'essayage (Decart) pendant la séance, 45 secondes au maximum. Ziko Shop n'enregistre aucune image.
              </AppText>
            </PressableScale>
            <Button title="Lancer l'essayage" icon="videocam-outline" disabled={!consent} onPress={() => void start()} />
          </>
        ) : !config.isPending ? (
          <Animated.View entering={FadeIn.duration(motion.base)}>
            <Notice
              tone="warning"
              title="Essayage indisponible pour le moment"
              message={
                config.isError
                  ? "Impossible de joindre le service d'essayage. Vous pouvez quand même commander ce pull."
                  : "Le service d'essayage n'est pas activé sur ce serveur. Vous pouvez quand même commander ce pull."
              }
            />
          </Animated.View>
        ) : null}

        {/* L'achat n'est JAMAIS bloqué par le service d'IA. */}
        <Button
          title={selected.stock > 0 ? `Commander ce pull · ${formatCdf(selected.priceCdf)}` : "Produit épuisé"}
          variant={available ? "secondary" : "primary"}
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
        message="Choisissez un modèle et une couleur, acceptez l'utilisation de la caméra, puis lancez l'essayage : une page sécurisée s'ouvre avec votre caméra frontale et l'IA vous habille en direct. Fermez-la pour revenir ici et commander."
      >
        <Button title="J'ai compris" onPress={() => setHelpOpen(false)} />
      </Sheet>
    </Screen>
  );
}

const CORNER = 26;

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg, maxWidth: 640, width: "100%", alignSelf: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  subtitle: { marginTop: -spacing.sm },
  preview: { borderRadius: radius.xl, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  previewImage: { width: "100%", aspectRatio: 4 / 4.2, borderRadius: 0 },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: colors.accent, opacity: 0.8 },
  cornerTL: { top: 56, left: "22%", borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cornerTR: { top: 56, right: "22%", borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  previewTag: {
    position: "absolute",
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.overlay,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceTag: { position: "absolute", left: spacing.md, top: spacing.md },
  models: { flexDirection: "row", gap: spacing.sm },
  modelCard: { flex: 1, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: 3, backgroundColor: colors.surface },
  modelActive: { borderColor: colors.accent },
  modelImage: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  check: { position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  infoCard: { gap: spacing.md },
  infoRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  colorBlock: { gap: spacing.sm },
  consent: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.backgroundSecondary },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
