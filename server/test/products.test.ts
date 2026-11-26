import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { ADMIN_KEY, createTestDb, insertProduct, resetDb, startApp } from "./helpers.js";

let db: Db;
let server: Server;

beforeAll(async () => {
  db = await createTestDb();
});
afterAll(async () => {
  await db.end();
});
beforeEach(async () => {
  await resetDb(db);
  server = startApp(db);
});
afterEach(() => {
  server.close();
});

describe("POST /products", () => {
  it("crée un produit avec un prix entier en francs congolais", async () => {
    const res = await request(server)
      .post("/products")
      .set("X-Admin-Key", ADMIN_KEY)
      .send({ name: "L'Essentiel — Moka", priceCdf: 95_000, stock: 7 });

    expect(res.status).toBe(201);
    expect(res.body.product).toMatchObject({ name: "L'Essentiel — Moka", priceCdf: 95_000, stock: 7, imageUrl: null });
    expect(res.body.product.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("refuse la création sans clé d'administration", async () => {
    const res = await request(server).post("/products").send({ name: "Pirate", priceCdf: 1, stock: 1 });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it.each([
    ["un prix décimal", { name: "Pull", priceCdf: 35_000.5, stock: 1 }, "priceCdf"],
    ["un prix nul", { name: "Pull", priceCdf: 0, stock: 1 }, "priceCdf"],
    ["un prix en texte", { name: "Pull", priceCdf: "35000", stock: 1 }, "priceCdf"],
    ["un stock négatif", { name: "Pull", priceCdf: 35_000, stock: -1 }, "stock"],
    ["un nom vide", { name: " ", priceCdf: 35_000, stock: 1 }, "name"],
  ])("refuse %s avec un message clair", async (_label, body, field) => {
    const res = await request(server).post("/products").set("X-Admin-Key", ADMIN_KEY).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fields[0].path).toBe(field);
  });

  it("refuse un corps JSON mal formé", async () => {
    const res = await request(server)
      .post("/products")
      .set("X-Admin-Key", ADMIN_KEY)
      .set("Content-Type", "application/json")
      .send('{"name": "Pull",');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});

describe("GET /products", () => {
  it("liste les produits avec nom, prix et stock", async () => {
    await insertProduct(db, { name: "Le Classique — Noir", priceCdf: 75_000, stock: 12 });
    await insertProduct(db, { name: "Le Signature — Moka", priceCdf: 125_000, stock: 2 });

    const res = await request(server).get("/products");

    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0]).toMatchObject({ name: "Le Classique — Noir", priceCdf: 75_000, stock: 12 });
  });

  it("recherche par nom, sans tenir compte des majuscules", async () => {
    await insertProduct(db, { name: "Le Classique — Moka" });
    await insertProduct(db, { name: "L'Essentiel — Noir" });

    const res = await request(server).get("/products").query({ search: "MOKA" });

    expect(res.body.products.map((p: { name: string }) => p.name)).toEqual(["Le Classique — Moka"]);
  });

  it("traite % et _ comme du texte, pas comme des jokers", async () => {
    await insertProduct(db, { name: "Pull 100% coton" });
    await insertProduct(db, { name: "Pull laine" });

    const res = await request(server).get("/products").query({ search: "100%" });

    expect(res.body.products).toHaveLength(1);
  });

  it("répond 404 pour un produit inconnu", async () => {
    const res = await request(server).get("/products/6f1c2f1e-0000-4000-8000-000000000000");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });
});
