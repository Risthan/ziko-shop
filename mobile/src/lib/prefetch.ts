import { Image } from "expo-image";
import type { Product } from "@/api/types";
import { imageUrl } from "@/config";

const requested = new Set<string>();

/**
 * Charge d'avance les photos des pulls (mémoire et disque) : la grille, la
 * fiche et le changement de couleur s'affichent sans attendre le réseau.
 * Chaque photo n'est demandée qu'une fois par lancement de l'app ; un échec
 * est sans conséquence (la photo se chargera normalement à l'affichage).
 */
export function prefetchProductImages(products: Pick<Product, "imageUrl">[]): void {
  const urls = products
    .map((product) => imageUrl(product.imageUrl))
    .filter((url): url is string => !!url && !requested.has(url));
  if (urls.length === 0) return;
  urls.forEach((url) => requested.add(url));
  void Image.prefetch(urls, "memory-disk").catch(() => {
    urls.forEach((url) => requested.delete(url));
  });
}
