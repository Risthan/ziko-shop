import { normalize } from "./format.ts";

/**
 * Couleur de chaque pastille, relevée sur les photos des pulls (zone éclairée
 * du tissu) : la pastille montre la vraie couleur du vêtement.
 */
export const SWATCHES: Record<string, string> = {
  noir: "#151515",
  creme: "#E4DCCB",
  moka: "#5A3A28",
  "bleu roi": "#1F47A8",
  rouge: "#B0141F",
  // Noms proches, si un produit est ajouté depuis l'administration.
  marron: "#5A3A28",
  chocolat: "#5A3A28",
  bleu: "#1F47A8",
  "bleu marine": "#1B2A4A",
  blanc: "#F4F4F2",
  beige: "#D8C6A6",
  gris: "#8A9096",
  vert: "#2F6B3A",
  bordeaux: "#6E1423",
};

/** La couleur d'une pastille d'après le nom de la couleur (« Bleu roi », « crème »…), ou null si inconnue. */
export function swatchFor(colorName: string): string | null {
  const key = normalize(colorName);
  return SWATCHES[key] ?? SWATCHES[key.split(" ")[0] ?? ""] ?? null;
}

/** L'ordre d'affichage des couleurs, partout dans l'app : du plus sobre au plus vif. */
export const COLOR_ORDER = ["noir", "creme", "moka", "bleu roi", "rouge"];
