import type { Db } from "../db/pool.js";
import { errors } from "../http/errors.js";
import { SEED_PRODUCTS } from "../db/seed.js";
import type { CreateProductInput, UpdateProductInput } from "./products.schemas.js";

export interface Product {
  id: string;
  name: string;
  priceCdf: number;
  stock: number;
  imageUrl: string | null;
  createdAt: string;
}

interface ProductRow {
  id: string;
  name: string;
  price_cdf: number;
  stock: number;
  image_url: string | null;
  created_at: Date;
  archived_at?: Date | null;
}

const COLUMNS = "id, name, price_cdf, stock, image_url, created_at";

/** Vue administration : le produit, et s'il est retiré de la vente. */
export interface AdminProduct extends Product {
  archived: boolean;
  /** Nombre de commandes qui contiennent ce produit. */
  orderCount: number;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    priceCdf: row.price_cdf,
    stock: row.stock,
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
  };
}

/** Échappe les jokers de LIKE pour qu'une recherche "100%" cherche bien "100%". */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function createProduct(db: Db, input: CreateProductInput): Promise<Product> {
  const result = await db.query<ProductRow>(
    `INSERT INTO products (name, price_cdf, stock, image_url)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNS}`,
    [input.name, input.priceCdf, input.stock, input.imageUrl ?? null],
  );
  return toProduct(result.rows[0]!);
}

export async function listProducts(db: Db, search?: string): Promise<Product[]> {
  const result = search
    ? await db.query<ProductRow>(
        `SELECT ${COLUMNS} FROM products
         WHERE archived_at IS NULL AND name ILIKE $1 ESCAPE '\\'
         ORDER BY created_at, name`,
        [`%${escapeLike(search)}%`],
      )
    : await db.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE archived_at IS NULL ORDER BY created_at, name`);
  return result.rows.map(toProduct);
}

/**
 * Modifier un produit (prix, stock, nom, image). Les commandes déjà passées ne
 * changent pas : elles ont gardé le prix du moment où elles ont été créées.
 */
export async function updateProduct(db: Db, id: string, input: UpdateProductInput): Promise<Product> {
  const result = await db.query<ProductRow>(
    `UPDATE products SET
       name = COALESCE($2, name),
       price_cdf = COALESCE($3, price_cdf),
       stock = COALESCE($4, stock),
       image_url = COALESCE($5, image_url)
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, input.name ?? null, input.priceCdf ?? null, input.stock ?? null, input.imageUrl ?? null],
  );
  const row = result.rows[0];
  if (!row) throw errors.productNotFound();
  return toProduct(row);
}

/**
 * Remet le stock des 9 pulls de la collection à leurs quantités de départ
 * (celles de seed.ts). Les autres produits et les commandes ne bougent pas.
 */
export async function resetCollectionStock(db: Db): Promise<number> {
  const result = await db.query(
    `UPDATE products AS p SET stock = initial.stock
     FROM unnest($1::text[], $2::int[]) AS initial (name, stock)
     WHERE p.name = initial.name`,
    [SEED_PRODUCTS.map((product) => product.name), SEED_PRODUCTS.map((product) => product.stock)],
  );
  return result.rowCount ?? 0;
}

/** Tous les produits, y compris ceux retirés de la vente (administration). */
export async function listProductsForAdmin(db: Db): Promise<AdminProduct[]> {
  const result = await db.query<ProductRow & { order_count: number }>(
    `SELECT p.id, p.name, p.price_cdf, p.stock, p.image_url, p.created_at, p.archived_at,
            (SELECT count(DISTINCT i.order_id)::int FROM order_items i WHERE i.product_id = p.id) AS order_count
     FROM products p
     ORDER BY p.archived_at NULLS FIRST, p.created_at, p.name`,
  );
  return result.rows.map((row) => ({ ...toProduct(row), archived: row.archived_at != null, orderCount: row.order_count }));
}

/**
 * Supprimer un produit. Jamais commandé : il est effacé. Déjà commandé : il
 * est seulement retiré de la vente, pour garder intactes les commandes
 * passées (elles y font référence).
 */
export async function deleteProduct(db: Db, id: string): Promise<"deleted" | "archived"> {
  const removed = await db.query(
    "DELETE FROM products WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM order_items WHERE product_id = $1)",
    [id],
  );
  if (removed.rowCount) return "deleted";
  const archived = await db.query("UPDATE products SET archived_at = COALESCE(archived_at, now()) WHERE id = $1", [id]);
  if (!archived.rowCount) throw errors.productNotFound();
  return "archived";
}

/** Remettre en vente un produit retiré. */
export async function restoreProduct(db: Db, id: string): Promise<Product> {
  const result = await db.query<ProductRow>(`UPDATE products SET archived_at = NULL WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  const row = result.rows[0];
  if (!row) throw errors.productNotFound();
  return toProduct(row);
}

/** Un produit en vente (un produit retiré « n'existe plus » pour les clients). */
export async function getProduct(db: Db, id: string): Promise<Product> {
  const result = await db.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE id = $1 AND archived_at IS NULL`, [id]);
  const row = result.rows[0];
  if (!row) throw errors.productNotFound();
  return toProduct(row);
}
