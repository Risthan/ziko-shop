import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, radius, shadows } from "@/theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

export type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  title: string;
  onPress: () => void;
  /** primary : vert citron (action principale). secondary : contour. ghost : lien. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "lg" | "md" | "sm";
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const FOREGROUND = { primary: colors.onAccent, secondary: colors.text, ghost: colors.textSecondary, danger: colors.danger } as const;

export function Button({ title, onPress, variant = "primary", size = "lg", icon, iconRight, loading, loadingLabel, disabled, accessibilityHint, style }: Props) {
  const inactive = disabled || loading;
  const foreground = FOREGROUND[variant];
  const iconSize = size === "sm" ? 15 : 19;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      haptic={variant !== "ghost"}
      style={[styles.base, styles[size], styles[variant], variant === "primary" && !inactive && shadows.accentGlow, inactive && styles.inactive, style]}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Ionicons name={icon} size={iconSize} color={foreground} /> : null}
        <AppText
          numberOfLines={1}
          style={[styles.label, size === "sm" && styles.labelSmall, { color: foreground }, variant === "ghost" && styles.ghostLabel]}
        >
          {loading && loadingLabel ? loadingLabel : title}
        </AppText>
        {iconRight && !loading ? <Ionicons name={iconRight} size={iconSize} color={foreground} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  lg: { minHeight: 56 },
  md: { minHeight: 48 },
  sm: { minHeight: 36, paddingHorizontal: 14 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: "transparent", minHeight: 44 },
  danger: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: colors.dangerBorder },
  inactive: { opacity: 0.45 },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.1 },
  labelSmall: { fontSize: 13 },
  ghostLabel: { fontFamily: fonts.semibold, fontSize: 14, textDecorationLine: "underline" },
});
