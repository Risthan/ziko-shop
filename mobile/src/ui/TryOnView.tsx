import { type ComponentRef, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { API_URL } from "@/config";
import { colors } from "@/theme";
import { LoadingState } from "./States";

export type TryOnStatus = "loading" | "ready" | "live" | "ended" | "error";

interface Props {
  /** Le pull à essayer. Le changer pendant la séance change le pull porté, sans couper la vidéo. */
  productId: string;
  onStatus: (status: TryOnStatus, message?: string) => void;
}

/**
 * La séance d'essayage, affichée DANS l'app (WebView, inclus dans Expo Go).
 * La page /essayage du serveur s'y lance toute seule (mode ?embed=1), filme
 * le client et affiche la vidéo renvoyée par iKawn Mirror. Elle nous
 * informe de son état (prête, en direct, terminée, erreur).
 */
export function TryOnView({ productId, onStatus }: Props) {
  const web = useRef<ComponentRef<typeof WebView>>(null);
  // L'adresse ne change pas pendant la séance : changer de pull passe par un message.
  const [uri] = useState(() => `${API_URL}/essayage?produit=${encodeURIComponent(productId)}&embed=1`);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) return;
    web.current?.injectJavaScript(`window.zikoTryOn && window.zikoTryOn.select(${JSON.stringify(productId)}); true;`);
  }, [productId]);

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as { source?: string; status?: TryOnStatus; message?: string };
      if (data.source === "ziko-tryon" && data.status) onStatus(data.status, data.message);
    } catch {
      // Message inattendu : ignoré.
    }
  };

  return (
    <WebView
      ref={web}
      source={{ uri }}
      style={styles.web}
      containerStyle={styles.container}
      javaScriptEnabled
      domStorageEnabled
      // Caméra : vidéo lue dans la page, accès accordé à la page d'essayage.
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      // Tout reste dans l'app : pas de nouvelle fenêtre.
      setSupportMultipleWindows={false}
      originWhitelist={["https://*", "http://*"]}
      bounces={false}
      scrollEnabled={false}
      overScrollMode="never"
      startInLoadingState
      renderLoading={() => (
        <View style={styles.loading}>
          <LoadingState message="Préparation de l'essayage…" />
        </View>
      )}
      onLoadEnd={() => {
        loaded.current = true;
      }}
      onMessage={onMessage}
      onError={() => onStatus("error", "Impossible de charger l'essayage. Vérifiez votre connexion.")}
      onHttpError={() => onStatus("error", "Le service d'essayage ne répond pas pour le moment.")}
      // Android : si le moteur de la WebView s'arrête, on propose de relancer.
      onRenderProcessGone={() => onStatus("error", "L'essayage s'est interrompu.")}
      // iOS : même chose si le contenu web est déchargé par le système.
      onContentProcessDidTerminate={() => onStatus("error", "L'essayage s'est interrompu.")}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  web: { flex: 1, backgroundColor: colors.surface },
  loading: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface },
});
