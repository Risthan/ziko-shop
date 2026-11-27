/**
 * ZIKO SHOP — PREMIUM DARK COMMERCE
 * Toutes les couleurs, polices, espacements, rayons, ombres et durées
 * d'animation de l'app viennent d'ici : aucun écran ne définit les siennes.
 */

export const colors = {
  background: "#090D10",
  backgroundSecondary: "#11171C",
  surface: "#171E24",
  surfaceRaised: "#1E262D",
  border: "#2B333B",
  borderStrong: "#3A444D",

  accent: "#D0F54B",
  accentPressed: "#BFE33C",
  accentSoft: "rgba(208, 245, 75, 0.10)",
  accentBorder: "rgba(208, 245, 75, 0.45)",
  onAccent: "#0B0F12",

  text: "#FFFFFF",
  textSecondary: "#A6AAB0",
  textTertiary: "#6F767D",

  danger: "#FF4545",
  dangerSoft: "rgba(255, 69, 69, 0.10)",
  dangerBorder: "rgba(255, 69, 69, 0.45)",
  warning: "#FFB547",
  warningSoft: "rgba(255, 181, 71, 0.10)",
  warningBorder: "rgba(255, 181, 71, 0.45)",

  overlay: "rgba(5, 8, 10, 0.72)",
} as const;

export const fonts = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

/** Ombres discrètes : de la profondeur, pas d'effet néon. */
export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  accentGlow: {
    shadowColor: colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

/** Durées et ressorts partagés : toutes les animations ont le même rythme. */
export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  stagger: 55,
  pressScale: 0.97,
  spring: { damping: 18, stiffness: 220, mass: 0.8 },
} as const;

/**
 * Fond de studio des photos produit (gris clair, relevé sur les photos). Le
 * cadre d'une photo prend cette couleur : aucun liseré gris foncé ne dépasse
 * autour du pull, même pendant le chargement ou au bord d'un angle arrondi.
 * Les pastilles de couleur sont dans src/lib/swatches.ts.
 */
export const photoBackdrop = "#E5EBEE";
