// Logique de paiement côté app, sans React ni Expo : testée par `npm test`.
import type { Order, PayOrderResponse } from "../../api/types";

/** Stockage clé/valeur persistant (AsyncStorage dans l'app, mémoire dans les tests). */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PaymentApi {
  payOrder(orderId: string, paymentId: string, simulateLostResponse?: boolean): Promise<PayOrderResponse>;
  getOrder(orderId: string): Promise<Order>;
}

/** Ce que le téléphone mémorise pour chaque commande payée (ou en cours de paiement). */
export interface PaymentRecord {
  orderId: string;
  paymentId: string;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  confirmedAt?: string;
}

export type PaymentResult =
  /** Le serveur confirme que la commande est payée. `alreadyRecorded` : ce paiement avait déjà été enregistré. */
  | { kind: "paid"; order: Order; paymentId: string; alreadyRecorded: boolean; paidElsewhere: boolean }
  /** Pas de réponse exploitable : le paiement est PEUT-ÊTRE passé. On ne conclut rien. */
  | { kind: "uncertain"; paymentId: string; message: string }
  /** Le serveur a refusé (stock épuisé, commande introuvable…). Rien n'a été débité. */
  | { kind: "refused"; paymentId: string; code: string; message: string };

export type StatusResult = { kind: "paid"; order: Order } | { kind: "pending"; order: Order } | { kind: "unknown"; message: string };

interface ErrorLike {
  kind?: string;
  status?: number;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

const recordKey = (orderId: string) => `ziko:payment:${orderId}`;

/** Réseau coupé, délai dépassé, serveur surchargé : on ne sait pas si le paiement est passé. */
function isUncertain(error: ErrorLike): boolean {
  if (error.kind === "network" || error.kind === "timeout") return true;
  if (typeof error.status === "number" && (error.status >= 500 || error.status === 429)) return true;
  return !error.code;
}

export function createPaymentController(deps: { api: PaymentApi; store: KeyValueStore; newPaymentId: () => string; now?: () => Date }) {
  const { api, store, newPaymentId } = deps;
  const now = () => (deps.now ?? (() => new Date()))().toISOString();
  /** Une seule requête de paiement à la fois par commande (double clic, double appel…). */
  const inFlight = new Map<string, Promise<PaymentResult>>();

  async function getRecord(orderId: string): Promise<PaymentRecord | null> {
    const raw = await store.getItem(recordKey(orderId));
    return raw ? (JSON.parse(raw) as PaymentRecord) : null;
  }

  async function saveRecord(record: PaymentRecord): Promise<void> {
    await store.setItem(recordKey(record.orderId), JSON.stringify(record));
  }

  /**
   * L'identifiant de paiement est créé UNE fois par commande et ENREGISTRÉ sur
   * le téléphone avant tout appel réseau : même si l'app se ferme en plein
   * paiement, la prochaine tentative renverra exactement le même identifiant.
   */
  async function ensureRecord(orderId: string): Promise<PaymentRecord> {
    const existing = await getRecord(orderId);
    if (existing) return existing;
    const record: PaymentRecord = { orderId, paymentId: newPaymentId(), createdAt: now(), attempts: 0 };
    await saveRecord(record);
    return record;
  }

  async function runPayment(orderId: string, simulateLostResponse: boolean): Promise<PaymentResult> {
    const stored = await ensureRecord(orderId);
    // Mode démo : la « coupure » ne s'applique qu'au tout premier essai, pour pouvoir réessayer.
    const cut = simulateLostResponse && stored.attempts === 0;
    const record: PaymentRecord = { ...stored, attempts: stored.attempts + 1, lastAttemptAt: now() };
    await saveRecord(record);

    try {
      const response = await api.payOrder(orderId, record.paymentId, cut);
      await saveRecord({ ...record, confirmedAt: now() });
      return {
        kind: "paid",
        order: response.order,
        paymentId: record.paymentId,
        alreadyRecorded: response.payment.outcome === "already_processed",
        paidElsewhere: false,
      };
    } catch (raw) {
      const error = (raw ?? {}) as ErrorLike;

      // Commande déjà payée (par exemple depuis un autre appareil) : aucun nouveau débit.
      if (error.code === "ORDER_ALREADY_PAID") {
        const order = (error.details?.order as Order | undefined) ?? (await api.getOrder(orderId).catch(() => undefined));
        if (order) {
          await saveRecord({ ...record, confirmedAt: now() });
          return { kind: "paid", order, paymentId: order.paymentId ?? record.paymentId, alreadyRecorded: true, paidElsewhere: order.paymentId !== record.paymentId };
        }
      }

      if (isUncertain(error)) {
        return {
          kind: "uncertain",
          paymentId: record.paymentId,
          message: error.message ?? "Nous n'avons pas encore pu confirmer le statut de votre paiement.",
        };
      }
      return { kind: "refused", paymentId: record.paymentId, code: error.code ?? "UNKNOWN", message: error.message ?? "Paiement refusé." };
    }
  }

  return {
    getRecord,

    /** Paie la commande. Un second appel pendant le traitement renvoie la MÊME promesse (pas de seconde requête). */
    pay(orderId: string, options: { simulateLostResponse?: boolean } = {}): Promise<PaymentResult> {
      const current = inFlight.get(orderId);
      if (current) return current;
      const attempt = runPayment(orderId, options.simulateLostResponse ?? false).finally(() => inFlight.delete(orderId));
      inFlight.set(orderId, attempt);
      return attempt;
    },

    /** Demande au serveur (source de vérité) où en est la commande, sans rien payer. */
    async checkStatus(orderId: string): Promise<StatusResult> {
      try {
        const order = await api.getOrder(orderId);
        if (order.status === "payee") {
          const record = await getRecord(orderId);
          if (record && !record.confirmedAt) await saveRecord({ ...record, confirmedAt: now() });
          return { kind: "paid", order };
        }
        return { kind: "pending", order };
      } catch (raw) {
        return { kind: "unknown", message: (raw as ErrorLike)?.message ?? "Serveur injoignable." };
      }
    },
  };
}

export type PaymentController = ReturnType<typeof createPaymentController>;
