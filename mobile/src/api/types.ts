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

/** Compte client (le mot de passe ne quitte jamais le serveur). */
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
  /** Jeton de session, à envoyer dans l'en-tête Authorization. */
  token: string;
}

export interface OrderItem {
  productId: string;
  product: { name: string; imageUrl: string | null };
  quantity: number;
  /** Taille choisie (S à XXL), ou null pour une commande passée sans taille. */
  size?: string | null;
  /** Prix figé au moment de la commande. */
  unitPriceCdf: number;
  lineTotalCdf: number;
}

export interface Order {
  id: string;
  /** Les articles, dans l'ordre du panier (un seul pour une commande directe). */
  items: OrderItem[];
  /** Nombre total de pièces. */
  itemCount: number;
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

/** Essayage en direct : actif via iKawn Mirror (capacité « tryon »), ou désactivé sur le serveur. */
export type TryOnConfig = { mode: "ikawn"; maxSessionSeconds: number } | { mode: "off" };

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
