import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet } from "react-native";
import { colors, radius } from "@/theme";
import type { IconName } from "./Button";
import { PressableScale } from "./PressableScale";

/** Bouton rond à icône (retour, partager, actualiser…). Zone tactile de 44 px. */
export function IconButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.button, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
});
