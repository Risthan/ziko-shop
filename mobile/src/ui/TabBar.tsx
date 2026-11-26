import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";
import { colors, fonts, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";
import { PressableScale } from "./PressableScale";

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: "home", idle: "home-outline" },
  essayage: { active: "scan", idle: "scan-outline" },
  commandes: { active: "bag-handle", idle: "bag-handle-outline" },
};

/** Barre d'onglets flottante, identique sur tous les écrans principaux. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key]!;
          const label = typeof options.title === "string" ? options.title : route.name;
          const icon = ICONS[route.name] ?? ICONS.index!;
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptics.select();
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <PressableScale
              key={route.key}
              haptic={false}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Ionicons name={focused ? icon.active : icon.idle} size={21} color={focused ? colors.accent : colors.textSecondary} />
              <AppText style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.background },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 6,
    gap: 6,
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8, borderRadius: radius.lg, minHeight: 52 },
  itemActive: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: "rgba(208, 245, 75, 0.25)" },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  labelActive: { color: colors.accent, fontFamily: fonts.bold },
});
