import type { Db } from "./pool.js";

/** Les 9 pulls de la collection : 3 modèles × 3 couleurs, prix en francs congolais. */
export const SEED_PRODUCTS = [
  { name: "Le Classique — Noir", priceCdf: 75_000, stock: 12, imageUrl: "/images/classique-noir-v2.jpg" },
  { name: "Le Classique — Crème", priceCdf: 75_000, stock: 9, imageUrl: "/images/classique-creme-v2.jpg" },
  { name: "Le Classique — Moka", priceCdf: 75_000, stock: 6, imageUrl: "/images/classique-moka-v2.jpg" },
  { name: "L'Essentiel — Noir", priceCdf: 95_000, stock: 10, imageUrl: "/images/essentiel-noir-v2.jpg" },
  { name: "L'Essentiel — Crème", priceCdf: 95_000, stock: 4, imageUrl: "/images/essentiel-creme-v2.jpg" },
  { name: "L'Essentiel — Moka", priceCdf: 95_000, stock: 7, imageUrl: "/images/essentiel-moka-v2.jpg" },
  { name: "Le Signature — Noir", priceCdf: 125_000, stock: 5, imageUrl: "/images/signature-noir-v2.jpg" },
  { name: "Le Signature — Crème", priceCdf: 125_000, stock: 3, imageUrl: "/images/signature-creme-v2.jpg" },
  { name: "Le Signature — Moka", priceCdf: 125_000, stock: 2, imageUrl: "/images/signature-moka-v2.jpg" },
] as const;

/** Insère la collection si la boutique est vide. Renvoie le nombre de produits ajoutés. */
export async function seedIfEmpty(db: Db): Promise<number> {
  const { rows } = await db.query<{ count: string }>("SELECT count(*) FROM products");
  if (Number(rows[0]?.count) > 0) return 0;

  for (const product of SEED_PRODUCTS) {
    await db.query("INSERT INTO products (name, price_cdf, stock, image_url) VALUES ($1, $2, $3, $4)", [
      product.name,
      product.priceCdf,
      product.stock,
      product.imageUrl,
    ]);
  }
  return SEED_PRODUCTS.length;
}
