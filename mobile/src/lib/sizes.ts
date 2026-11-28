/** Les tailles proposées pour chaque pull (les mêmes que l'API accepte). */
export const SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

/** Taille sélectionnée par défaut : la plus courante. */
export const DEFAULT_SIZE: Size = "M";

export function isSize(value: unknown): value is Size {
  return typeof value === "string" && (SIZES as readonly string[]).includes(value);
}
