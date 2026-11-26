import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { useCart } from "@/lib/cart/useCart";
import { colors, fonts, motion, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import { PressableScale } from "./PressableScale";

/** Confirmation discrète après un ajout, avec un raccourci vers le panier. */
export function AddedToCart({ name }: { name: string }) {
  const { count } = useCart();
  return (
    <Animated.View entering={FadeInDown.duration(motion.base)} exiting={FadeOut.duration(motion.fast)} style={styles.box}>
      <View style={styles.icon}>
        <Ionicons name="checkmark" size={14} color={colors.onAccent} />
      </View>
      <AppText variant="small" color={colors.text} numberOfLines={1} style={{ flex: 1 }} accessibilityLabel={`${name} ajouté au panier`}>
        Ajouté au panier
      </AppText>
      <PressableScale onPress={() => router.navigate("/panier")} accessibilityRole="link" accessibilityLabel="Voir le panier" style={styles.link}>
        <AppText variant="small" color={colors.accent} style={styles.linkText}>
          Voir le panier ({count})
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentBorder,
  },
  icon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  link: { paddingVertical: 4, paddingLeft: spacing.xs },
  linkText: { fontFamily: fonts.bold },
});
