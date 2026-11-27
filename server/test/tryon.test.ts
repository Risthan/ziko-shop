import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/pool.js";
import { MAX_SESSION_SECONDS, createFalToken, tryOnMode, tryOnRouter } from "../src/tryon/tryon.routes.js";
import { ADMIN_KEY, createTestDb } from "./helpers.js";

/** Faux Fal : enregistre l'appel et renvoie un jeton (ou une erreur). */
function fakeFal(status = 200, body: unknown = "jeton-temporaire-123") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

describe("Essayage en direct via Fal.ai", () => {
  it("est actif seulement si la clé Fal est configurée", () => {
    expect(tryOnMode("fal_cle")).toBe("fal");
    expect(tryOnMode("")).toBe("off");
  });

  it("demande à Fal un jeton court, limité au modèle d'essayage, avec la clé côté serveur", async () => {
    const fal = fakeFal();
    const token = await createFalToken("cle-secrete", fal.fetchImpl);

    expect(token).toBe("jeton-temporaire-123");
    expect(fal.calls).toHaveLength(1);
    expect(fal.calls[0]!.url).toBe("https://rest.fal.ai/tokens/");
    expect((fal.calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Key cle-secrete");
    expect(JSON.parse(fal.calls[0]!.init.body as string)).toEqual({ allowed_apps: ["lucy2-vton"], token_expiration: 120 });
  });

  it("renvoie le jeton en texte brut à la page, jamais la clé", async () => {
    const fal = fakeFal();
    const app = express().use(tryOnRouter("cle-secrete", fal.fetchImpl));

    const res = await request(app).post("/try-on/token");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.text).toBe("jeton-temporaire-123");
    expect(res.text).not.toContain("cle-secrete");
  });

  it("limite chaque séance à 30 secondes (maîtrise des crédits Fal)", async () => {
    const app = express().use(tryOnRouter("cle-secrete", fakeFal().fetchImpl));
    const res = await request(app).get("/try-on/config");
    expect(res.body).toEqual({ mode: "fal", maxSessionSeconds: MAX_SESSION_SECONDS });
    expect(MAX_SESSION_SECONDS).toBe(30);
  });
});

describe("Essayage : erreurs et sécurité de la page", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.end();
  });

  const app = (falKey = "") => createApp(db, { NODE_ENV: "test", ADMIN_API_KEY: ADMIN_KEY, CORS_ORIGINS: "*", FAL_KEY: falKey });

  it("sans clé Fal : essayage désactivé, avec un message clair", async () => {
    const config = await request(app()).get("/try-on/config");
    expect(config.body).toEqual({ mode: "off" });

    const token = await request(app()).post("/try-on/token");
    expect(token.status).toBe(503);
    expect(token.body.error.code).toBe("FEATURE_DISABLED");
  });

  it("si Fal refuse, l'API répond 502 sans détail interne", async () => {
    const fal = fakeFal(401, { detail: "Invalid key" });
    const mini = express().use(tryOnRouter("mauvaise-cle", fal.fetchImpl));
    mini.use((error: { status?: number; code?: string; message: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(error.status ?? 500).json({ error: { code: error.code, message: error.message } });
    });

    const res = await request(mini).post("/try-on/token");

    expect(res.status).toBe(502);
    expect(res.body.error).toEqual({ code: "UPSTREAM_ERROR", message: "Le service d'essayage est momentanément indisponible." });
  });

  it("la page n'autorise que notre script et le WebSocket de Fal, et la caméra pour elle seule", async () => {
    const res = await request(app("cle")).get("/essayage/");
    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self' wss://fal.run https://fal.run");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("anywear");
    expect(res.headers["permissions-policy"]).toBe("camera=(self), microphone=()");
  });

  it("la page est revalidée à chaque ouverture : une mise à jour arrive tout de suite dans l'app", async () => {
    const res = await request(app()).get("/essayage/");
    expect(res.headers["cache-control"]).toBe("public, max-age=0");
    expect(res.headers.etag).toBeDefined();
  });

  it("l'API garde la politique stricte « no-referrer »", async () => {
    const res = await request(app()).get("/health");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
  });
});
