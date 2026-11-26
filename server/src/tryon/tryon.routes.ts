import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDecartClient } from "@decartai/sdk";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppError } from "../http/errors.js";

/**
 * ESSAYAGE EN DIRECT (fonctionnalité facultative, isolée du reste de l'API).
 *
 * La page /essayage filme le client avec sa caméra et le modèle temps réel
 * « lucy-vton » de Decart lui fait porter le pull, en vidéo.
 *
 * Sécurité : la clé Decart ne quitte jamais le serveur. Le navigateur reçoit
 * seulement un jeton temporaire (60 s pour démarrer), limité à ce modèle, à
 * l'origine de la page et à une séance de 45 s maximum (maîtrise des coûts).
 */
export const MAX_SESSION_SECONDS = 45;
const MODEL = "lucy-vton-latest";

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/essayage");

export function tryOnRouter(decartApiKey: string): Router {
  const router = Router();

  // La page charge son script, accède à la caméra et parle à Decart (WebRTC) :
  // on n'ouvre que le strict nécessaire, pour cette page seulement.
  const pageSecurity = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "https:", "wss:"],
      frameAncestors: ["'none'"],
    },
  });
  router.use(
    "/essayage",
    pageSecurity,
    (_req, res, next) => {
      res.set("Permissions-Policy", "camera=(self), microphone=()");
      next();
    },
    express.static(PAGE_DIR, { maxAge: "1h" }),
  );

  const tokenLimiter = rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop d'essayages d'affilée. Patientez une minute." } });
    },
  });

  router.post("/try-on/token", tokenLimiter, async (req, res) => {
    if (!decartApiKey) {
      throw new AppError(503, "FEATURE_DISABLED", "L'essayage en direct n'est pas activé sur ce serveur.");
    }
    const origin = `${req.protocol}://${req.get("host")}`;
    try {
      const client = createDecartClient({ apiKey: decartApiKey });
      const token = await client.tokens.create({
        expiresIn: 60,
        allowedModels: [MODEL],
        allowedOrigins: [origin],
        constraints: { realtime: { maxSessionDuration: MAX_SESSION_SECONDS } },
      });
      res.json({ apiKey: token.apiKey, expiresAt: token.expiresAt, model: MODEL, maxSessionSeconds: MAX_SESSION_SECONDS });
    } catch (error) {
      console.error("Decart tokens.create a échoué", error);
      throw new AppError(502, "UPSTREAM_ERROR", "Le service d'essayage est momentanément indisponible.");
    }
  });

  return router;
}
