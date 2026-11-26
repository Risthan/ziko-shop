// Types des réponses de l'API ZIKO SHOP (voir server/src).

export interface Product {
  id: string;
  name: string;
  priceCdf: number;
  stock: number;
  imageUrl: string | null;
  createdAt: string;
}

export type OrderStatus = "en_attente" | "payee";

export interface Order {
  id: string;
  productId: string;
  product: { name: string; imageUrl: string | null };
  quantity: number;
  unitPriceCdf: number;
  totalCdf: number;
  status: OrderStatus;
  paymentId: string | null;
  createdAt: string;
  paidAt: string | null;
}

/** "processed" : payé à l'instant. "already_processed" : ce paiement avait déjà été enregistré. */
export type PaymentOutcome = "processed" | "already_processed";

export interface PayOrderResponse {
  order: Order;
  payment: { id: string; outcome: PaymentOutcome; message: string };
}

export interface Features {
  liveTryOn: boolean;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "PRODUCT_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "ORDER_ALREADY_PAID"
  | "PAYMENT_ID_ALREADY_USED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | (string & {});
