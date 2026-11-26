import type { Product } from "@/api/types";
import { splitProductName } from "./format";

/**
 * Textes éditoriaux par modèle (sous-titre, description, matière).
 * Les données commerciales — nom, prix, stock, image — viennent TOUJOURS de l'API.
 */
const MODEL_COPY: Record<string, { tagline: string; description: string; material: string }> = {
  "Le Classique": {
    tagline: "Sweat col rond premium",
    description: "Le sweat de tous les jours : coupe ample, épaules tombantes et logo Ziko Shop brodé sur la poitrine.",
    material: "Molleton de coton brossé 450 g/m². Bord-côtes au col, aux poignets et à la taille. Lavage à 30 °C, sur l'envers.",
  },
  "L'Essentiel": {
    tagline: "Hoodie premium",
    description: "Le hoodie épuré : capuche doublée sans cordons, grande poche kangourou et logo brodé.",
    material: "Molleton de coton épais 450 g/m², intérieur gratté. Lavage à 30 °C, sur l'envers.",
  },
  "Le Signature": {
    tagline: "Pull demi-zip",
    description: "Le pull demi-zip en maille épaisse : col montant côtelé, zip métal et logo brodé côté cœur.",
    material: "Maille épaisse en laine mélangée. Lavage délicat à 30 °C, séchage à plat.",
  },
};

export function modelCopy(model: string) {
  return MODEL_COPY[model] ?? { tagline: "Pull Ziko Shop", description: "", material: "" };
}

export interface ModelGroup {
  model: string;
  tagline: string;
  variants: Product[];
}

/** Regroupe les produits de l'API par modèle (« Le Classique — Noir / Crème / Moka »). */
export function groupByModel(products: Product[]): ModelGroup[] {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const { model } = splitProductName(product.name);
    groups.set(model, [...(groups.get(model) ?? []), product]);
  }
  return [...groups].map(([model, variants]) => ({ model, tagline: modelCopy(model).tagline, variants }));
}

/** Les couleurs (et variantes) d'un même modèle. */
export function variantsOf(products: Product[], product: Product): Product[] {
  const { model } = splitProductName(product.name);
  return products.filter((item) => splitProductName(item.name).model === model);
}
