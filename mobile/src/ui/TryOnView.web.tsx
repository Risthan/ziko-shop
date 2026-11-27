import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { API_URL } from "@/config";
import { colors, spacing } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

export type TryOnStatus = "loading" | "ready" | "live" | "ended" | "error";

/**
 * Version navigateur (aperçu web de l'app uniquement) : la page d'essayage
 * refuse d'être intégrée dans un autre site (protection anti-clickjacking),
 * on propose donc de l'ouvrir. Sur iPhone et Android, c'est TryOnView.tsx
 * qui l'intègre dans l'app.
 */
export function TryOnView({ productId, onStatus }: { productId: string; onStatus: (status: TryOnStatus, message?: string) => void }) {
  useEffect(() => {
    onStatus("ready");
  }, [onStatus]);
  return (
    <View style={styles.box}>
      <AppText variant="h3" center>
        L'essayage en direct s'affiche ici dans l'app mobile
      </AppText>
      <AppText variant="small" center>
        Sur ordinateur, ouvrez-le dans un nouvel onglet.
      </AppText>
      <Button
        title="Ouvrir l'essayage"
        icon="open-outline"
        variant="secondary"
        onPress={() => window.open(`${API_URL}/essayage?produit=${encodeURIComponent(productId)}`, "_blank")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.xl, backgroundColor: colors.surface },
});
