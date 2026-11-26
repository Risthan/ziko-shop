import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export function QuantityStepper({ value, min = 1, max, onChange, disabled }: Props) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`Quantité : ${value}`}>
      <Pressable
        onPress={() => onChange(value - 1)}
        disabled={!canDecrease}
        style={[styles.button, !canDecrease && styles.inactive]}
        accessibilityRole="button"
        accessibilityLabel="Diminuer la quantité"
        hitSlop={6}
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </Pressable>
      <AppText variant="price" style={styles.value}>
        {value}
      </AppText>
      <Pressable
        onPress={() => onChange(value + 1)}
        disabled={!canIncrease}
        style={[styles.button, !canIncrease && styles.inactive]}
        accessibilityRole="button"
        accessibilityLabel="Augmenter la quantité"
        hitSlop={6}
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  inactive: { opacity: 0.35 },
  value: { minWidth: 40, textAlign: "center" },
});
