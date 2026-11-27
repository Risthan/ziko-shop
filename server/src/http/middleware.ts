import { createHash, timingSafeEqual } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { AppError } from "./errors.js";
import { formatZodError } from "./validation.js";

/**
 * Protège une route avec la clé d'administration (en-tête X-Admin-Key).
 * Comparaison à temps constant pour ne rien révéler de la clé.
 */
export function requireAdminKey(adminKey: string): RequestHandler {
  const expected = createHash("sha256").update(adminKey).digest();
  return (req, _res, next) => {
    if (!adminKey) return next(); // Pas de clé configurée (dev local) : route ouverte.
    const provided = createHash("sha256").update(req.get("x-admin-key") ?? "").digest();
    if (!timingSafeEqual(provided, expected)) {
      return next(new AppError(401, "UNAUTHORIZED", "Clé d'administration absente ou invalide (en-tête X-Admin-Key)."));
    }
    next();
  };
}

/**
 * Routes d'administration : 60 requêtes par quart d'heure et par IP. Rend
 * inutile toute tentative de deviner la clé (256 bits) par essais répétés.
 */
export function adminLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60_000,
    limit: 60,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop de requêtes d'administration. Patientez quelques minutes." } });
    },
  });
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", `Route introuvable : ${req.method} ${req.path}`));
};

/** Transforme toute erreur en réponse JSON { error: { code, message, details? } }. */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof ZodError) {
    const { message, fields } = formatZodError(error);
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message, details: { fields } } });
    return;
  }
  // Erreurs levées par express.json() sur un corps illisible ou trop gros.
  const type = (error as { type?: string }).type;
  if (type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Le corps de la requête n'est pas un JSON valide." } });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Le corps de la requête est trop volumineux." } });
    return;
  }
  // Erreur inattendue : on la journalise, mais on ne divulgue aucun détail interne au client.
  console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue. Réessayez plus tard." } });
};

/** Journal minimal : méthode, chemin, statut et durée de chaque requête. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const start = performance.now();
  res.on("finish", () => {
    const ms = Math.round(performance.now() - start);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
};
