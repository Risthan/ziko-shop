import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { createTestDb, insertProduct, resetDb, startApp, stockOf } from "./helpers.js";

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

describe("POST /orders", () => {
  it("crée une commande « en attente » avec un total calculé par le serveur", async () => {
    const product = await insertProduct(db, { priceCdf: 35_000, stock: 5 });

    const res = await request(server).post("/orders").send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      productId: product.id,
      quantity: 2,
      unitPriceCdf: 35_000,
      totalCdf: 70_000,
      status: "en_attente",
      paymentId: null,
    });
    // Le stock ne diminue qu'au paiement.
    expect(await stockOf(db, product.id)).toBe(5);
  });

  it("refuse la commande si le stock est insuffisant", async () => {
    const product = await insertProduct(db, { stock: 2 });

    const res = await request(server).post("/orders").send({ productId: product.id, quantity: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", details: { available: 2, requested: 3 } });
    const { rows } = await db.query("SELECT count(*)::int AS n FROM orders");
    expect(rows[0].n).toBe(0);
  });

  it("répond 404 si le produit n'existe pas", async () => {
    const res = await request(server)
      .post("/orders")
      .send({ productId: "6f1c2f1e-0000-4000-8000-000000000000", quantity: 1 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it.each([0, -1, 1.5, "2", 101])("refuse la quantité %s", async (quantity) => {
    const product = await insertProduct(db);
    const res = await request(server).post("/orders").send({ productId: product.id, quantity });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ne crée pas deux commandes quand la même requête est renvoyée (Idempotency-Key)", async () => {
    const product = await insertProduct(db);
    const send = () =>
      request(server).post("/orders").set("Idempotency-Key", "commande-abc-123").send({ productId: product.id, quantity: 1 });

    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(second.body.order.id).toBe(first.body.order.id);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM orders");
    expect(rows[0].n).toBe(1);
  });

  it("refuse de réutiliser une clé d'idempotence pour une commande différente", async () => {
    const product = await insertProduct(db);
    await request(server).post("/orders").set("Idempotency-Key", "commande-abc-123").send({ productId: product.id, quantity: 1 });

    const res = await request(server)
      .post("/orders")
      .set("Idempotency-Key", "commande-abc-123")
      .send({ productId: product.id, quantity: 2 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("GET /orders/:id", () => {
  it("renvoie la commande et son statut", async () => {
    const product = await insertProduct(db, { name: "Le Signature — Crème" });
    const created = await request(server).post("/orders").send({ productId: product.id, quantity: 1 });

    const res = await request(server).get(`/orders/${created.body.order.id}`);

    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "en_attente", product: { name: "Le Signature — Crème" } });
  });

  it.each(["6f1c2f1e-0000-4000-8000-000000000000", "pas-un-identifiant"])(
    "répond 404 « commande introuvable » pour %s",
    async (id) => {
      const res = await request(server).get(`/orders/${id}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatchObject({ code: "ORDER_NOT_FOUND", message: "Cette commande est introuvable." });
    },
  );
});
