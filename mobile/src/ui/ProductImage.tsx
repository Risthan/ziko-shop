import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { imageUrl } from "@/config";
import { colors, photoBackdrop, radius } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  path: string | null;
  name: string;
  style?: StyleProp<ViewStyle>;
  fit?: "contain" | "cover";
}

/**
 * Photo produit. Le cadre a la couleur du fond de studio des photos : la photo
 * remplit le cadre bord à bord, sans liseré qui dépasse, même pendant le
 * chargement. Fondu enchaîné quand on change de couleur.
 */
export function ProductImage({ path, name, style, fit = "cover" }: Props) {
  const uri = imageUrl(path);
  return (
    <View style={[styles.frame, uri ? styles.withPhoto : null, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={fit}
          transition={200}
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
  withPhoto: { backgroundColor: photoBackdrop },
});
