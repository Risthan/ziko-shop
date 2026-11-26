import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { spacing } from "@/theme";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";
import { Logo } from "./Logo";

interface Props {
  /** Affiche le bouton retour (écrans empilés). */
  back?: boolean;
  /** Titre court à la place du logo. */
  title?: string;
  right?: ReactNode;
}

/** En-tête commun à tous les écrans : retour à gauche, logo au centre, action à droite. */
export function Header({ back, title, right }: Props) {
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <View style={styles.bar}>
      <View style={styles.side}>{back ? <IconButton icon="arrow-back" label="Retour" onPress={goBack} /> : null}</View>
      <View style={styles.center}>{title ? <AppText variant="h3">{title}</AppText> : <Logo width={118} />}</View>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    minHeight: 56,
  },
  side: { width: 92, flexDirection: "row", gap: spacing.sm },
  right: { justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center" },
});
