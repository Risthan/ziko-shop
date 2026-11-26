import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { colors } from "@/theme";
import { LoadingState } from "./States";

export type TryOnStatus = "loading" | "ready" | "live" | "ended" | "error";

interface Props {
  url: string;
  onStatus: (status: TryOnStatus, message?: string) => void;
}

/**
 * La séance d'essayage, affichée DANS l'app (WebView, inclus dans Expo Go).
 * La page /essayage du serveur s'y lance toute seule (mode ?embed=1) et
 * nous informe de son état (prête, en direct, terminée, erreur).
 */
export function TryOnView({ url, onStatus }: Props) {
  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { source?: string; status?: TryOnStatus; message?: string };
      if (data.source === "ziko-tryon" && data.status) onStatus(data.status, data.message);
    } catch {
      // Message d'un script tiers : ignoré.
    }
  };

  return (
    <WebView
      source={{ uri: url }}
      style={styles.web}
      containerStyle={styles.container}
      javaScriptEnabled
      domStorageEnabled
      // Caméra : lecture vidéo dans la page et accès accordé à la page d'essayage.
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      // Tout reste dans l'app : pas de nouvelle fenêtre.
      setSupportMultipleWindows={false}
      originWhitelist={["https://*", "http://*"]}
      bounces={false}
      overScrollMode="never"
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <LoadingState message="Préparation de l'essayage…" />
        </View>
      )}
      onMessage={onMessage}
      onError={() => onStatus("error", "Impossible de charger l'essayage. Vérifiez votre connexion.")}
      onHttpError={() => onStatus("error", "Le service d'essayage ne répond pas pour le moment.")}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  web: { flex: 1, backgroundColor: colors.surface },
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface },
});
