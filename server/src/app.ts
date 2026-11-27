import path from "node:path";
import { fileURLToPath } from "node:url";
import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { adminRouter } from "./admin/admin.routes.js";
import { authRouter } from "./auth/auth.routes.js";
import type { Config } from "./config.js";
import type { Db } from "./db/pool.js";
import { errorHandler, notFoundHandler, requestLogger } from "./http/middleware.js";
import { ordersRouter } from "./orders/orders.routes.js";
import { productsRouter } from "./products/products.routes.js";
import { tryOnRouter } from "./tryon/tryon.routes.js";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

export type AppConfig = Pick<Config, "NODE_ENV" | "ADMIN_API_KEY" | "CORS_ORIGINS" | "IKAWN_API_KEY">;

export function createApp(db: Db, config: AppConfig): express.Express {
  const app = express();

  // Render (et la plupart des hébergeurs) placent l'API derrière un proxy :
  // nécessaire pour que la limite de débit voie la vraie adresse IP du client.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Les images produits doivent pouvoir s'afficher depuis l'app (autre origine).
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: config.CORS_ORIGINS === "*" ? "*" : config.CORS_ORIGINS.split(",").map((origin) => origin.trim()),
    }),
  );
  // Réponses compressées (gzip) : moins de données sur les réseaux mobiles.
  app.use(compression());
  app.use(express.json({ limit: "10kb" }));
  if (config.NODE_ENV !== "test") app.use(requestLogger);

  // Limite globale : 300 requêtes par 15 minutes et par adresse IP.
  app.use(
    rateLimit({
      windowMs: 15 * 60_000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop de requêtes. Réessayez dans quelques minutes." } });
      },
    }),
  );

  app.use("/images", express.static(path.join(PUBLIC_DIR, "images"), { maxAge: "7d", immutable: true }));

  app.get("/", (_req, res) => {
    res.json({ name: "ZIKO SHOP API", docs: "https://github.com/ (voir le README du dépôt)", health: "/health" });
  });

  app.get("/health", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ status: "ok" });
  });

  // Fonctionnalités facultatives activées sur ce serveur (l'app adapte son interface).
  app.get("/features", (_req, res) => {
    res.json({ liveTryOn: config.IKAWN_API_KEY.length > 0 });
  });

  app.use("/products", productsRouter(db, config.ADMIN_API_KEY));
  app.use(adminRouter(db, config.ADMIN_API_KEY));
  app.use(authRouter(db));
  app.use("/orders", ordersRouter(db));
  // Facultatif et isolé : essayage en direct (voir src/tryon).
  app.use(tryOnRouter(config.IKAWN_API_KEY));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
