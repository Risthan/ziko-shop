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
  normalizeLines,
  removeLine,
  setLineQuantity,
  setLineSize,
  sizeConflict,
  type CartLine,
  type CartState,
} from "./cartLogic.ts";

const line = (productId: string, quantity: number, size: CartLine["size"] = "M"): CartLine => ({ productId, quantity, size });

describe("panier", () => {
  test("ajouter deux fois le même pull regroupe les quantités", () => {
    const lines = addLine(addLine([], "noir"), "noir", 2);
    assert.deepEqual(lines, [line("noir", 3)]);
  });

  test("garde l'ordre d'ajout et compte toutes les pièces", () => {
    const lines = addLine(addLine(addLine([], "noir"), "creme", 2), "moka");
    assert.deepEqual(
      lines.map((item) => item.productId),
      ["noir", "creme", "moka"],
    );
    assert.equal(cartCount(lines), 4);
  });

  test("ne dépasse jamais le maximum par article ni le stock indiqué", () => {
    assert.equal(addLine([], "noir", 50)[0]!.quantity, MAX_PER_LINE);
    assert.equal(addLine([line("noir", 2)], "noir", 5, 3)[0]!.quantity, 3);
    assert.equal(setLineQuantity([line("noir", 2)], "noir", 99)[0]!.quantity, MAX_PER_LINE);
  });

  test("une quantité à zéro retire l'article", () => {
    const lines = setLineQuantity([line("noir", 2), line("moka", 1)], "noir", 0);
    assert.deepEqual(lines, [line("moka", 1)]);
    assert.deepEqual(removeLine(lines, "moka"), []);
  });

  test("refuse un article de plus au-delà de la limite de l'API", () => {
    let lines = Array.from({ length: MAX_LINES }, (_, i) => line(`p${i}`, 1));
    lines = addLine(lines, "nouveau");
    assert.equal(lines.length, MAX_LINES);
  });
});

describe("tailles", () => {
  test("un pull ajouté garde la taille choisie (M par défaut)", () => {
    assert.equal(addLine([], "noir", 1, MAX_PER_LINE, "XL")[0]!.size, "XL");
    assert.equal(addLine([], "noir")[0]!.size, "M");
  });

  test("une couleur déjà au panier dans une autre taille n'est pas ajoutée : on le signale", () => {
    const lines = [line("noir", 1, "L")];
    assert.equal(sizeConflict(lines, "noir", "S"), "L");
    assert.equal(addLine(lines, "noir", 1, MAX_PER_LINE, "S"), lines);
    // Même taille, ou sans taille précisée (bouton « + ») : la quantité augmente.
    assert.equal(sizeConflict(lines, "noir", "L"), null);
    assert.equal(sizeConflict(lines, "noir"), null);
    assert.deepEqual(addLine(lines, "noir"), [line("noir", 2, "L")]);
  });

  test("la taille se change dans le panier", () => {
    assert.deepEqual(setLineSize([line("noir", 2, "M")], "noir", "XXL"), [line("noir", 2, "XXL")]);
  });

  test("un panier enregistré avant les tailles passe en M ; les lignes abîmées sont ignorées", () => {
    assert.deepEqual(normalizeLines([{ productId: "noir", quantity: 2 }, { productId: "rouge", quantity: 1, size: "S" }, null, { quantity: 1 }]), [
      line("noir", 2, "M"),
      line("rouge", 1, "S"),
    ]);
    assert.deepEqual(normalizeLines("pas un panier"), []);
  });
});

describe("passage en caisse", () => {
  const lines = [line("noir", 1), line("creme", 2)];
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

  test("taille changée = nouvelle clé (ce n'est plus la même commande)", () => {
    const first = checkoutKeyFor({ lines, checkout: null }, newKey);
    const resized: CartState = { lines: setLineSize(lines, "noir", "L"), checkout: { ...first, orderId: "commande-1" } };
    assert.notEqual(checkoutKeyFor(resized, newKey).key, first.key);
  });

  test("le panier ne se vide qu'une fois SA commande payée", () => {
    const state: CartState = { lines, checkout: { key: "k", signature: "s", orderId: "commande-1" } };
    assert.equal(afterOrderPaid(state, "autre-commande"), state);
    assert.deepEqual(afterOrderPaid(state, "commande-1"), emptyCart);
  });
});
