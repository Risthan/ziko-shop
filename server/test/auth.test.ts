import type { Server } from "node:http";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db/pool.js";
import { createTestDb, insertProduct, resetDb, startApp, stockOf } from "./helpers.js";

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
  server = startApp(db);
});
afterEach(() => {
  server.close();
});

const awa = { fullName: "Awa Mbuyi", email: "Awa.Mbuyi@Example.com", password: "motdepasse-solide", phone: "+243 81 234 5678" };

async function signUp(person = awa): Promise<string> {
  const res = await request(server).post("/auth/register").send(person);
  expect(res.status).toBe(201);
  return res.body.token as string;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Inscription et connexion", () => {
  it("crée le compte, renvoie le profil et une session, sans jamais renvoyer le mot de passe", async () => {
    const res = await request(server).post("/auth/register").send(awa);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ fullName: "Awa Mbuyi", email: "awa.mbuyi@example.com", phone: "+243 81 234 5678" });
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(JSON.stringify(res.body)).not.toContain("motdepasse");
    const { rows } = await db.query("SELECT password_hash FROM users");
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
  });

  it("refuse une seconde inscription avec la même adresse (même en majuscules)", async () => {
    await signUp();
    const res = await request(server).post("/auth/register").send({ ...awa, email: "AWA.MBUYI@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_USED");
  });

  it.each([
    ["un e-mail invalide", { ...awa, email: "awa@" }],
    ["un mot de passe trop court", { ...awa, password: "court" }],
    ["un nom vide", { ...awa, fullName: " " }],
    ["un téléphone invalide", { ...awa, phone: "abc" }],
  ])("refuse %s", async (_label, body) => {
    const res = await request(server).post("/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("se connecte avec le bon mot de passe ; un mauvais mot de passe ou une adresse inconnue donnent le même message", async () => {
    await signUp();

    const ok = await request(server).post("/auth/login").send({ email: "awa.mbuyi@example.com", password: awa.password });
    const wrong = await request(server).post("/auth/login").send({ email: "awa.mbuyi@example.com", password: "mauvais-mot-de-passe" });
    const unknown = await request(server).post("/auth/login").send({ email: "personne@example.com", password: awa.password });

    expect(ok.status).toBe(200);
    expect(ok.body.user.fullName).toBe("Awa Mbuyi");
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.body.error.code).toBe("INVALID_CREDENTIALS");
  });
});

describe("Session et profil", () => {
  it("GET /me exige une session valide", async () => {
    const token = await signUp();

    expect((await request(server).get("/me")).body.error.code).toBe("AUTH_REQUIRED");
    expect((await request(server).get("/me").set(auth("jeton-invalide-0123456789abcdef"))).body.error.code).toBe("SESSION_EXPIRED");
    const me = await request(server).get("/me").set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("awa.mbuyi@example.com");
  });

  it("met à jour le nom et le téléphone", async () => {
    const token = await signUp();
    const res = await request(server).patch("/me").set(auth(token)).send({ fullName: "Awa M. Mbuyi", phone: "" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ fullName: "Awa M. Mbuyi", phone: null });
  });

  it("après la déconnexion, le jeton ne sert plus à rien", async () => {
    const token = await signUp();
    expect((await request(server).post("/auth/logout").set(auth(token))).status).toBe(204);
    expect((await request(server).get("/me").set(auth(token))).status).toBe(401);
  });

  it("supprime le compte avec le mot de passe ; les commandes restent, sans lien vers la personne", async () => {
    const token = await signUp();
    const product = await insertProduct(db);
    await request(server).post("/orders").set(auth(token)).send({ productId: product.id, quantity: 1 });

    const refused = await request(server).delete("/me").set(auth(token)).send({ password: "mauvais" });
    expect(refused.status).toBe(401);

    const res = await request(server).delete("/me").set(auth(token)).send({ password: awa.password });
    expect(res.status).toBe(204);
    expect((await request(server).get("/me").set(auth(token))).status).toBe(401);
    const { rows } = await db.query("SELECT count(*)::int AS n, count(user_id)::int AS linked FROM orders");
    expect(rows[0]).toEqual({ n: 1, linked: 0 });
  });
});

describe("Commandes et historique d'un client", () => {
  it("une commande passée connecté apparaît dans « mes commandes », la plus récente d'abord", async () => {
    const token = await signUp();
    const noir = await insertProduct(db, { name: "Le Classique — Noir", stock: 5 });
    const moka = await insertProduct(db, { name: "Le Signature — Moka", stock: 5 });
    const first = await request(server).post("/orders").set(auth(token)).send({ productId: noir.id, quantity: 1 });
    const second = await request(server)
      .post("/orders")
      .set(auth(token))
      .send({ items: [{ productId: moka.id, quantity: 2 }] });
    await request(server).post(`/orders/${second.body.order.id}/pay`).set(auth(token)).send({ paymentId: "MM-CLIENT-0001" });

    const res = await request(server).get("/me/orders").set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.orders.map((order: { id: string }) => order.id)).toEqual([second.body.order.id, first.body.order.id]);
    expect(res.body.orders[0]).toMatchObject({ status: "payee", itemCount: 2 });
    expect(await stockOf(db, moka.id)).toBe(3);
  });

  it("un autre client ne peut ni voir ni payer ma commande (réponse « introuvable »)", async () => {
    const mine = await signUp();
    const other = await signUp({ ...awa, email: "autre@example.com" });
    const product = await insertProduct(db, { stock: 5 });
    const order = await request(server).post("/orders").set(auth(mine)).send({ productId: product.id, quantity: 1 });
    const id = order.body.order.id as string;

    expect((await request(server).get(`/orders/${id}`).set(auth(other))).status).toBe(404);
    expect((await request(server).get(`/orders/${id}`)).status).toBe(404);
    const pay = await request(server).post(`/orders/${id}/pay`).set(auth(other)).send({ paymentId: "MM-VOLEUR-0001" });
    expect(pay.status).toBe(404);
    expect(await stockOf(db, product.id)).toBe(5);
    expect((await request(server).get("/me/orders").set(auth(other))).body.orders).toEqual([]);
  });

  it("l'API du sujet reste utilisable sans compte (commande et paiement en invité)", async () => {
    const product = await insertProduct(db, { stock: 5 });
    const order = await request(server).post("/orders").send({ productId: product.id, quantity: 2 });
    expect(order.status).toBe(201);
    const pay = await request(server).post(`/orders/${order.body.order.id}/pay`).send({ paymentId: "MM-INVITE-0001" });
    expect(pay.status).toBe(200);
    expect(await stockOf(db, product.id)).toBe(3);
  });

  it("la même clé d'idempotence ne peut pas rattacher la commande d'un client à un autre", async () => {
    const mine = await signUp();
    const other = await signUp({ ...awa, email: "autre@example.com" });
    const product = await insertProduct(db);
    const body = { productId: product.id, quantity: 1 };
    await request(server).post("/orders").set(auth(mine)).set("Idempotency-Key", "cle-commande-0001").send(body);

    const res = await request(server).post("/orders").set(auth(other)).set("Idempotency-Key", "cle-commande-0001").send(body);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });
});
