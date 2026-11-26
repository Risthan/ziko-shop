import { z } from "zod";

export const MAX_QUANTITY = 100;

/** Identifiant de paiement, comme celui que renverrait un opérateur Mobile Money. */
export const paymentIdSchema = z
  .string({ error: "L'identifiant de paiement est obligatoire." })
  .regex(
    /^[A-Za-z0-9_-]{8,64}$/,
    "L'identifiant de paiement doit faire 8 à 64 caractères (lettres, chiffres, - ou _).",
  );

export const createOrderSchema = z.object({
  productId: z.uuid({ error: "L'identifiant du produit est invalide." }),
  quantity: z
    .number({ error: "La quantité doit être un nombre." })
    .int("La quantité doit être un nombre entier.")
    .min(1, "La quantité doit être d'au moins 1.")
    .max(MAX_QUANTITY, `La quantité ne peut pas dépasser ${MAX_QUANTITY}.`),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const payOrderSchema = z.object({
  paymentId: paymentIdSchema,
});

/** En-tête facultatif Idempotency-Key envoyé lors de la création d'une commande. */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, "L'en-tête Idempotency-Key doit faire 8 à 100 caractères (lettres, chiffres, - ou _).")
  .optional();
