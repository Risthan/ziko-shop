import type { Db } from "../db/pool.js";
import { errors } from "../http/errors.js";
import type { CreateProductInput } from "./products.schemas.js";

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
}

const COLUMNS = "id, name, price_cdf, stock, image_url, created_at";

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
         WHERE name ILIKE $1 ESCAPE '\\'
         ORDER BY created_at, name`,
        [`%${escapeLike(search)}%`],
      )
    : await db.query<ProductRow>(`SELECT ${COLUMNS} FROM products ORDER BY created_at, name`);
  return result.rows.map(toProduct);
}

export async function getProduct(db: Db, id: string): Promise<Product> {
  const result = await db.query<ProductRow>(`SELECT ${COLUMNS} FROM products WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) throw errors.productNotFound();
  return toProduct(row);
}
