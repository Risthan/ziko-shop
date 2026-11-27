import type { Product } from "@/api/types";
import { normalize, splitProductName } from "./format.ts";
import { COLOR_ORDER } from "./swatches.ts";

/** L'ordre des modèles dans la boutique : sweat, hoodie, puis demi-zip. */
const MODEL_ORDER = ["Le Classique", "L'Essentiel", "Le Signature"];

/**
 * Textes éditoriaux par modèle (sous-titre, description, matière).
 * Les données commerciales — nom, prix, stock, image — viennent TOUJOURS de l'API.
 */
const MODEL_COPY: Record<string, { tagline: string; description: string; material: string }> = {
  "Le Classique": {
    tagline: "Sweat col rond",
    description: "Le sweat de tous les jours : coupe ample, épaules tombantes et logo Ziko Shop brodé sur la poitrine.",
    material: "Molleton de coton brossé 450 g/m². Bord-côtes au col, aux poignets et à la taille. Lavage à 30 °C, sur l'envers.",
  },
  "L'Essentiel": {
    tagline: "Sweat à capuche",
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

/**
 * Range le catalogue : modèle par modèle (Classique, Essentiel, Signature, puis
 * les modèles ajoutés plus tard), et dans chaque modèle les couleurs toujours
 * dans le même ordre (Noir, Crème, Moka, Bleu roi, Rouge, puis les autres).
 * L'ordre de l'API (date d'ajout) n'a donc plus d'effet sur l'affichage.
 */
export function sortCatalog(products: Product[]): Product[] {
  const firstSeen = new Map<string, number>();
  products.forEach((product, index) => {
    const { model } = splitProductName(product.name);
    if (!firstSeen.has(model)) firstSeen.set(model, index);
  });
  const modelRank = (model: string) => {
    const known = MODEL_ORDER.indexOf(model);
    return known === -1 ? MODEL_ORDER.length + (firstSeen.get(model) ?? 0) : known;
  };
  const colorRank = (color: string | null) => {
    const known = COLOR_ORDER.indexOf(normalize(color ?? ""));
    return known === -1 ? COLOR_ORDER.length : known;
  };
  return products
    .map((product, index) => ({ product, index, ...splitProductName(product.name) }))
    .sort(
      (a, b) =>
        modelRank(a.model) - modelRank(b.model) ||
        colorRank(a.color) - colorRank(b.color) ||
        a.product.name.localeCompare(b.product.name, "fr") ||
        a.index - b.index,
    )
    .map((entry) => entry.product);
}

/** Regroupe les produits de l'API par modèle, dans l'ordre de la boutique (« Le Classique — Noir / Crème / Moka / Bleu roi / Rouge »). */
export function groupByModel(products: Product[]): ModelGroup[] {
  const groups = new Map<string, Product[]>();
  for (const product of sortCatalog(products)) {
    const { model } = splitProductName(product.name);
    groups.set(model, [...(groups.get(model) ?? []), product]);
  }
  return [...groups].map(([model, variants]) => ({ model, tagline: modelCopy(model).tagline, variants }));
}

/** Les couleurs (et variantes) d'un même modèle, dans l'ordre de la boutique. */
export function variantsOf(products: Product[], product: Product): Product[] {
  const { model } = splitProductName(product.name);
  return sortCatalog(products).filter((item) => splitProductName(item.name).model === model);
}
