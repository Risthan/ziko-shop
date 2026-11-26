import { describe, expect, it } from "vitest";
import { tryOnMode } from "../src/tryon/tryon.routes.js";

describe("Choix du mode d'essayage en direct", () => {
  it("préfère l'API Decart quand sa clé est configurée", () => {
    expect(tryOnMode("dct_cle", "boutique.example")).toBe("decart");
  });
  it("utilise le widget AnyWear quand seul son domaine est configuré", () => {
    expect(tryOnMode("", "boutique.example")).toBe("anywear");
  });
  it("est désactivé sans configuration", () => {
    expect(tryOnMode("", "")).toBe("off");
  });
});
