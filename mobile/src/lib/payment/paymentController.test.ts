/// <reference types="node" />
// Tests du paiement côté app : `npm test` (node --test, aucune dépendance).
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import type { Order, PayOrderResponse } from "../../api/types";
import { createPaymentController, type KeyValueStore } from "./paymentController.ts";

/** Stockage en mémoire qui survit à la « réouverture de l'app » (nouveau contrôleur). */
class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

const networkError = () => Object.assign(new Error("Impossible de joindre le serveur."), { kind: "network" });

/**
 * Faux serveur qui applique les mêmes règles que le vrai : un paiement par
 * commande, un identifiant par paiement, et le même identifiant renvoyé est
 * confirmé sans être compté deux fois.
 */
class FakeServer {
  order: Order = {
    id: "11111111-2222-4333-8444-555555555555",
    productId: "p1",
    product: { name: "L'Essentiel — Noir", imageUrl: null },
    quantity: 2,
    unitPriceCdf: 95_000,
    totalCdf: 190_000,
    status: "en_attente",
    paymentId: null,
    createdAt: "2026-11-26T10:00:00.000Z",
    paidAt: null,
  };
  calls: string[] = [];
  debits = 0;
  /** "before" : la connexion coupe avant l'arrivée au serveur. "after" : après l'enregistrement. */
  nextCut: "before" | "after" | null = null;
  delayMs = 0;

  async payOrder(orderId: string, paymentId: string, simulateLostResponse = false): Promise<PayOrderResponse> {
    this.calls.push(paymentId);
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    if (this.nextCut === "before") {
      this.nextCut = null;
      throw networkError();
    }
    assert.equal(orderId, this.order.id);
    let outcome: "processed" | "already_processed";
    if (this.order.status === "payee") {
      if (this.order.paymentId !== paymentId) {
        throw Object.assign(new Error("Cette commande est déjà payée."), { kind: "http", status: 409, code: "ORDER_ALREADY_PAID", details: { order: this.order } });
      }
      outcome = "already_processed";
    } else {
      this.debits += 1;
      this.order = { ...this.order, status: "payee", paymentId, paidAt: "2026-11-26T10:01:00.000Z" };
      outcome = "processed";
    }
    if (this.nextCut === "after" || simulateLostResponse) {
      this.nextCut = null;
      throw networkError();
    }
    return { order: this.order, payment: { id: paymentId, outcome, message: "" } };
  }

  async getOrder() {
    return this.order;
  }
}

let server: FakeServer;
let store: MemoryStore;
let ids: number;
const makeController = () => createPaymentController({ api: server, store, newPaymentId: () => `MM-test-${++ids}` });

beforeEach(() => {
  server = new FakeServer();
  store = new MemoryStore();
  ids = 0;
});

describe("Contrôleur de paiement de l'app", () => {
  test("enregistre l'identifiant de paiement sur le téléphone AVANT d'appeler le serveur", async () => {
    const controller = makeController();
    let storedAtCallTime: string | undefined;
    const pay = server.payOrder.bind(server);
    server.payOrder = async (orderId, paymentId, cut) => {
      storedAtCallTime = (await controller.getRecord(orderId))?.paymentId;
      return pay(orderId, paymentId, cut);
    };

    const result = await controller.pay(server.order.id);

    assert.equal(result.kind, "paid");
    assert.equal(storedAtCallTime, "MM-test-1");
  });

  test("paiement normal : la commande passe à « payée », un seul débit", async () => {
    const result = await makeController().pay(server.order.id);
    assert.equal(result.kind, "paid");
    assert.equal(result.kind === "paid" && result.alreadyRecorded, false);
    assert.equal(server.debits, 1);
  });

  test("coupure APRÈS l'enregistrement : la nouvelle tentative renvoie le même identifiant, aucun second débit", async () => {
    const controller = makeController();
    server.nextCut = "after";

    const first = await controller.pay(server.order.id);
    const retry = await controller.pay(server.order.id);

    assert.equal(first.kind, "uncertain");
    assert.equal(retry.kind, "paid");
    assert.equal(retry.kind === "paid" && retry.alreadyRecorded, true);
    assert.deepEqual(server.calls, ["MM-test-1", "MM-test-1"]);
    assert.equal(server.debits, 1);
  });

  test("coupure AVANT l'arrivée au serveur : la nouvelle tentative paie, avec le même identifiant", async () => {
    const controller = makeController();
    server.nextCut = "before";

    const first = await controller.pay(server.order.id);
    const retry = await controller.pay(server.order.id);

    assert.equal(first.kind, "uncertain");
    assert.equal(retry.kind === "paid" && retry.alreadyRecorded, false);
    assert.deepEqual(server.calls, ["MM-test-1", "MM-test-1"]);
    assert.equal(server.debits, 1);
  });

  test("réouverture de l'app après une coupure : l'identifiant enregistré est réutilisé", async () => {
    server.nextCut = "after";
    await makeController().pay(server.order.id);

    // L'app a été fermée : nouveau contrôleur, même stockage.
    const retry = await makeController().pay(server.order.id);

    assert.equal(retry.kind, "paid");
    assert.deepEqual(server.calls, ["MM-test-1", "MM-test-1"]);
    assert.equal(ids, 1, "aucun nouvel identifiant ne doit être créé");
    assert.equal(server.debits, 1);
  });

  test("double clic sur « Payer » : une seule requête part vers le serveur", async () => {
    server.delayMs = 30;
    const controller = makeController();

    const [a, b] = await Promise.all([controller.pay(server.order.id), controller.pay(server.order.id)]);

    assert.equal(server.calls.length, 1);
    assert.equal(a, b);
    assert.equal(server.debits, 1);
  });

  test("mode démo : seule la première tentative perd sa réponse", async () => {
    const controller = makeController();
    const first = await controller.pay(server.order.id, { simulateLostResponse: true });
    const retry = await controller.pay(server.order.id, { simulateLostResponse: true });
    assert.equal(first.kind, "uncertain");
    assert.equal(retry.kind, "paid");
    assert.equal(server.debits, 1);
  });

  test("commande déjà payée avec un autre identifiant : confirmée sans nouveau débit", async () => {
    server.order = { ...server.order, status: "payee", paymentId: "MM-autre-appareil" };
    const result = await makeController().pay(server.order.id);
    assert.equal(result.kind, "paid");
    assert.equal(result.kind === "paid" && result.paidElsewhere, true);
    assert.equal(server.debits, 0);
  });

  test("refus du serveur (stock épuisé) : l'identifiant est gardé pour un éventuel nouvel essai", async () => {
    const controller = makeController();
    server.payOrder = async (_orderId, paymentId) => {
      server.calls.push(paymentId);
      throw Object.assign(new Error("Stock insuffisant."), { kind: "http", status: 409, code: "INSUFFICIENT_STOCK" });
    };
    const first = await controller.pay(server.order.id);
    await controller.pay(server.order.id);
    assert.equal(first.kind, "refused");
    assert.deepEqual(server.calls, ["MM-test-1", "MM-test-1"]);
  });

  test("vérification du statut : le serveur fait foi, et une panne donne « inconnu »", async () => {
    const controller = makeController();
    assert.equal((await controller.checkStatus(server.order.id)).kind, "pending");
    await controller.pay(server.order.id);
    assert.equal((await controller.checkStatus(server.order.id)).kind, "paid");
    server.getOrder = async () => {
      throw networkError();
    };
    assert.equal((await controller.checkStatus(server.order.id)).kind, "unknown");
  });
});
