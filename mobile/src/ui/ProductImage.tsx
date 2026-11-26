import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { imageUrl } from "@/config";
import { colors, radius } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  path: string | null;
  name: string;
  style?: StyleProp<ViewStyle>;
  fit?: "contain" | "cover";
}

/**
 * Photo produit sur le même anthracite que son fond de studio : le pull
 * semble posé sur la carte. Fondu enchaîné quand on change de couleur.
 */
export function ProductImage({ path, name, style, fit = "cover" }: Props) {
  const uri = imageUrl(path);
  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={250}
          cachePolicy="memory-disk"
          accessibilityLabel={`Photo : ${name}`}
        />
      ) : (
        <AppText variant="h1" color={colors.textTertiary}>
          {name.trim().charAt(0).toUpperCase() || "Z"}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
