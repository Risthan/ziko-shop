import { Image } from "expo-image";

/** Le logo officiel Ziko Shop (fichier fourni, jamais recréé avec une police). Ratio 4,62:1. */
export function Logo({ width = 112 }: { width?: number }) {
  return (
    <Image
      source={require("../../assets/logo-white.png")}
      style={{ width, height: width / 4.62 }}
      contentFit="contain"
      accessibilityLabel="Ziko Shop"
      accessibilityRole="image"
    />
  );
}
