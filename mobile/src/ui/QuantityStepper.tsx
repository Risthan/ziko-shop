import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius } from "@/theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

interface Props {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

/** Sélecteur de quantité : le chiffre change avec un léger fondu. */
export function QuantityStepper({ value, min = 1, max, onChange, disabled }: Props) {
  const canDecrease = !disabled && value > min;
  const canIncrease = !disabled && value < max;
  const change = (next: number) => {
    haptics.select();
    onChange(next);
  };

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`Quantité : ${value}`}>
      <PressableScale
        haptic={false}
        onPress={() => change(value - 1)}
        disabled={!canDecrease}
        style={[styles.button, !canDecrease && styles.inactive]}
        accessibilityRole="button"
        accessibilityLabel="Diminuer la quantité"
        hitSlop={6}
      >
        <Ionicons name="remove" size={20} color={colors.text} />
      </PressableScale>
      <View style={styles.valueBox}>
        <Animated.View key={value} entering={FadeIn.duration(160)} exiting={FadeOut.duration(80)}>
          <AppText style={styles.value}>{value}</AppText>
        </Animated.View>
      </View>
      <PressableScale
        haptic={false}
        onPress={() => change(value + 1)}
        disabled={!canIncrease}
        style={[styles.button, !canIncrease && styles.inactive]}
        accessibilityRole="button"
        accessibilityLabel="Augmenter la quantité"
        hitSlop={6}
      >
        <Ionicons name="add" size={20} color={colors.text} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  button: { width: 42, height: 42, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised },
  inactive: { opacity: 0.35 },
  valueBox: { minWidth: 44, alignItems: "center" },
  value: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text },
});
