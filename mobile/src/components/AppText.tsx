import { StyleSheet, Text, type TextProps } from "react-native";
import { colors, fonts } from "@/theme";

type Variant = "display" | "title" | "heading" | "body" | "label" | "caption" | "price";

interface Props extends TextProps {
  variant?: Variant;
  muted?: boolean;
  color?: string;
}

/**
 * Texte de l'app. La taille suit les réglages d'accessibilité du téléphone,
 * mais plafonnée pour que la mise en page reste lisible sur un petit écran.
 */
export function AppText({ variant = "body", muted, color, style, ...props }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={1.35}
      {...props}
      style={[styles[variant], muted && styles.muted, color ? { color } : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  display: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.text },
  title: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 30, color: colors.text },
  heading: { fontFamily: fonts.serif, fontSize: 18, lineHeight: 24, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  price: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  muted: { color: colors.textMuted },
});
