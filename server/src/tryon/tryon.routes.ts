import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { z } from "zod";
import { AppError } from "../http/errors.js";
import { parse } from "../http/validation.js";

/**
 * ESSAYAGE EN DIRECT (fonctionnalité facultative, isolée du reste de l'API).
 *
 * Fournisseur unique : iKawn Mirror, capacité « tryon »
 * (https://platform.ikawn.com/documentation/quickstart).
 *
 * - La page /essayage filme le client et lui fait porter le pull en direct
 *   grâce au SDK officiel (https://api.ikawn.com/sdk/mirror.js), en WebRTC.
 * - La clé IKAWN_API_KEY ne quitte JAMAIS le serveur : la page demande une
 *   séance à POST /try-on/session, qui la crée chez iKawn (POST /v1/sessions)
 *   et ne renvoie que les identifiants limités à cette séance.
 * - Coût maîtrisé : iKawn facture le temps de séance active. Une séance dure
 *   au plus MAX_SESSION_SECONDS : la page l'arrête, et le serveur demande
 *   lui-même la fin de la séance à iKawn juste après (filet de sécurité).
 *
 * Sans IKAWN_API_KEY, l'essayage est désactivé et l'app propose simplement de commander.
 */
export const IKAWN_API_BASE = "https://api.ikawn.com/v1";
export const IKAWN_SDK_ORIGIN = "https://api.ikawn.com";
export const MAX_SESSION_SECONDS = 30;
/** Délai avant que le serveur ne termine lui-même la séance (fin normale + marge). */
const SERVER_END_DELAY_MS = (MAX_SESSION_SECONDS + 8) * 1000;

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/essayage");

export type TryOnMode = "ikawn" | "off";

export function tryOnMode(ikawnApiKey: string): TryOnMode {
  return ikawnApiKey ? "ikawn" : "off";
}

/** Même format qu'iKawn : 8 à 128 lettres, chiffres, _ ou -. Une clé par tentative de connexion. */
const idempotencyKeySchema = z
  .string({ error: "L'en-tête Idempotency-Key est obligatoire." })
  .regex(/^[A-Za-z0-9_-]{8,128}$/, "L'en-tête Idempotency-Key doit faire 8 à 128 caractères (lettres, chiffres, - ou _).");

interface IkawnSession {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface TryOnOptions {
  fetchImpl?: typeof fetch;
  /** Délai avant la fin forcée côté serveur (modifiable pour les tests). */
  serverEndDelayMs?: number;
}

/** Messages clairs pour le client, selon la réponse d'iKawn (voir « Errors and support »). */
function upstreamError(status: number): AppError {
  if (status === 402) {
    return new AppError(503, "TRYON_UNAVAILABLE", "L'essayage en direct est momentanément indisponible. Vous pouvez quand même commander ce pull.");
  }
  if (status === 429 || status === 409) {
    return new AppError(429, "TRYON_BUSY", "Un autre client essaie un pull en ce moment. Réessayez dans un instant.");
  }
  return new AppError(502, "UPSTREAM_ERROR", "Le service d'essayage est momentanément indisponible.");
}

export function tryOnRouter(ikawnApiKey: string, options: TryOnOptions = {}): Router {
  const router = Router();
  const mode = tryOnMode(ikawnApiKey);
  const fetchImpl = options.fetchImpl ?? fetch;
  const endDelay = options.serverEndDelayMs ?? SERVER_END_DELAY_MS;

  // La page charge son script et le SDK iKawn (avec son moteur WebAssembly),
  // accède à la caméra et se connecte au service : uniquement sur cette page.
  // L'adresse de signalisation WebRTC est fournie par iKawn à chaque séance,
  // d'où connect-src https:/wss:.
  const pageSecurity = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", IKAWN_SDK_ORIGIN, "'wasm-unsafe-eval'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:", "mediastream:"],
      connectSrc: ["'self'", "https:", "wss:"],
      workerSrc: ["'self'", "blob:"],
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
    res.json(mode === "ikawn" ? { mode, maxSessionSeconds: MAX_SESSION_SECONDS } : { mode });
  });

  // 6 séances par minute et par adresse IP (iKawn en accepte 10 par minute et par clé).
  const sessionLimiter = rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop d'essayages d'affilée. Patientez une minute." } });
    },
  });

  /** Demande à iKawn la fin d'une séance (sans attendre ni échouer bruyamment). */
  const endSession = (sessionId: string) =>
    fetchImpl(`${IKAWN_API_BASE}/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ikawnApiKey}`, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);

  // Crée UNE séance d'essayage chez iKawn et renvoie sa réponse au SDK de la page.
  // Elle ne contient que des identifiants limités à cette séance, jamais la clé.
  router.post("/try-on/session", sessionLimiter, async (req, res) => {
    if (!ikawnApiKey) {
      throw new AppError(503, "FEATURE_DISABLED", "L'essayage en direct n'est pas activé sur ce serveur.");
    }
    const idempotencyKey = parse(idempotencyKeySchema, req.get("idempotency-key"));

    let response: Response;
    try {
      response = await fetchImpl(`${IKAWN_API_BASE}/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ikawnApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        // Le corps ne contient QUE la capacité : la photo du pull passe par le SDK.
        body: JSON.stringify({ capability: "tryon" }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw upstreamError(504);
    }

    if (!response.ok) {
      const details = (await response.json().catch(() => null)) as { error?: { code?: string; request_id?: string } } | null;
      console.error("Séance iKawn refusée :", response.status, details?.error?.code ?? "", details?.error?.request_id ?? "");
      throw upstreamError(response.status);
    }

    const session = (await response.json()) as IkawnSession;
    // Filet de sécurité : même si la page ne s'arrête pas (onglet tué, réseau
    // coupé), le serveur termine la séance après la durée maximale.
    if (response.status === 201 && typeof session.id === "string") {
      const sessionId = session.id;
      setTimeout(() => void endSession(sessionId), endDelay).unref();
    }
    res.set("Cache-Control", "no-store").status(response.status).json(session);
  });

  return router;
}
