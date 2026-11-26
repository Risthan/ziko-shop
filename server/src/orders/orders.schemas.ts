import { z } from "zod";
import { parse } from "../http/validation.js";

export const MAX_QUANTITY = 100;
/** Nombre maximum d'articles différents dans un panier. */
export const MAX_ITEMS = 20;

/** Identifiant de paiement, comme celui que renverrait un opérateur Mobile Money. */
export const paymentIdSchema = z
  .string({ error: "L'identifiant de paiement est obligatoire." })
  .regex(
    /^[A-Za-z0-9_-]{8,64}$/,
    "L'identifiant de paiement doit faire 8 à 64 caractères (lettres, chiffres, - ou _).",
  );

const itemSchema = z.object({
  productId: z.uuid({ error: "L'identifiant du produit est invalide." }),
  quantity: z
    .number({ error: "La quantité doit être un nombre." })
    .int("La quantité doit être un nombre entier.")
    .min(1, "La quantité doit être d'au moins 1.")
    .max(MAX_QUANTITY, `La quantité ne peut pas dépasser ${MAX_QUANTITY}.`),
});

/** Panier : plusieurs articles, chaque produit une seule fois (avec sa quantité). */
const cartSchema = z.object({
  items: z
    .array(itemSchema, { error: "La liste des articles est invalide." })
    .min(1, "Le panier est vide.")
    .max(MAX_ITEMS, `Un panier ne peut pas contenir plus de ${MAX_ITEMS} articles différents.`)
    .refine(
      (items) => new Set(items.map((item) => item.productId)).size === items.length,
      "Un même produit apparaît deux fois : regroupez les quantités.",
    ),
});

export type OrderItemInput = z.infer<typeof itemSchema>;
export interface CreateOrderInput {
  items: OrderItemInput[];
}

/**
 * Deux formats acceptés :
 * - un seul produit : `{ productId, quantity }` (format de l'énoncé) ;
 * - un panier : `{ items: [{ productId, quantity }, …] }`.
 */
export function parseCreateOrder(body: unknown): CreateOrderInput {
  const isCart = typeof body === "object" && body !== null && "items" in body;
  return isCart ? parse(cartSchema, body) : { items: [parse(itemSchema, body)] };
}

export const payOrderSchema = z.object({
  paymentId: paymentIdSchema,
});

/** En-tête facultatif Idempotency-Key envoyé lors de la création d'une commande. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, "L'en-tête Idempotency-Key doit faire 8 à 100 caractères (lettres, chiffres, - ou _).")
  .optional();
