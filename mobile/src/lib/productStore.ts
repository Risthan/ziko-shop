import type { Product } from "@/api/types";
import { splitProductName } from "./format";

/**
 * Mémoire des produits déjà chargés par la liste : la fiche s'affiche
 * instantanément, puis se rafraîchit depuis le serveur (stock à jour).
 */
let products: Product[] = [];

export const productStore = {
  setAll(list: Product[]) {
    products = list;
  },
  get(id: string): Product | undefined {
    return products.find((product) => product.id === id);
  },
  update(product: Product) {
    products = products.map((item) => (item.id === product.id ? product : item));
  },
  /** Les couleurs disponibles d'un même modèle (« Le Classique — Noir / Crème / Moka »). */
  variantsOf(model: string): Product[] {
    return products.filter((product) => splitProductName(product.name).model === model);
  },
};
