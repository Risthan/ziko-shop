import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/lib/cart/useCart";
import { haptics } from "@/lib/haptics";
import { colors, fonts, motion, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";
import { PressableScale } from "./PressableScale";

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: "home", idle: "home-outline" },
  essayage: { active: "scan", idle: "scan-outline" },
  panier: { active: "cart", idle: "cart-outline" },
  profil: { active: "person", idle: "person-outline" },
};

/** Barre d'onglets flottante, identique sur tous les écrans principaux. */
export function TabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === "string" ? options.title : route.name;
          const icon = ICONS[route.name] ?? ICONS.index!;
          const onPress = () => {
            if (focused) return;
            haptics.select();
            navigateToTab(route.key);
          };
          return (
            <PressableScale
              key={route.key}
              haptic={false}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={route.name === "panier" && count > 0 ? `${label}, ${count} article${count > 1 ? "s" : ""}` : label}
              style={[styles.item, focused && styles.itemActive]}
            >
              <View>
                <Ionicons name={focused ? icon.active : icon.idle} size={21} color={focused ? colors.accent : colors.textSecondary} />
                {route.name === "panier" && count > 0 ? (
                  <Animated.View key={count} entering={ZoomIn.duration(motion.fast)} style={styles.badge}>
                    <AppText style={styles.badgeText}>{count > 99 ? "99+" : count}</AppText>
                  </Animated.View>
                ) : null}
              </View>
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
  badge: {
    position: "absolute",
    top: -6,
    right: -11,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.backgroundSecondary,
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 13, color: colors.onAccent },
});
