/// <reference types="node" />
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "../api/types";
import { groupByModel, sortCatalog, variantsOf } from "./catalog.ts";
import { swatchFor } from "./swatches.ts";

const product = (name: string, index: number): Product => ({
  id: `p${index}`,
  name,
  priceCdf: 75_000,
  stock: 5,
  imageUrl: null,
  createdAt: `2026-11-27T10:00:0${index % 10}Z`,
});

// L'ordre de l'API en ligne : les 9 premiers pulls, puis les couleurs ajoutées ensuite.
const api = [
  "Le Classique — Noir",
  "Le Classique — Crème",
  "Le Classique — Moka",
  "L'Essentiel — Noir",
  "L'Essentiel — Crème",
  "L'Essentiel — Moka",
  "Le Signature — Noir",
  "Le Signature — Crème",
  "Le Signature — Moka",
  "Le Classique — Bleu roi",
  "Le Classique — Rouge",
  "L'Essentiel — Bleu roi",
  "L'Essentiel — Rouge",
  "Le Signature — Bleu roi",
  "Le Signature — Rouge",
].map(product);

test("le catalogue est rangé par modèle, et les couleurs toujours dans le même ordre", () => {
  const names = sortCatalog(api).map((item) => item.name);
  assert.deepEqual(names.slice(0, 5), [
    "Le Classique — Noir",
    "Le Classique — Crème",
    "Le Classique — Moka",
    "Le Classique — Bleu roi",
    "Le Classique — Rouge",
  ]);
  assert.equal(names[5], "L'Essentiel — Noir");
  assert.equal(names[10], "Le Signature — Noir");
  assert.equal(names[14], "Le Signature — Rouge");
});

test("les groupes suivent l'ordre de la boutique ; un modèle ajouté plus tard passe après", () => {
  const groups = groupByModel([product("Le Nouveau — Vert", 20), ...api.slice().reverse()]);
  assert.deepEqual(
    groups.map((group) => group.model),
    ["Le Classique", "L'Essentiel", "Le Signature", "Le Nouveau"],
  );
  assert.deepEqual(
    groups[1]!.variants.map((variant) => variant.name.split(" — ")[1]),
    ["Noir", "Crème", "Moka", "Bleu roi", "Rouge"],
  );
});

test("les variantes d'un pull sont ses 5 couleurs, dans l'ordre", () => {
  const rouge = api.find((item) => item.name === "Le Signature — Rouge")!;
  assert.deepEqual(
    variantsOf(api, rouge).map((variant) => variant.name),
    ["Le Signature — Noir", "Le Signature — Crème", "Le Signature — Moka", "Le Signature — Bleu roi", "Le Signature — Rouge"],
  );
});

test("chaque couleur a sa vraie pastille (plus de pastille grise par défaut)", () => {
  for (const color of ["Noir", "Crème", "Moka", "Bleu roi", "Rouge"]) assert.ok(swatchFor(color), color);
  assert.equal(swatchFor("creme"), swatchFor("Crème"));
  assert.equal(swatchFor("Bleu ciel"), swatchFor("Bleu")); // repli sur le premier mot
  assert.equal(swatchFor("Arc-en-ciel"), null);
});
