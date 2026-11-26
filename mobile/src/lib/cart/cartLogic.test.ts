import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_LINES,
  MAX_PER_LINE,
  addLine,
  afterOrderPaid,
  cartCount,
  checkoutKeyFor,
  emptyCart,
  removeLine,
  setLineQuantity,
  type CartState,
} from "./cartLogic.ts";

describe("panier", () => {
  test("ajouter deux fois le même pull regroupe les quantités", () => {
    const lines = addLine(addLine([], "noir"), "noir", 2);
    assert.deepEqual(lines, [{ productId: "noir", quantity: 3 }]);
  });

  test("garde l'ordre d'ajout et compte toutes les pièces", () => {
    const lines = addLine(addLine(addLine([], "noir"), "creme", 2), "moka");
    assert.deepEqual(
      lines.map((line) => line.productId),
      ["noir", "creme", "moka"],
    );
    assert.equal(cartCount(lines), 4);
  });

  test("ne dépasse jamais le maximum par article ni le stock indiqué", () => {
    assert.equal(addLine([], "noir", 50)[0]!.quantity, MAX_PER_LINE);
    assert.equal(addLine([{ productId: "noir", quantity: 2 }], "noir", 5, 3)[0]!.quantity, 3);
    assert.equal(setLineQuantity([{ productId: "noir", quantity: 2 }], "noir", 99)[0]!.quantity, MAX_PER_LINE);
  });

  test("une quantité à zéro retire l'article", () => {
    const lines = setLineQuantity([{ productId: "noir", quantity: 2 }, { productId: "moka", quantity: 1 }], "noir", 0);
    assert.deepEqual(lines, [{ productId: "moka", quantity: 1 }]);
    assert.deepEqual(removeLine(lines, "moka"), []);
  });

  test("refuse un article de plus au-delà de la limite de l'API", () => {
    let lines = Array.from({ length: MAX_LINES }, (_, i) => ({ productId: `p${i}`, quantity: 1 }));
    lines = addLine(lines, "nouveau");
    assert.equal(lines.length, MAX_LINES);
  });
});

describe("passage en caisse", () => {
  const lines = [{ productId: "noir", quantity: 1 }, { productId: "creme", quantity: 2 }];
  let counter = 0;
  const newKey = () => `cle-${++counter}`;

  test("même panier renvoyé = même clé : le serveur ne crée pas deux commandes", () => {
    const first = checkoutKeyFor({ lines, checkout: null }, newKey);
    const state: CartState = { lines, checkout: { ...first, orderId: "commande-1" } };
    assert.equal(checkoutKeyFor(state, newKey).key, first.key);
  });

  test("panier modifié = nouvelle clé", () => {
    const first = checkoutKeyFor({ lines, checkout: null }, newKey);
    const changed: CartState = { lines: addLine(lines, "moka"), checkout: { ...first, orderId: "commande-1" } };
    assert.notEqual(checkoutKeyFor(changed, newKey).key, first.key);
  });

  test("le panier ne se vide qu'une fois SA commande payée", () => {
    const state: CartState = { lines, checkout: { key: "k", signature: "s", orderId: "commande-1" } };
    assert.equal(afterOrderPaid(state, "autre-commande"), state);
    assert.deepEqual(afterOrderPaid(state, "commande-1"), emptyCart);
  });
});
