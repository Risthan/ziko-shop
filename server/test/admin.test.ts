import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { SEED_PRODUCTS } from "../src/db/seed.js";
import { ADMIN_KEY, createTestDb, insertProduct, resetDb, startApp, stockOf } from "./helpers.js";

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

const admin = { "X-Admin-Key": ADMIN_KEY };

describe("Modifier un produit (administration)", () => {
  it("change le prix et le stock avec la clé ; refuse sans clé", async () => {
    const product = await insertProduct(db, { priceCdf: 75_000, stock: 5 });

    const refused = await request(server).patch(`/products/${product.id}`).send({ priceCdf: 1 });
    expect(refused.status).toBe(401);

    const res = await request(server).patch(`/products/${product.id}`).set(admin).send({ priceCdf: 80_000, stock: 20 });
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ priceCdf: 80_000, stock: 20 });
  });

  it("une commande déjà passée garde le prix du moment", async () => {
    const product = await insertProduct(db, { priceCdf: 75_000, stock: 5 });
    const order = await request(server).post("/orders").send({ productId: product.id, quantity: 2 });

    await request(server).patch(`/products/${product.id}`).set(admin).send({ priceCdf: 99_000 });

    const again = await request(server).get(`/orders/${order.body.order.id}`);
    expect(again.body.order).toMatchObject({ totalCdf: 150_000, items: [{ unitPriceCdf: 75_000 }] });
  });

  it.each([
    ["un prix négatif", { priceCdf: -5 }],
    ["un prix à virgule", { priceCdf: 10.5 }],
    ["un stock négatif", { stock: -1 }],
    ["aucune modification", {}],
  ])("refuse %s", async (_label, body) => {
    const product = await insertProduct(db);
    const res = await request(server).patch(`/products/${product.id}`).set(admin).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("répond 404 pour un produit introuvable", async () => {
    const res = await request(server).patch("/products/6f1c2f1e-0000-4000-8000-000000000000").set(admin).send({ stock: 3 });
    expect(res.status).toBe(404);
  });
});

describe("Espace administration", () => {
  it("vérifie la clé", async () => {
    expect((await request(server).get("/admin/session").set("X-Admin-Key", "mauvaise-cle-123456")).status).toBe(401);
    expect((await request(server).get("/admin/session").set(admin)).body).toEqual({ ok: true });
  });

  it("remet le stock des 9 pulls à l'état de départ, sans toucher aux autres produits", async () => {
    const first = SEED_PRODUCTS[0];
    const collection = await insertProduct(db, { name: first.name, stock: 1 });
    const other = await insertProduct(db, { name: "Édition limitée — Bleu", stock: 4 });

    expect((await request(server).post("/admin/reset-stock")).status).toBe(401);
    const res = await request(server).post("/admin/reset-stock").set(admin);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(await stockOf(db, collection.id)).toBe(first.stock);
    expect(await stockOf(db, other.id)).toBe(4);
  });

  it("donne les chiffres de la boutique et les dernières commandes", async () => {
    const product = await insertProduct(db, { priceCdf: 75_000, stock: 5 });
    const order = await request(server).post("/orders").send({ productId: product.id, quantity: 2 });
    await request(server).post(`/orders/${order.body.order.id}/pay`).send({ paymentId: "MM-ADMIN-0001" });

    const res = await request(server).get("/admin/summary").set(admin);

    expect(res.status).toBe(200);
    expect(res.body.totals).toEqual({ orders: 1, paid: 1, revenue: 150_000, customers: 0 });
    expect(res.body.recentOrders[0]).toMatchObject({ status: "payee", pieces: 2, customer: null });
  });

  it("sert la page /admin, non indexée, avec une politique de sécurité stricte", async () => {
    const redirect = await request(server).get("/admin");
    expect(redirect.status).toBe(301);
    const page = await request(server).get("/admin/");
    expect(page.status).toBe(200);
    expect(page.text).toContain("Espace administration");
    expect(page.headers["x-robots-tag"]).toBe("noindex, nofollow");
    expect(page.headers["content-security-policy"]).toContain("script-src 'self'");
  });
});
