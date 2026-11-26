import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts } from "@/theme";

export type TextVariant = "display" | "h1" | "h2" | "h3" | "body" | "bodyStrong" | "small" | "caption" | "overline" | "price" | "priceLarge";

interface Props extends TextProps {
  variant?: TextVariant;
  color?: string;
  center?: boolean;
}

/**
 * Tous les textes de l'app (police Manrope). La taille suit les réglages
 * d'accessibilité du téléphone, plafonnée pour garder la mise en page lisible.
 */
export function AppText({ variant = "body", color, center, style, ...props }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      {...props}
      style={[styles[variant], color ? { color } : null, center && styles.center, style]}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.extrabold, fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: colors.text },
  h1: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: colors.text },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: colors.text },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.8, textTransform: "uppercase", color: colors.accent },
  price: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.text },
  priceLarge: { fontFamily: fonts.extrabold, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, color: colors.text },
  center: { textAlign: "center" },
});
