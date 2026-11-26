import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Db } from "../db/pool.js";
import { errors } from "../http/errors.js";
import { parse, uuidSchema } from "../http/validation.js";
import { createOrderSchema, idempotencyKeySchema, payOrderSchema } from "./orders.schemas.js";
import { createOrder, getOrder, payOrder } from "./orders.service.js";

/** Un identifiant mal formé ne peut désigner aucune commande : réponse « introuvable ». */
function orderIdFrom(raw: unknown): string {
  const id = uuidSchema.safeParse(raw);
  if (!id.success) throw errors.orderNotFound();
  return id.data;
}

export function ordersRouter(db: Db): Router {
  const router = Router();

  // Limite plus stricte sur le paiement : 30 tentatives par minute et par adresse IP.
  const paymentLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Trop de tentatives de paiement. Patientez une minute." } });
    },
  });

  // 3. Passer une commande : refusée si le stock est insuffisant, sinon « en attente ».
  router.post("/", async (req, res) => {
    const input = parse(createOrderSchema, req.body);
    const idempotencyKey = parse(idempotencyKeySchema, req.get("idempotency-key"));
    const { order, replayed } = await createOrder(db, input, idempotencyKey);
    if (replayed) res.set("Idempotent-Replayed", "true");
    res.status(replayed ? 200 : 201).json({ order });
  });

  // 5. Consulter une commande et son statut.
  router.get("/:id", async (req, res) => {
    res.json({ order: await getOrder(db, orderIdFrom(req.params.id)) });
  });

  // 4. Payer une commande avec l'identifiant renvoyé par l'opérateur Mobile Money.
  router.post("/:id/pay", paymentLimiter, async (req, res) => {
    const orderId = orderIdFrom(req.params.id);
    const { paymentId } = parse(payOrderSchema, req.body);
    const { order, outcome } = await payOrder(db, orderId, paymentId);
    if (outcome === "already_processed") res.set("Idempotent-Replayed", "true");
    res.json({
      order,
      payment: {
        id: paymentId,
        outcome,
        message:
          outcome === "processed"
            ? "Paiement enregistré. La commande est payée."
            : "Ce paiement avait déjà été enregistré. Rien n'a été débité une seconde fois.",
      },
    });
  });

  return router;
}
