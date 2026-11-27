import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import helmet from "helmet";
import type { Db } from "../db/pool.js";
import { adminLimiter, requireAdminKey } from "../http/middleware.js";
import { listProductsForAdmin, resetCollectionStock } from "../products/products.service.js";

const PAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/admin");

/**
 * ESPACE ADMINISTRATION de la boutique.
 *
 * - GET  /admin               la page (HTML) : on s'y connecte avec la clé ADMIN_API_KEY
 * - GET  /admin/session       vérifie la clé (en-tête X-Admin-Key)
 * - GET  /admin/products      tous les produits, y compris ceux retirés de la vente
 * - GET  /admin/summary       chiffres de la boutique et dernières commandes
 * - POST /admin/reset-stock   remet le stock des 9 pulls à l'état de départ
 *
 * Créer, modifier, supprimer ou remettre en vente un produit passe par l'API
 * produits (POST /products, PATCH /products/:id, DELETE /products/:id,
 * POST /products/:id/restore), protégée par la même clé.
 */
export function adminRouter(db: Db, adminKey: string): Router {
  const router = Router();
  const admin = [adminLimiter(), requireAdminKey(adminKey)];

  // La page n'exécute que son propre script ; les photos peuvent venir d'une adresse https.
  const pageSecurity = helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  });
  router.use(
    "/admin",
    (req, res, next) => {
      // Les moteurs de recherche n'indexent pas l'administration.
      res.set("X-Robots-Tag", "noindex, nofollow");
      next();
    },
  );
  router.get("/admin/session", ...admin, (_req, res) => {
    res.json({ ok: true });
  });

  // Tous les produits, y compris ceux retirés de la vente.
  router.get("/admin/products", ...admin, async (_req, res) => {
    res.json({ products: await listProductsForAdmin(db) });
  });

  router.get("/admin/summary", ...admin, async (_req, res) => {
    const [totals, recent] = await Promise.all([
      db.query<{ orders: number; paid: number; revenue: number; customers: number }>(
        `SELECT
           (SELECT count(*)::int FROM orders) AS orders,
           (SELECT count(*)::int FROM orders WHERE status = 'payee') AS paid,
           (SELECT COALESCE(sum(total_cdf), 0)::int FROM orders WHERE status = 'payee') AS revenue,
           (SELECT count(*)::int FROM users) AS customers`,
      ),
      db.query<{ id: string; total_cdf: number; status: string; created_at: Date; pieces: number; customer: string | null }>(
        `SELECT o.id, o.total_cdf, o.status, o.created_at,
                (SELECT sum(quantity)::int FROM order_items i WHERE i.order_id = o.id) AS pieces,
                u.full_name AS customer
         FROM orders o LEFT JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 15`,
      ),
    ]);
    res.json({
      totals: totals.rows[0],
      recentOrders: recent.rows.map((row) => ({
        id: row.id,
        totalCdf: row.total_cdf,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        pieces: row.pieces,
        customer: row.customer,
      })),
    });
  });

  router.post("/admin/reset-stock", ...admin, async (_req, res) => {
    const updated = await resetCollectionStock(db);
    res.json({ updated, products: await listProductsForAdmin(db) });
  });

  // La page elle-même (après les routes ci-dessus) : /admin redirige vers /admin/.
  router.use("/admin", pageSecurity, express.static(PAGE_DIR, { maxAge: 0 }));

  return router;
}
