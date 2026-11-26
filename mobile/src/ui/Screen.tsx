import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/theme";

interface Props {
  children: ReactNode;
  /** Bords protégés (encoche, barre système). Par défaut : haut, gauche, droite. */
  edges?: Edge[];
  /** Halo très discret en haut d'écran. */
  glow?: "accent" | "danger" | "none";
}

/** Fond de tous les écrans : noir profond, avec un halo subtil (jamais néon). */
export function Screen({ children, edges = ["top", "left", "right"], glow = "accent" }: Props) {
  const glowColor = glow === "danger" ? "rgba(255, 69, 69, 0.10)" : "rgba(208, 245, 75, 0.06)";
  return (
    <View style={styles.root}>
      {glow !== "none" ? (
        <LinearGradient
          colors={[glowColor, "rgba(9, 13, 16, 0)"]}
          start={{ x: 0.85, y: 0 }}
          end={{ x: 0.2, y: 0.45 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <SafeAreaView style={styles.safe} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
});
