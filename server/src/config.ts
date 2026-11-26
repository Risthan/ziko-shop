import { z } from "zod";

// En local, on lit un éventuel fichier .env (Node >= 21.7). En production
// (Render), les variables viennent directement de l'hébergeur.
try {
  process.loadEnvFile();
} catch {
  // Pas de fichier .env : rien à faire.
}

const booleanFromEnv = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
  /** Active TLS vers PostgreSQL (nécessaire pour une base distante hors réseau interne). */
  DATABASE_SSL: booleanFromEnv,
  /**
   * Clé exigée pour créer un produit (en-tête X-Admin-Key). Si elle est vide,
   * la création reste ouverte : pratique en local, refusé en production.
   */
  ADMIN_API_KEY: z.string().default(""),
  /** Remplit la boutique avec les 9 pulls au démarrage si elle est vide. */
  SEED_ON_START: booleanFromEnv,
  /** Origines autorisées pour CORS, séparées par des virgules ("*" = toutes). */
  CORS_ORIGINS: z.string().default("*"),
  /** Clé de l'API temps réel Decart pour l'essayage en direct (facultative). */
  DECART_API_KEY: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Configuration invalide :\n${details.join("\n")}`);
}

if (parsed.data.NODE_ENV === "production" && parsed.data.ADMIN_API_KEY.length < 16) {
  throw new Error("ADMIN_API_KEY doit faire au moins 16 caractères en production.");
}

export const config = parsed.data;
export type Config = typeof config;
