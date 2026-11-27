/**
 * Codes d'erreur stables renvoyés par l'API. L'app mobile se base sur ces
 * codes (jamais sur le texte) pour décider quoi afficher.
 */
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_JSON"
  | "PAYLOAD_TOO_LARGE"
  | "UNAUTHORIZED"
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_ALREADY_USED"
  | "NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "ORDER_ALREADY_PAID"
  | "PAYMENT_ID_ALREADY_USED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "FEATURE_DISABLED"
  | "UPSTREAM_ERROR"
  | "TRYON_UNAVAILABLE"
  | "TRYON_BUSY"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  productNotFound: (productId?: string) =>
    new AppError(404, "PRODUCT_NOT_FOUND", "Ce produit est introuvable.", productId ? { productId } : undefined),
  orderNotFound: () => new AppError(404, "ORDER_NOT_FOUND", "Cette commande est introuvable."),
  /** `product` précise QUEL article manque quand la commande en contient plusieurs. */
  insufficientStock: (available: number, requested: number, product?: { id: string; name: string }) =>
    new AppError(
      409,
      "INSUFFICIENT_STOCK",
      available === 0
        ? product
          ? `« ${product.name} » est en rupture de stock.`
          : "Ce produit est en rupture de stock."
        : `Stock insuffisant${product ? ` pour « ${product.name} »` : ""} : il reste ${available} pièce(s), vous en demandez ${requested}.`,
      { available, requested, ...(product ? { productId: product.id, productName: product.name } : {}) },
    ),
};
