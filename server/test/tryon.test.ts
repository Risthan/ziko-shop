import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/pool.js";
import { errorHandler } from "../src/http/middleware.js";
import { MAX_SESSION_SECONDS, tryOnMode, tryOnRouter } from "../src/tryon/tryon.routes.js";
import { ADMIN_KEY, createTestDb } from "./helpers.js";

const SESSION = { id: "ses_123", status: "allocating", session_token: "jeton-de-seance", api_base_url: "https://api.ikawn.com/v1" };

/** Faux iKawn : enregistre chaque appel et répond comme le service. */
function fakeIkawn(status = 201, body: unknown = SESSION) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

/** Une mini-app avec le routeur d'essayage et notre gestionnaire d'erreurs. */
function appWith(apiKey: string, fake: ReturnType<typeof fakeIkawn>, serverEndDelayMs?: number) {
  return express()
    .use(tryOnRouter(apiKey, { fetchImpl: fake.fetchImpl, serverEndDelayMs }))
    .use(errorHandler);
}

const KEY = "cle-idempotence-0001";

describe("Essayage en direct via iKawn Mirror", () => {
  it("est actif seulement si la clé iKawn est configurée", () => {
    expect(tryOnMode("ik_cle")).toBe("ikawn");
    expect(tryOnMode("")).toBe("off");
  });

  it("indique la durée maximale d'une séance (30 secondes)", async () => {
    const res = await request(appWith("ik_cle", fakeIkawn())).get("/try-on/config");
    expect(res.body).toEqual({ mode: "ikawn", maxSessionSeconds: 30 });
    expect(MAX_SESSION_SECONDS).toBe(30);
  });

  it("crée la séance chez iKawn avec la clé côté serveur, la capacité « tryon » et la clé d'idempotence", async () => {
    const fake = fakeIkawn();
    const res = await request(appWith("cle-secrete", fake)).post("/try-on/session").set("Idempotency-Key", KEY).send({ capability: "video_edit" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(SESSION);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(JSON.stringify(res.body)).not.toContain("cle-secrete");

    const call = fake.calls[0]!;
    expect(call.url).toBe("https://api.ikawn.com/v1/sessions");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer cle-secrete");
    expect(headers["Idempotency-Key"]).toBe(KEY);
    // Le navigateur ne choisit pas la capacité : toujours « tryon », et rien d'autre dans le corps.
    expect(JSON.parse(call.init.body as string)).toEqual({ capability: "tryon" });
  });

  it("exige une clé d'idempotence valide", async () => {
    const fake = fakeIkawn();
    const res = await request(appWith("cle", fake)).post("/try-on/session").send({});
    expect(res.status).toBe(400);
    expect(fake.calls).toHaveLength(0);
  });

  it("termine lui-même la séance chez iKawn après la durée maximale (filet de sécurité)", async () => {
    const fake = fakeIkawn();
    await request(appWith("cle", fake, 20)).post("/try-on/session").set("Idempotency-Key", KEY);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const end = fake.calls.find((call) => call.url.endsWith("/end"));
    expect(end?.url).toBe("https://api.ikawn.com/v1/sessions/ses_123/end");
    expect(end?.init.method).toBe("POST");
  });

  it.each([
    [402, 503, "TRYON_UNAVAILABLE"],
    [429, 429, "TRYON_BUSY"],
    [409, 429, "TRYON_BUSY"],
    [503, 502, "UPSTREAM_ERROR"],
  ])("iKawn répond %s : l'API répond %s (%s), avec un message clair", async (upstream, status, code) => {
    const fake = fakeIkawn(upstream, { error: { code: "x", message: "détail interne", request_id: "req_1" } });
    const res = await request(appWith("cle", fake)).post("/try-on/session").set("Idempotency-Key", KEY);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.message).not.toContain("détail interne");
  });
});

describe("Essayage : configuration et sécurité de la page", () => {
  let db: Db;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.end();
  });

  const app = (ikawnKey = "") => createApp(db, { NODE_ENV: "test", ADMIN_API_KEY: ADMIN_KEY, CORS_ORIGINS: "*", IKAWN_API_KEY: ikawnKey });

  it("sans clé iKawn : essayage désactivé, avec un message clair", async () => {
    expect((await request(app()).get("/try-on/config")).body).toEqual({ mode: "off" });
    const res = await request(app()).post("/try-on/session").set("Idempotency-Key", KEY);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("FEATURE_DISABLED");
  });

  it("la page n'autorise que notre script et le SDK iKawn, et la caméra pour elle seule", async () => {
    const res = await request(app("cle")).get("/essayage/");
    expect(res.status).toBe(200);
    const csp = res.headers["content-security-policy"] as string;
    expect(csp).toContain("script-src 'self' https://api.ikawn.com 'wasm-unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/fal\.run|anywear|decart/);
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
