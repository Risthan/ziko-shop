import { Tabs } from "expo-router/tabs";
import { colors } from "@/theme";
import { TabBar } from "@/ui/TabBar";

/** Les quatre onglets principaux, avec la même barre flottante. */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="essayage" options={{ title: "Essayage" }} />
      <Tabs.Screen name="panier" options={{ title: "Panier" }} />
      <Tabs.Screen name="profil" options={{ title: "Profil" }} />
    </Tabs>
  );
}
