import { Image } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { imageUrl } from "@/config";
import { colors } from "@/theme";
import { AppText } from "./AppText";

interface Props {
  path: string | null;
  name: string;
  style?: StyleProp<ViewStyle>;
}

/** Photo du pull, ou un monogramme élégant si le produit n'a pas d'image. */
export function ProductImage({ path, name, style }: Props) {
  const uri = imageUrl(path);
  return (
    <View style={[styles.frame, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
          accessibilityLabel={`Photo : ${name}`}
        />
      ) : (
        <AppText variant="title" muted>
          {name.trim().charAt(0).toUpperCase() || "Z"}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 3 / 4,
    backgroundColor: colors.imageBackdrop,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});
