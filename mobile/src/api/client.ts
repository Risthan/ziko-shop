import { API_URL } from "@/config";
import type { ApiErrorCode, Features, Order, PayOrderResponse, Product } from "./types";

/**
 * Trois familles d'échec, qui ne se traitent pas de la même façon :
 * - "network" : le serveur n'a pas pu être joint, ou la réponse s'est perdue ;
 * - "timeout" : pas de réponse à temps (le serveur a PEUT-ÊTRE traité la requête) ;
 * - "http"    : le serveur a répondu avec une erreur (stock insuffisant, etc.).
 */
export type ApiErrorKind = "network" | "timeout" | "http";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status?: number,
    readonly code?: ApiErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Vrai quand on ne sait pas si le serveur a traité la requête. */
  get isConnectivityIssue(): boolean {
    return this.kind === "network" || this.kind === "timeout";
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...options.headers },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError("timeout", "Le serveur met trop de temps à répondre.");
    }
    throw new ApiError("network", "Impossible de joindre le serveur. Vérifiez votre connexion internet.");
  } finally {
    clearTimeout(timer);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("http", "Réponse inattendue du serveur.", response.status, "BAD_RESPONSE");
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } }).error;
    throw new ApiError(
      "http",
      error?.message ?? `Erreur du serveur (${response.status}).`,
      response.status,
      error?.code,
      error?.details,
    );
  }
  return payload as T;
}

export const api = {
  /** Délai long : l'hébergement gratuit peut mettre jusqu'à une minute à se réveiller. */
  listProducts: () => request<{ products: Product[] }>("/products", { timeoutMs: 75_000 }).then((r) => r.products),

  getProduct: (id: string) => request<{ product: Product }>(`/products/${id}`).then((r) => r.product),

  getFeatures: () => request<Features>("/features"),

  /** La clé d'idempotence évite de créer deux commandes si la requête est renvoyée. */
  createOrder: (productId: string, quantity: number, idempotencyKey: string) =>
    request<{ order: Order }>("/orders", {
      method: "POST",
      body: { productId, quantity },
      headers: { "Idempotency-Key": idempotencyKey },
    }).then((r) => r.order),

  getOrder: (id: string) => request<{ order: Order }>(`/orders/${id}`).then((r) => r.order),

  /**
   * Envoie le paiement. `simulateLostResponse` (mode démo) envoie vraiment la
   * requête au serveur, puis fait comme si la réponse s'était perdue en route :
   * exactement le cas « le réseau coupe pendant le paiement ».
   */
  payOrder: async (orderId: string, paymentId: string, simulateLostResponse = false) => {
    const result = await request<PayOrderResponse>(`/orders/${orderId}/pay`, {
      method: "POST",
      body: { paymentId },
      timeoutMs: 20_000,
    });
    if (simulateLostResponse) {
      throw new ApiError("network", "La connexion a été coupée avant la réponse du serveur (simulation).");
    }
    return result;
  },
};
