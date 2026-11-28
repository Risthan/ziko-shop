import { StyleSheet, View } from "react-native";
import { SIZES, type Size } from "@/lib/sizes";
import { colors, fonts, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

/**
 * Choix de la taille (S à XXL) : cinq cases de même largeur, la taille choisie
 * en couleur d'accent. `compact` : version plus petite, pour une ligne du panier.
 */
export function SizePicker({
  value,
  onChange,
  compact = false,
  disabled = false,
}: {
  value: Size;
  onChange: (size: Size) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.row, compact && styles.rowCompact]} accessibilityRole="radiogroup" accessibilityLabel="Taille">
      {SIZES.map((size) => {
        const selected = size === value;
        return (
          <PressableScale
            key={size}
            onPress={() => onChange(size)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`Taille ${size}`}
            accessibilityState={{ selected, disabled }}
            style={[styles.chip, compact && styles.chipCompact, selected && styles.chipSelected, disabled && styles.disabled]}
          >
            <AppText
              variant={compact ? "small" : "bodyStrong"}
              color={selected ? colors.onAccent : colors.text}
              style={[styles.label, selected && styles.labelSelected]}
            >
              {size}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.sm },
  rowCompact: { gap: spacing.xs },
  chip: {
    flex: 1,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCompact: { height: 32, borderRadius: radius.sm, borderWidth: 1 },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.semibold },
  labelSelected: { fontFamily: fonts.bold },
});
