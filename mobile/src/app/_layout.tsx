import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from "@expo-google-fonts/manrope";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { api } from "@/api/client";
import { queryClient, queryKeys } from "@/lib/queries";
import { readJson, writeJson } from "@/lib/storage";
import { colors } from "@/theme";
import { Preloader } from "@/ui/Preloader";

void SplashScreen.preventAutoHideAsync();

const INTRO_KEY = "ziko:intro-seen:v1";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  // null : on ne sait pas encore ; true : première ouverture -> preloader.
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    void readJson<boolean>(INTRO_KEY, false).then((seen) => setShowIntro(!seen));
    // Le catalogue commence à se charger pendant l'écran d'accueil.
    void queryClient.prefetchQuery({ queryKey: queryKeys.products, queryFn: api.listProducts });
  }, []);

  const ready = (fontsLoaded || !!fontError) && showIntro !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  const finishIntro = useCallback(() => {
    setShowIntro(false);
    void writeJson(INTRO_KEY, true);
  }, []);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: "slide_from_right",
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="confirmation/[orderId]" options={{ animation: "fade", gestureEnabled: false }} />
        </Stack>
        {showIntro ? <Preloader onDone={finishIntro} /> : null}
      </View>
    </QueryClientProvider>
  );
}
