import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/pool.js";
import { tryOnMode } from "../src/tryon/tryon.routes.js";
import { ADMIN_KEY, createTestDb } from "./helpers.js";

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

describe("Page /essayage en mode widget AnyWear", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.end();
  });

  const app = () =>
    createApp(db, { NODE_ENV: "test", ADMIN_API_KEY: ADMIN_KEY, CORS_ORIGINS: "*", DECART_API_KEY: "", ANYWEAR_DOMAIN: "boutique.example" });

  it("transmet l'origine de la page : sans elle, AnyWear refuse d'afficher sa fenêtre", async () => {
    const res = await request(app()).get("/essayage/");
    expect(res.status).toBe(200);
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("n'autorise le script et la fenêtre tiers que depuis AnyWear", async () => {
    const res = await request(app()).get("/essayage/");
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src 'self' https://anywear.decart.ai");
    expect(csp).toContain("frame-src https://anywear.decart.ai");
    expect(res.headers["permissions-policy"]).toContain('camera=(self "https://anywear.decart.ai")');
  });

  it("indique le script du widget pour le domaine configuré", async () => {
    const res = await request(app()).get("/try-on/config");
    expect(res.body).toEqual({ mode: "anywear", widgetUrl: "https://anywear.decart.ai/widget/latest/anywear.js?domain=boutique.example" });
  });

  it("le reste de l'API garde la politique stricte « no-referrer »", async () => {
    const res = await request(app()).get("/health");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });
});
