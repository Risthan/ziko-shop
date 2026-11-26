import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors, spacing } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

/**
 * Indicateur de chargement. Si l'attente se prolonge (serveur gratuit qui
 * se réveille), on explique au client ce qui se passe au lieu de le laisser
 * devant un écran figé.
 */
export function LoadingState({ message, slowMessage, slowAfterMs = 6_000 }: { message: string; slowMessage?: string; slowAfterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), slowAfterMs);
    return () => clearTimeout(timer);
  }, [slowAfterMs]);

  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator size="large" color={colors.text} />
      <AppText style={styles.text}>{message}</AppText>
      {slow && slowMessage ? (
        <AppText variant="caption" style={styles.text}>
          {slowMessage}
        </AppText>
      ) : null}
    </View>
  );
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
      <AppText variant="heading" style={styles.text}>
        {title}
      </AppText>
      <AppText variant="caption" style={styles.text}>
        {message}
      </AppText>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Réessayer" icon="refresh" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl, gap: spacing.md },
  text: { textAlign: "center", maxWidth: 320 },
  action: { marginTop: spacing.sm, minWidth: 180 },
});
