import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { SEED_PRODUCTS, seedIfEmpty } from "../src/db/seed.js";
import { createTestDb, resetDb } from "./helpers.js";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.end();
});
beforeEach(async () => {
  await resetDb(db);
});

const migration008 = () => readFile(new URL("../src/db/migrations/008_collection_15_pulls.sql", import.meta.url), "utf8");

async function catalog() {
  const { rows } = await db.query<{ id: string; name: string; image_url: string }>(
    "SELECT id, name, image_url FROM products ORDER BY created_at, name",
  );
  return rows;
}

describe("Collection de 15 pulls", () => {
  it("le seed remplit une boutique vide avec les 15 pulls, et chaque photo existe", async () => {
    expect(await seedIfEmpty(db)).toBe(15);
    expect(await seedIfEmpty(db)).toBe(0);

    const products = await catalog();
    expect(products).toHaveLength(15);
    for (const product of SEED_PRODUCTS) {
      expect(existsSync(new URL(`../public${product.imageUrl}`, import.meta.url)), product.imageUrl).toBe(true);
    }
  });

  it("la migration 008 met à jour une boutique déjà en ligne : nouvelles photos, mêmes produits, 6 couleurs en plus", async () => {
    const old = ["classique", "essentiel", "signature"].flatMap((model) =>
      ["noir", "creme", "moka"].map((color) => `/images/${model}-${color}-v3.jpg`),
    );
    for (const [index, imageUrl] of old.entries()) {
      await db.query("INSERT INTO products (name, price_cdf, stock, image_url) VALUES ($1, 75000, 5, $2)", [
        SEED_PRODUCTS.filter((product) => !/Bleu roi|Rouge/.test(product.name))[index]!.name,
        imageUrl,
      ]);
    }
    const before = await catalog();

    await db.query(await migration008());
    await db.query(await migration008()); // rejouée par erreur : aucun doublon

    const after = await catalog();
    expect(after).toHaveLength(15);
    expect(after.slice(0, 9).map((product) => product.id)).toEqual(before.map((product) => product.id));
    expect(after.every((product) => product.image_url.endsWith("-v4.jpg"))).toBe(true);
    expect(after.map((product) => product.name).sort()).toEqual(SEED_PRODUCTS.map((product) => product.name).sort());
  });

  it("sur une base vide, la migration 008 n'ajoute rien : c'est le seed qui s'en charge", async () => {
    await db.query(await migration008());
    expect(await catalog()).toHaveLength(0);
  });
});
