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
      items: [{ productId: product.id, quantity: 2, unitPriceCdf: 35_000, lineTotalCdf: 70_000 }],
      itemCount: 2,
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

describe("POST /orders avec un panier (plusieurs articles)", () => {
  it("crée une seule commande avec toutes les lignes, dans l'ordre du panier", async () => {
    const noir = await insertProduct(db, { name: "Le Classique — Noir", priceCdf: 75_000, stock: 5 });
    const creme = await insertProduct(db, { name: "L'Essentiel — Crème", priceCdf: 95_000, stock: 5 });

    const res = await request(server)
      .post("/orders")
      .send({ items: [{ productId: creme.id, quantity: 1 }, { productId: noir.id, quantity: 2 }] });

    expect(res.status).toBe(201);
    expect(res.body.order).toMatchObject({
      items: [
        { productId: creme.id, quantity: 1, unitPriceCdf: 95_000, lineTotalCdf: 95_000, product: { name: "L'Essentiel — Crème" } },
        { productId: noir.id, quantity: 2, unitPriceCdf: 75_000, lineTotalCdf: 150_000 },
      ],
      itemCount: 3,
      totalCdf: 245_000,
      status: "en_attente",
    });
    expect(await stockOf(db, noir.id)).toBe(5);
  });

  it("refuse tout le panier si un seul article manque, et dit lequel", async () => {
    const noir = await insertProduct(db, { name: "Le Classique — Noir", stock: 5 });
    const moka = await insertProduct(db, { name: "Le Signature — Moka", stock: 1 });

    const res = await request(server)
      .post("/orders")
      .send({ items: [{ productId: noir.id, quantity: 1 }, { productId: moka.id, quantity: 2 }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: "INSUFFICIENT_STOCK",
      details: { available: 1, requested: 2, productId: moka.id, productName: "Le Signature — Moka" },
    });
    expect(res.body.error.message).toContain("Le Signature — Moka");
    const { rows } = await db.query("SELECT (SELECT count(*) FROM orders)::int AS orders, (SELECT count(*) FROM order_items)::int AS lines");
    expect(rows[0]).toEqual({ orders: 0, lines: 0 });
  });

  it.each([
    ["un panier vide", { items: [] }],
    ["le même produit deux fois", "doublon"],
    ["une quantité invalide dans une ligne", "quantite"],
  ])("refuse %s", async (_label, body) => {
    const product = await insertProduct(db);
    const payload =
      body === "doublon"
        ? { items: [{ productId: product.id, quantity: 1 }, { productId: product.id, quantity: 1 }] }
        : body === "quantite"
          ? { items: [{ productId: product.id, quantity: 0 }] }
          : body;
    const res = await request(server).post("/orders").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("répond 404 si un des produits du panier n'existe pas", async () => {
    const product = await insertProduct(db);
    const missing = "6f1c2f1e-0000-4000-8000-000000000000";
    const res = await request(server)
      .post("/orders")
      .send({ items: [{ productId: product.id, quantity: 1 }, { productId: missing, quantity: 1 }] });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "PRODUCT_NOT_FOUND", details: { productId: missing } });
  });

  it("la clé d'idempotence protège aussi un panier renvoyé", async () => {
    const a = await insertProduct(db, { name: "Le Classique — Noir" });
    const b = await insertProduct(db, { name: "Le Classique — Crème" });
    const cart = { items: [{ productId: a.id, quantity: 1 }, { productId: b.id, quantity: 3 }] };
    const send = () => request(server).post("/orders").set("Idempotency-Key", "panier-abc-123").send(cart);

    const [first, second] = await Promise.all([send(), send()]);

    expect(second.body.order.id).toBe(first.body.order.id);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    const { rows } = await db.query("SELECT count(*)::int AS n FROM orders");
    expect(rows[0].n).toBe(1);
  });
});

describe("Tailles (S à XXL)", () => {
  it("enregistre la taille de chaque article et la renvoie", async () => {
    const noir = await insertProduct(db, { name: "Le Classique — Noir", stock: 5 });
    const rouge = await insertProduct(db, { name: "L'Essentiel — Rouge", stock: 5 });

    const res = await request(server)
      .post("/orders")
      .send({ items: [{ productId: noir.id, quantity: 1, size: "L" }, { productId: rouge.id, quantity: 2, size: "XXL" }] });

    expect(res.status).toBe(201);
    expect(res.body.order.items).toMatchObject([
      { productId: noir.id, size: "L" },
      { productId: rouge.id, size: "XXL" },
    ]);
    const again = await request(server).get(`/orders/${res.body.order.id}`);
    expect(again.body.order.items.map((item: { size: string }) => item.size)).toEqual(["L", "XXL"]);
  });

  it("une commande sans taille (format de l'énoncé) reste valide : taille null", async () => {
    const product = await insertProduct(db);
    const res = await request(server).post("/orders").send({ productId: product.id, quantity: 1 });
    expect(res.status).toBe(201);
    expect(res.body.order.items[0].size).toBeNull();
  });

  it("refuse une taille inconnue", async () => {
    const product = await insertProduct(db);
    const res = await request(server).post("/orders").send({ productId: product.id, quantity: 1, size: "XXXL" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(res.body.error.message).toContain("S, M, L, XL, XXL");
  });

  it("la même clé d'idempotence avec une autre taille est refusée (ce n'est pas la même commande)", async () => {
    const product = await insertProduct(db);
    const send = (size: string) =>
      request(server).post("/orders").set("Idempotency-Key", "taille-abc-123").send({ productId: product.id, quantity: 1, size });

    expect((await send("M")).status).toBe(201);
    expect((await send("M")).status).toBe(200);
    const other = await send("L");
    expect(other.status).toBe(422);
    expect(other.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});

describe("GET /orders/:id", () => {
  it("renvoie la commande et son statut", async () => {
    const product = await insertProduct(db, { name: "Le Signature — Crème" });
    const created = await request(server).post("/orders").send({ productId: product.id, quantity: 1 });

    const res = await request(server).get(`/orders/${created.body.order.id}`);

    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "en_attente", items: [{ product: { name: "Le Signature — Crème" } }] });
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
