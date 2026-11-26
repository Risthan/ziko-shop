/** Design « quiet luxury » de ZIKO SHOP : crème, noir profond, une touche moka. */
export const colors = {
  background: "#F5F3EF",
  surface: "#FFFFFF",
  imageBackdrop: "#E6E5E2",
  text: "#141414",
  textMuted: "#6B655D",
  border: "#E2DDD4",
  accent: "#4E3629",
  success: "#2F6B3F",
  successSoft: "#E4EFE5",
  danger: "#A3362A",
  dangerSoft: "#F6E3E0",
  warning: "#8A6A1F",
  warningSoft: "#F4ECD9",
} as const;

export const fonts = {
  serif: "PlayfairDisplay_600SemiBold",
  serifBold: "PlayfairDisplay_700Bold",
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, pill: 999 } as const;

/** Couleurs des pastilles, d'après le nom de la couleur du pull. */
export const swatchColors: Record<string, string> = {
  noir: "#141414",
  creme: "#E8E0D2",
  moka: "#4E3629",
};
