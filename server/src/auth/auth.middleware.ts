import type { RequestHandler, Response } from "express";
import type { Db } from "../db/pool.js";
import { type User, errorsAuth, userFromToken } from "./auth.service.js";

/** Jeton envoyé par l'app : en-tête « Authorization: Bearer <jeton> ». */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(header ?? "");
  return match ? match[1]! : null;
}

/**
 * Reconnaît le client s'il envoie un jeton. Sans jeton, la requête continue
 * en invité (l'API du sujet reste utilisable telle quelle). Avec un jeton
 * invalide ou expiré : 401, pour que l'app propose de se reconnecter.
 */
export function identify(db: Db): RequestHandler {
  return async (req, res, next) => {
    const token = bearerToken(req.get("authorization"));
    if (!token) {
      if (req.get("authorization")) return next(errorsAuth.expired());
      return next();
    }
    try {
      res.locals.user = await userFromToken(db, token);
      res.locals.token = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireUser: RequestHandler = (_req, res, next) => {
  if (!res.locals.user) return next(errorsAuth.required());
  next();
};

export const currentUser = (res: Response): User | null => (res.locals.user as User | undefined) ?? null;
