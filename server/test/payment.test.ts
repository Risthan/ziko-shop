import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { createTestDb, insertProduct, paymentCount, resetDb, startApp, stockOf } from "./helpers.js";

/**
 * LE point le plus important du sujet : un client ne paie jamais deux fois.
 * Chaque test vérifie le résultat HTTP ET l'état réel de la base (stock,
 * nombre de paiements), car c'est la base qui fait foi.
 */

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

async function createOrder(productId: string, quantity = 1): Promise<string> {
  const res = await request(server).post("/orders").send({ productId, quantity });
  expect(res.status).toBe(201);
  return res.body.order.id as string;
}

const pay = (orderId: string, paymentId: string) => request(server).post(`/orders/${orderId}/pay`).send({ paymentId });

describe("POST /orders/:id/pay", () => {
  it("passe la commande à « payée » et diminue le stock", async () => {
    const product = await insertProduct(db, { priceCdf: 35_000, stock: 5 });
    const orderId = await createOrder(product.id, 2);

    const res = await pay(orderId, "MM-2026-000001");

    expect(res.status).toBe(200);
    expect(res.body.payment).toMatchObject({ id: "MM-2026-000001", outcome: "processed" });
    expect(res.body.order).toMatchObject({ status: "payee", paymentId: "MM-2026-000001", totalCdf: 70_000 });
    expect(res.body.order.paidAt).not.toBeNull();
    expect(await stockOf(db, product.id)).toBe(3);
  });

  it("le même paiement renvoyé (réseau coupé) est confirmé sans débit ni décompte en plus", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const orderId = await createOrder(product.id, 2);
    await pay(orderId, "MM-2026-000001");

    const retry = await pay(orderId, "MM-2026-000001");

    expect(retry.status).toBe(200);
    expect(retry.headers["idempotent-replayed"]).toBe("true");
    expect(retry.body.payment.outcome).toBe("already_processed");
    expect(retry.body.order.status).toBe("payee");
    expect(await stockOf(db, product.id)).toBe(3); // pas 1
    expect(await paymentCount(db)).toBe(1);
  });

  it("refuse un second paiement (autre identifiant) sur une commande déjà payée", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const orderId = await createOrder(product.id, 1);
    await pay(orderId, "MM-2026-000001");

    const res = await pay(orderId, "MM-2026-000002");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ORDER_ALREADY_PAID");
    expect(res.body.error.details.order.paymentId).toBe("MM-2026-000001");
    expect(await stockOf(db, product.id)).toBe(4);
    expect(await paymentCount(db)).toBe(1);
  });

  it("refuse un identifiant de paiement déjà utilisé pour une autre commande", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const firstOrder = await createOrder(product.id, 1);
    const secondOrder = await createOrder(product.id, 1);
    await pay(firstOrder, "MM-2026-000001");

    const res = await pay(secondOrder, "MM-2026-000001");

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("PAYMENT_ID_ALREADY_USED");
    const second = await request(server).get(`/orders/${secondOrder}`);
    expect(second.body.order.status).toBe("en_attente");
    expect(await stockOf(db, product.id)).toBe(4);
  });

  it("10 envois simultanés du même paiement : un seul est enregistré", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const orderId = await createOrder(product.id, 2);

    const responses = await Promise.all(Array.from({ length: 10 }, () => pay(orderId, "MM-2026-000001")));

    expect(responses.every((res) => res.status === 200)).toBe(true);
    const outcomes = responses.map((res) => res.body.payment.outcome);
    expect(outcomes.filter((outcome) => outcome === "processed")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome === "already_processed")).toHaveLength(9);
    expect(await stockOf(db, product.id)).toBe(3);
    expect(await paymentCount(db)).toBe(1);
  });

  it("des paiements simultanés avec des identifiants différents : un seul passe", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const orderId = await createOrder(product.id, 1);

    const responses = await Promise.all(
      Array.from({ length: 5 }, (_, i) => pay(orderId, `MM-2026-00000${i}`)),
    );

    expect(responses.filter((res) => res.status === 200)).toHaveLength(1);
    expect(responses.filter((res) => res.body.error?.code === "ORDER_ALREADY_PAID")).toHaveLength(4);
    expect(await stockOf(db, product.id)).toBe(4);
    expect(await paymentCount(db)).toBe(1);
  });

  it("deux clients pour la dernière pièce : un seul paie, le stock ne devient jamais négatif", async () => {
    const product = await insertProduct(db, { stock: 1 });
    const orderA = await createOrder(product.id, 1);
    const orderB = await createOrder(product.id, 1); // acceptée : le stock n'est pas réservé

    const [resA, resB] = await Promise.all([pay(orderA, "MM-CLIENT-A-01"), pay(orderB, "MM-CLIENT-B-01")]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
    const refused = resA.status === 409 ? resA : resB;
    expect(refused.body.error.code).toBe("INSUFFICIENT_STOCK");
    expect(await stockOf(db, product.id)).toBe(0);
    expect(await paymentCount(db)).toBe(1);
  });

  it("répond 404 pour une commande introuvable, sans rien enregistrer", async () => {
    const res = await pay("6f1c2f1e-0000-4000-8000-000000000000", "MM-2026-000001");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORDER_NOT_FOUND");
    expect(await paymentCount(db)).toBe(0);
  });

  it.each(["", "court", "avec des espaces 123", "x".repeat(65)])("refuse l'identifiant de paiement « %s »", async (paymentId) => {
    const product = await insertProduct(db);
    const orderId = await createOrder(product.id);
    const res = await pay(orderId, paymentId);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Paiement d'un panier (plusieurs articles)", () => {
  async function createCart(items: { productId: string; quantity: number }[]): Promise<string> {
    const res = await request(server).post("/orders").send({ items });
    expect(res.status).toBe(201);
    return res.body.order.id as string;
  }

  it("un seul paiement décompte le stock de chaque article", async () => {
    const a = await insertProduct(db, { name: "Le Classique — Noir", priceCdf: 75_000, stock: 5 });
    const b = await insertProduct(db, { name: "Le Signature — Moka", priceCdf: 125_000, stock: 4 });
    const orderId = await createCart([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);

    const res = await pay(orderId, "MM-PANIER-0001");

    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ status: "payee", totalCdf: 275_000, itemCount: 3 });
    expect(await stockOf(db, a.id)).toBe(3);
    expect(await stockOf(db, b.id)).toBe(3);
    const { rows } = await db.query("SELECT amount_cdf FROM payments WHERE id = 'MM-PANIER-0001'");
    expect(rows[0].amount_cdf).toBe(275_000);
  });

  it("tout ou rien : si un article est épuisé entre-temps, aucun stock ne bouge et rien n'est payé", async () => {
    const a = await insertProduct(db, { name: "Le Classique — Noir", stock: 5 });
    const b = await insertProduct(db, { name: "Le Signature — Moka", stock: 1 });
    const cart = await createCart([
      { productId: a.id, quantity: 2 },
      { productId: b.id, quantity: 1 },
    ]);
    // Un autre client achète la dernière pièce de b avant notre paiement.
    await pay(await createOrder(b.id, 1), "MM-AUTRE-CLIENT");

    const res = await pay(cart, "MM-PANIER-0002");

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: "INSUFFICIENT_STOCK", details: { productName: "Le Signature — Moka" } });
    expect(await stockOf(db, a.id)).toBe(5); // inchangé
    expect(await paymentCount(db)).toBe(1); // seulement celui de l'autre client
    const order = await request(server).get(`/orders/${cart}`);
    expect(order.body.order.status).toBe("en_attente");
  });

  it("10 envois simultanés du même paiement de panier : un seul débit", async () => {
    const a = await insertProduct(db, { name: "Le Classique — Noir", stock: 10 });
    const b = await insertProduct(db, { name: "L'Essentiel — Crème", stock: 10 });
    const orderId = await createCart([
      { productId: a.id, quantity: 1 },
      { productId: b.id, quantity: 2 },
    ]);

    const responses = await Promise.all(Array.from({ length: 10 }, () => pay(orderId, "MM-PANIER-0003")));

    expect(responses.filter((res) => res.body.payment?.outcome === "processed")).toHaveLength(1);
    expect(responses.filter((res) => res.body.payment?.outcome === "already_processed")).toHaveLength(9);
    expect(await stockOf(db, a.id)).toBe(9);
    expect(await stockOf(db, b.id)).toBe(8);
    expect(await paymentCount(db)).toBe(1);
  });

  it("deux paniers qui partagent les mêmes produits, payés en même temps : pas de blocage, stock juste", async () => {
    const a = await insertProduct(db, { name: "Le Classique — Noir", stock: 10 });
    const b = await insertProduct(db, { name: "L'Essentiel — Crème", stock: 10 });
    // Ordres inverses dans les deux paniers : sans verrouillage ordonné, risque d'interblocage.
    const first = await createCart([
      { productId: a.id, quantity: 1 },
      { productId: b.id, quantity: 1 },
    ]);
    const second = await createCart([
      { productId: b.id, quantity: 2 },
      { productId: a.id, quantity: 2 },
    ]);

    const [resA, resB] = await Promise.all([pay(first, "MM-PANIER-A-01"), pay(second, "MM-PANIER-B-01")]);

    expect([resA.status, resB.status]).toEqual([200, 200]);
    expect(await stockOf(db, a.id)).toBe(7);
    expect(await stockOf(db, b.id)).toBe(7);
    expect(await paymentCount(db)).toBe(2);
  });
});
