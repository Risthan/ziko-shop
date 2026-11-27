import { StyleSheet } from "react-native";
import { spacing } from "@/theme";

/** Mise en page commune aux écrans Connexion et Inscription. */
export const authStyles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg, maxWidth: 520, width: "100%", alignSelf: "center" },
  title: { gap: spacing.xs, marginBottom: spacing.xs },
  switch: { paddingVertical: spacing.md },
});
