import type { Server } from "node:http";
import { inject } from "vitest";
import { createApp } from "../src/app.js";
import { runMigrations } from "../src/db/migrate.js";
import { createPool, type Db } from "../src/db/pool.js";

export const ADMIN_KEY = "cle-admin-de-test-123456";

export async function createTestDb(): Promise<Db> {
  const db = createPool(inject("databaseUrl"));
  await runMigrations(db);
  return db;
}

export async function resetDb(db: Db): Promise<void> {
  await db.query("TRUNCATE payments, orders, products, users RESTART IDENTITY CASCADE");
}

/** Une app neuve à chaque test : les compteurs de limite de débit repartent de zéro. */
export function startApp(db: Db): Server {
  const app = createApp(db, {
    NODE_ENV: "test",
    ADMIN_API_KEY: ADMIN_KEY,
    CORS_ORIGINS: "*",
    IKAWN_API_KEY: "",
  });
  return app.listen(0);
}

export async function insertProduct(
  db: Db,
  overrides: Partial<{ name: string; priceCdf: number; stock: number }> = {},
): Promise<{ id: string; priceCdf: number; stock: number }> {
  const product = { name: "Le Classique — Noir", priceCdf: 35_000, stock: 10, ...overrides };
  const { rows } = await db.query<{ id: string }>(
    "INSERT INTO products (name, price_cdf, stock) VALUES ($1, $2, $3) RETURNING id",
    [product.name, product.priceCdf, product.stock],
  );
  return { id: rows[0]!.id, priceCdf: product.priceCdf, stock: product.stock };
}

export async function stockOf(db: Db, productId: string): Promise<number> {
  const { rows } = await db.query<{ stock: number }>("SELECT stock FROM products WHERE id = $1", [productId]);
  return rows[0]!.stock;
}

export async function paymentCount(db: Db): Promise<number> {
  const { rows } = await db.query<{ count: string }>("SELECT count(*) FROM payments");
  return Number(rows[0]!.count);
}
