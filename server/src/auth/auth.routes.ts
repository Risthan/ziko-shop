import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db/pool.js";
import { parse } from "../http/validation.js";
import { listOrdersForUser } from "../orders/orders.service.js";
import { currentUser, identify, requireUser } from "./auth.middleware.js";
import { deleteAccountSchema, loginSchema, registerSchema, updateProfileSchema } from "./auth.schemas.js";
import { deleteAccount, login, logout, register, updateProfile } from "./auth.service.js";

/**
 * Comptes clients :
 *   POST   /auth/register   créer un compte (renvoie le profil et un jeton de session)
 *   POST   /auth/login      se connecter
 *   POST   /auth/logout     se déconnecter (le jeton est détruit)
 *   GET    /me              mon profil
 *   PATCH  /me              modifier mon nom ou mon téléphone
 *   DELETE /me              supprimer mon compte (mot de passe demandé)
 *   GET    /me/orders       mes commandes, les plus récentes d'abord
 */
export function authRouter(db: Db): Router {
  const router = Router();

  // 20 tentatives par quart d'heure et par adresse IP : freine le devinage de mots de passe.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop de tentatives. Réessayez dans quelques minutes." } });
    },
  });

  router.post("/auth/register", authLimiter, async (req, res) => {
    const result = await register(db, parse(registerSchema, req.body));
    res.status(201).json(result);
  });

  router.post("/auth/login", authLimiter, async (req, res) => {
    res.json(await login(db, parse(loginSchema, req.body)));
  });

  router.post("/auth/logout", identify(db), requireUser, async (_req, res) => {
    await logout(db, res.locals.token as string);
    res.status(204).end();
  });

  router.get("/me", identify(db), requireUser, (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  router.patch("/me", identify(db), requireUser, async (req, res) => {
    res.json({ user: await updateProfile(db, currentUser(res)!.id, parse(updateProfileSchema, req.body)) });
  });

  router.delete("/me", identify(db), requireUser, authLimiter, async (req, res) => {
    const { password } = parse(deleteAccountSchema, req.body);
    await deleteAccount(db, currentUser(res)!.id, password);
    res.status(204).end();
  });

  router.get("/me/orders", identify(db), requireUser, async (_req, res) => {
    res.json({ orders: await listOrdersForUser(db, currentUser(res)!.id) });
  });

  return router;
}
