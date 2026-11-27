import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { AppError } from "../http/errors.js";

/**
 * ESSAYAGE EN DIRECT (fonctionnalité facultative, isolée du reste de l'API).
 *
 * Fournisseur unique : Fal.ai, modèle « Lucy VTON Realtime »
 * (https://fal.ai/models/decart/lucy2-vton/realtime/api).
 *
 * - La page /essayage filme le client (caméra frontale) et envoie la vidéo au
 *   modèle en WebRTC ; elle reçoit en retour la vidéo où il porte le pull.
 *   Le SDK officiel `@fal-ai/client` gère la connexion (WebSocket de
 *   signalisation + WebRTC).
 * - La clé FAL_KEY ne quitte JAMAIS le serveur : la page reçoit un jeton
 *   temporaire (POST /try-on/token), valable 2 minutes pour ouvrir une
 *   séance, et limité à ce seul modèle.
 * - Coût maîtrisé : Fal facture la seconde de vidéo produite, donc une
 *   séance dure au plus MAX_SESSION_SECONDS et les jetons sont limités par
 *   adresse IP.
 *
 * Sans FAL_KEY, l'essayage est désactivé et l'app propose simplement de commander.
 */
export const FAL_ENDPOINT = "decart/lucy2-vton/realtime";
/** Nom de l'app autorisée dans le jeton Fal (l'identifiant sans le propriétaire ni le chemin). */
const FAL_APP_ALIAS = "lucy2-vton";
const FAL_TOKEN_URL = "https://rest.fal.ai/tokens/";
const TOKEN_EXPIRATION_SECONDS = 120;
export const MAX_SESSION_SECONDS = 60;

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/essayage");

export type TryOnMode = "fal" | "off";

export function tryOnMode(falKey: string): TryOnMode {
  return falKey ? "fal" : "off";
}

/** Demande à Fal un jeton temporaire, limité au modèle d'essayage. */
export async function createFalToken(falKey: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl(FAL_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ allowed_apps: [FAL_APP_ALIAS], token_expiration: TOKEN_EXPIRATION_SECONDS }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Fal a refusé la création du jeton (HTTP ${response.status})`);
  }
  const token: unknown = await response.json();
  // Fal renvoie le jeton sous forme de chaîne JSON.
  if (typeof token === "string" && token.length > 0) return token;
  if (token && typeof token === "object" && typeof (token as { detail?: unknown }).detail === "string") {
    return (token as { detail: string }).detail;
  }
  throw new Error("Réponse inattendue de Fal pour le jeton");
}

export function tryOnRouter(falKey: string, fetchImpl: typeof fetch = fetch): Router {
  const router = Router();
  const mode = tryOnMode(falKey);

  // La page charge son script, accède à la caméra et parle à Fal : on n'ouvre
  // que le strict nécessaire, pour cette page seulement.
  const pageSecurity = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:", "mediastream:"],
      // Le jeton vient de notre API ; la signalisation passe par le WebSocket de Fal.
      connectSrc: ["'self'", "wss://fal.run", "https://fal.run"],
      frameSrc: ["'none'"],
      // L'app mobile affiche la page dans une WebView (pas un cadre) : aucun site ne peut l'intégrer.
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
    // Revalidée à chaque ouverture (ETag) : une mise à jour de la page arrive
    // tout de suite dans l'app, sans attendre l'expiration d'un cache.
    express.static(PAGE_DIR, { maxAge: 0 }),
  );

  // La page (et l'app) demandent si l'essayage est disponible.
  router.get("/try-on/config", (_req, res) => {
    res.json(mode === "fal" ? { mode, maxSessionSeconds: MAX_SESSION_SECONDS } : { mode });
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

  // Jeton temporaire pour ouvrir UNE séance. Renvoyé en texte brut : c'est le
  // format attendu par le `tokenProvider` du SDK Fal.
  router.post("/try-on/token", tokenLimiter, async (_req, res) => {
    if (!falKey) {
      throw new AppError(503, "FEATURE_DISABLED", "L'essayage en direct n'est pas activé sur ce serveur.");
    }
    let token: string;
    try {
      token = await createFalToken(falKey, fetchImpl);
    } catch (error) {
      console.error("Jeton Fal impossible à créer :", error instanceof Error ? error.message : error);
      throw new AppError(502, "UPSTREAM_ERROR", "Le service d'essayage est momentanément indisponible.");
    }
    res.set("Cache-Control", "no-store").type("text/plain").send(token);
  });

  return router;
}
