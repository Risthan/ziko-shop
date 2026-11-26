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
 * Deux façons de l'activer, au choix :
 * 1. DECART_API_KEY : notre page filme le client et le modèle temps réel
 *    « lucy-vton » de Decart lui fait porter le pull, en vidéo.
 *    La clé ne quitte jamais le serveur : le navigateur reçoit un jeton
 *    temporaire (60 s pour démarrer), limité à ce modèle, à l'origine de la
 *    page et à une séance de 45 s maximum (maîtrise des coûts).
 * 2. ANYWEAR_DOMAIN : la page charge le widget officiel AnyWear, qui ajoute
 *    son bouton « Try-On » sur la photo du pull (domaine à faire activer
 *    sur anywear.decart.ai/install).
 * Sans aucune des deux, l'app n'affiche pas le bouton.
 */
export const MAX_SESSION_SECONDS = 45;
const MODEL = "lucy-vton-latest";

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/essayage");

/** Widget officiel AnyWear (Decart) : script tiers, chargé uniquement sur /essayage. */
const ANYWEAR_ORIGIN = "https://anywear.decart.ai";

export type TryOnMode = "decart" | "anywear" | "off";

export function tryOnMode(decartApiKey: string, anywearDomain: string): TryOnMode {
  if (decartApiKey) return "decart";
  if (anywearDomain) return "anywear";
  return "off";
}

export function tryOnRouter(decartApiKey: string, anywearDomain = ""): Router {
  const router = Router();
  const mode = tryOnMode(decartApiKey, anywearDomain);
  const widget = mode === "anywear";

  // La page charge son script, accède à la caméra et parle au service d'essayage :
  // on n'ouvre que le strict nécessaire, pour cette page seulement. Le widget
  // AnyWear (s'il est activé) a besoin de son propre script, styles et cadre.
  const pageSecurity = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: widget ? ["'self'", ANYWEAR_ORIGIN] : ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com", ...(widget ? ["'unsafe-inline'", ANYWEAR_ORIGIN] : [])],
      fontSrc: ["'self'", "https://fonts.gstatic.com", ...(widget ? ["https:"] : [])],
      imgSrc: ["'self'", "data:", "blob:", ...(widget ? ["https:"] : [])],
      mediaSrc: ["'self'", "blob:", ...(widget ? ["https:"] : [])],
      connectSrc: ["'self'", "https:", "wss:"],
      frameSrc: widget ? [ANYWEAR_ORIGIN, "https://*.decart.ai"] : ["'none'"],
      frameAncestors: ["'none'"],
    },
  });
  router.use(
    "/essayage",
    pageSecurity,
    (_req, res, next) => {
      res.set("Permissions-Policy", widget ? `camera=(self "${ANYWEAR_ORIGIN}"), microphone=()` : "camera=(self), microphone=()");
      next();
    },
    express.static(PAGE_DIR, { maxAge: "1h" }),
  );

  // La page demande quel mode d'essayage utiliser.
  router.get("/try-on/config", (_req, res) => {
    res.json(
      mode === "anywear"
        ? { mode, widgetUrl: `${ANYWEAR_ORIGIN}/widget/latest/anywear.js?domain=${encodeURIComponent(anywearDomain)}` }
        : { mode, maxSessionSeconds: MAX_SESSION_SECONDS },
    );
  });

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
