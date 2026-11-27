import { StyleSheet, View } from "react-native";
import { normalize } from "@/lib/format";
import { swatchFor } from "@/lib/swatches";
import { colors, radius } from "@/theme";
import { PressableScale } from "./PressableScale";

export interface SwatchOption {
  id: string;
  color: string;
  disabled?: boolean;
}

/** La vraie couleur du pull ; gris neutre seulement pour une couleur inconnue. */
const swatch = (name: string) => swatchFor(name) ?? colors.textTertiary;

/** Sélecteur de couleurs (les variantes d'un même modèle). */
export function ColorSwatches({ options, selectedId, onSelect, size = 36 }: { options: SwatchOption[]; selectedId: string; onSelect: (id: string) => void; size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <PressableScale
            key={option.id}
            onPress={() => onSelect(option.id)}
            accessibilityRole="radio"
            accessibilityLabel={`Couleur ${option.color}${option.disabled ? ", épuisée" : ""}`}
            accessibilityState={{ selected }}
            style={[styles.ring, { width: size + 10, height: size + 10 }, selected && styles.ringSelected]}
          >
            <View style={[styles.dot, { width: size, height: size, backgroundColor: swatch(option.color) }, option.disabled && styles.disabled]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Petites pastilles non cliquables (aperçu des couleurs disponibles sur une carte). */
export function ColorDots({ colorsList, active }: { colorsList: string[]; active?: string }) {
  return (
    <View style={styles.dots}>
      {colorsList.map((name) => (
        <View key={name} style={[styles.miniRing, normalize(name) === normalize(active ?? "") && styles.miniRingActive]}>
          <View style={[styles.mini, { backgroundColor: swatch(name) }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  ring: { borderRadius: radius.pill, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  ringSelected: { borderColor: colors.accent },
  dot: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong },
  disabled: { opacity: 0.35 },
  dots: { flexDirection: "row", gap: 4 },
  miniRing: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  miniRingActive: { borderColor: colors.accent },
  mini: { width: 10, height: 10, borderRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
});
