/// <reference types="node" />
// Tests rapides, sans dépendance : `npm test` (node --test).
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCdf, normalize, splitProductName, stockLabel } from "./format.ts";

const NBSP = " ";

test("formatCdf affiche les francs congolais au format « 35 000 FC »", () => {
  assert.equal(formatCdf(35_000), `35${NBSP}000${NBSP}FC`);
  assert.equal(formatCdf(125_000), `125${NBSP}000${NBSP}FC`);
  assert.equal(formatCdf(1_250_000), `1${NBSP}250${NBSP}000${NBSP}FC`);
  assert.equal(formatCdf(950), `950${NBSP}FC`);
  assert.equal(formatCdf(0), `0${NBSP}FC`);
});

test("splitProductName sépare le modèle et la couleur", () => {
  assert.deepEqual(splitProductName("Le Classique — Noir"), { model: "Le Classique", color: "Noir" });
  assert.deepEqual(splitProductName("Bonnet"), { model: "Bonnet", color: null });
});

test("normalize ignore les accents et la casse", () => {
  assert.equal(normalize("  Crème "), "creme");
});

test("stockLabel prévient quand il reste peu de pièces", () => {
  assert.equal(stockLabel(0), "Épuisé");
  assert.equal(stockLabel(2), "Plus que 2 en stock");
  assert.equal(stockLabel(12), "12 en stock");
});
