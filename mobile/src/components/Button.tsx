import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { colors, fonts, radius } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, accessibilityHint }: Props) {
  const inactive = disabled || loading;
  const foreground = variant === "primary" ? colors.surface : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
          <AppText style={[styles.title, { color: foreground }, variant === "ghost" && styles.ghostTitle]}>{title}</AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.sm,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.text },
  secondary: { borderWidth: 1, borderColor: colors.text, backgroundColor: "transparent" },
  ghost: { minHeight: 44, backgroundColor: "transparent" },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontFamily: fonts.semibold, fontSize: 16, textAlign: "center" },
  ghostTitle: { textDecorationLine: "underline", fontFamily: fonts.medium, fontSize: 14 },
});
