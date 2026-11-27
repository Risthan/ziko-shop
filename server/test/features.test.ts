import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { createTestDb, resetDb, startApp } from "./helpers.js";

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
  server = startApp(db); // sans clé iKawn
});
afterEach(() => {
  server.close();
});

describe("Santé et fonctionnalités", () => {
  it("GET /health répond ok quand la base est joignable", async () => {
    const res = await request(server).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /features indique que l'essayage en direct est désactivé sans clé iKawn", async () => {
    const res = await request(server).get("/features");
    expect(res.body).toEqual({ liveTryOn: false });
  });

  it("POST /try-on/session refuse proprement quand l'essayage n'est pas configuré", async () => {
    const res = await request(server).post("/try-on/session").set("Idempotency-Key", "cle-essai-0001");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("FEATURE_DISABLED");
  });

  it("GET /try-on/config indique que l'essayage est désactivé", async () => {
    const res = await request(server).get("/try-on/config");
    expect(res.body.mode).toBe("off");
  });

  it("une route inconnue renvoie une erreur JSON 404", async () => {
    const res = await request(server).get("/nexiste-pas");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("n'expose pas d'en-tête X-Powered-By", async () => {
    const res = await request(server).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});
