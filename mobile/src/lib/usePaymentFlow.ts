import { useCallback, useRef, useState } from "react";
import { ApiError, api } from "@/api/client";
import type { Order } from "@/api/types";
import type { NoticeTone } from "@/components/Notice";
import { newIdempotencyKey, newPaymentId } from "./ids";

/**
 * Étapes du parcours de paiement :
 * - editing     : le client choisit la quantité ;
 * - creating    : création de la commande « en attente » ;
 * - paying      : envoi du paiement ;
 * - interrupted : le réseau a coupé, on ne sait pas si le paiement est passé -> on propose de réessayer ;
 * - refused     : le serveur a refusé (stock épuisé…), rien n'a été débité ;
 * - paid        : le serveur confirme que la commande est payée.
 */
export type Phase = "editing" | "creating" | "paying" | "interrupted" | "refused" | "paid";

export interface FlowNotice {
  tone: NoticeTone;
  title: string;
  message: string;
}

interface FlowState {
  phase: Phase;
  order: Order | null;
  paymentId: string | null;
  attempts: number;
  notice: FlowNotice | null;
}

const INITIAL: FlowState = { phase: "editing", order: null, paymentId: null, attempts: 0, notice: null };

function asApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError("network", "Erreur inattendue. Réessayez.");
}

export function usePaymentFlow(productId: string) {
  const [state, setState] = useState<FlowState>(INITIAL);

  // Valeurs qui doivent survivre entre deux tentatives, sans dépendre du rendu.
  const orderRef = useRef<Order | null>(null);
  const paymentIdRef = useRef<string | null>(null);
  const orderKeyRef = useRef<{ key: string; quantity: number } | null>(null);
  const attemptsRef = useRef(0);

  const update = (patch: Partial<FlowState>) => setState((previous) => ({ ...previous, ...patch }));

  /** Envoie le paiement. Toujours avec le MÊME identifiant pour une commande donnée. */
  const sendPayment = useCallback(async (order: Order, simulateCut: boolean) => {
    // L'identifiant est créé au premier essai, puis réutilisé à chaque nouvelle tentative.
    paymentIdRef.current ??= newPaymentId();
    const paymentId = paymentIdRef.current;
    attemptsRef.current += 1;
    // La simulation de coupure ne s'applique qu'au premier essai, pour pouvoir réessayer.
    const cut = simulateCut && attemptsRef.current === 1;
    update({ phase: "paying", paymentId, attempts: attemptsRef.current, notice: null });

    try {
      const result = await api.payOrder(order.id, paymentId, cut);
      orderRef.current = result.order;
      update({
        phase: "paid",
        order: result.order,
        notice:
          result.payment.outcome === "processed"
            ? { tone: "success", title: "Paiement confirmé", message: "Votre commande est payée. Merci pour votre achat !" }
            : {
                tone: "success",
                title: "Paiement confirmé — déjà enregistré",
                message:
                  "Le serveur avait déjà reçu ce paiement lors de l'essai précédent. Vous n'avez été débité qu'une seule fois.",
              },
      });
    } catch (raw) {
      const error = asApiError(raw);

      if (error.isConnectivityIssue) {
        update({
          phase: "interrupted",
          notice: {
            tone: "warning",
            title: "Connexion interrompue",
            message:
              "Nous ne savons pas encore si votre paiement est passé. Réessayez : le même identifiant de paiement sera renvoyé, vous ne pouvez pas être débité deux fois.",
          },
        });
        return;
      }

      if (error.code === "ORDER_ALREADY_PAID") {
        const paidOrder = (error.details?.order as Order | undefined) ?? order;
        orderRef.current = paidOrder;
        update({
          phase: "paid",
          order: paidOrder,
          notice: { tone: "success", title: "Commande déjà payée", message: "Cette commande était déjà réglée. Aucun nouveau débit n'a été effectué." },
        });
        return;
      }

      if (error.code === "INSUFFICIENT_STOCK" || error.code === "ORDER_NOT_FOUND" || error.code === "PAYMENT_ID_ALREADY_USED") {
        update({
          phase: "refused",
          notice: { tone: "danger", title: "Paiement refusé", message: `${error.message} Aucun débit n'a été effectué.` },
        });
        return;
      }

      // Autre erreur serveur (limite de débit, panne…) : on peut réessayer sans risque.
      update({ phase: "interrupted", notice: { tone: "danger", title: "Le paiement n'a pas abouti", message: error.message } });
    }
  }, []);

  /** Bouton « Payer » : crée la commande si besoin, puis envoie le paiement. */
  const pay = useCallback(
    async (quantity: number, simulateCut: boolean): Promise<{ availableStock?: number }> => {
      let order = orderRef.current;

      if (!order) {
        // Même clé si on renvoie la même commande : le serveur ne la créera pas deux fois.
        const previous = orderKeyRef.current;
        const orderKey = previous && previous.quantity === quantity ? previous : { key: newIdempotencyKey(), quantity };
        orderKeyRef.current = orderKey;
        update({ phase: "creating", notice: null });
        try {
          order = await api.createOrder(productId, quantity, orderKey.key);
          orderRef.current = order;
          update({ order });
        } catch (raw) {
          const error = asApiError(raw);
          update({
            phase: "editing",
            notice: error.isConnectivityIssue
              ? { tone: "warning", title: "Serveur injoignable", message: `${error.message} Votre commande n'a pas été enregistrée, rien n'a été débité.` }
              : { tone: "danger", title: "Commande impossible", message: error.message },
          });
          return { availableStock: error.code === "INSUFFICIENT_STOCK" ? (error.details?.available as number | undefined) : undefined };
        }
      }

      await sendPayment(order, simulateCut);
      return {};
    },
    [productId, sendPayment],
  );

  /** Nouvelle tentative après une coupure : même commande, même identifiant de paiement. */
  const retry = useCallback(async () => {
    if (orderRef.current) await sendPayment(orderRef.current, false);
  }, [sendPayment]);

  /** Demande au serveur où en est la commande, sans rien payer. */
  const checkStatus = useCallback(async () => {
    const order = orderRef.current;
    if (!order) return;
    try {
      const fresh = await api.getOrder(order.id);
      orderRef.current = fresh;
      if (fresh.status === "payee") {
        update({
          phase: "paid",
          order: fresh,
          notice: { tone: "success", title: "Paiement confirmé par le serveur", message: "Votre paiement avait bien été enregistré, une seule fois." },
        });
      } else {
        update({
          order: fresh,
          notice: { tone: "info", title: "Commande toujours en attente", message: "Le paiement n'est pas passé. Vous pouvez le relancer sans risque de double débit." },
        });
      }
    } catch (raw) {
      update({ notice: { tone: "warning", title: "Serveur toujours injoignable", message: asApiError(raw).message } });
    }
  }, []);

  return { ...state, pay, retry, checkStatus };
}
