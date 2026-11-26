import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useCart } from "@/lib/cart/useCart";
import { colors, fonts, motion } from "@/theme";
import { AppText } from "./AppText";
import { IconButton } from "./IconButton";

/** Bouton panier de l'en-tête, avec le nombre de pièces. */
export function CartButton() {
  const { count } = useCart();
  return (
    <View>
      <IconButton icon="cart-outline" label={count > 0 ? `Panier, ${count} article${count > 1 ? "s" : ""}` : "Panier"} onPress={() => router.navigate("/panier")} />
      {count > 0 ? (
        <Animated.View key={count} entering={ZoomIn.duration(motion.fast)} style={styles.badge} pointerEvents="none">
          <AppText style={styles.text}>{count > 99 ? "99+" : count}</AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  text: { fontFamily: fonts.extrabold, fontSize: 10, lineHeight: 13, color: colors.onAccent },
});
