import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Order } from "@/api/types";
import { haptics } from "../haptics";
import { newPaymentId } from "../ids";
import { applyPaidOrder, queryKeys } from "../queries";
import { deviceStore } from "../storage";
import { createPaymentController, type PaymentRecord } from "./paymentController";

/** Un seul contrôleur pour toute l'app : la protection « une requête à la fois » est partagée. */
export const paymentController = createPaymentController({ api, store: deviceStore, newPaymentId });

/**
 * - idle      : prêt à payer
 * - paying    : requête envoyée, bouton désactivé
 * - uncertain : pas de réponse, le paiement est PEUT-ÊTRE passé
 * - checking  : on demande le statut au serveur
 * - refused   : le serveur a refusé, rien n'a été débité
 */
export type PaymentPhase = "idle" | "paying" | "uncertain" | "checking" | "refused";

interface Options {
  /** Appelé quand le serveur confirme que la commande est payée. */
  onPaid: (order: Order, info: { alreadyRecorded: boolean; paidElsewhere: boolean }) => void;
}

export function usePayment(orderId: string, { onPaid }: Options) {
  const client = useQueryClient();
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [record, setRecord] = useState<PaymentRecord | null>(null);

  const refreshRecord = useCallback(async () => setRecord(await paymentController.getRecord(orderId)), [orderId]);

  useEffect(() => {
    void refreshRecord();
  }, [refreshRecord]);

  const confirmPaid = useCallback(
    async (order: Order, info: { alreadyRecorded: boolean; paidElsewhere: boolean }) => {
      await applyPaidOrder(client, order);
      haptics.success();
      onPaid(order, info);
    },
    [client, onPaid],
  );

  const pay = useCallback(
    async (simulateLostResponse = false) => {
      setPhase("paying");
      setMessage(null);
      const result = await paymentController.pay(orderId, { simulateLostResponse });
      await refreshRecord();
      if (result.kind === "paid") {
        setPhase("idle");
        await confirmPaid(result.order, result);
      } else if (result.kind === "uncertain") {
        haptics.warning();
        setPhase("uncertain");
        setMessage(result.message);
      } else {
        haptics.error();
        setPhase("refused");
        setMessage(result.message);
      }
    },
    [confirmPaid, orderId, refreshRecord],
  );

  const checkStatus = useCallback(async () => {
    setPhase("checking");
    const status = await paymentController.checkStatus(orderId);
    if (status.kind === "paid") {
      setPhase("idle");
      await confirmPaid(status.order, { alreadyRecorded: true, paidElsewhere: false });
    } else if (status.kind === "pending") {
      client.setQueryData(queryKeys.order(orderId), status.order);
      setPhase("idle");
      setMessage("Le paiement n'a pas été enregistré par le serveur. Vous pouvez le relancer : le même identifiant sera utilisé, sans risque de double débit.");
    } else {
      setPhase("uncertain");
      setMessage(status.message);
    }
  }, [client, confirmPaid, orderId]);

  return { phase, message, record, pay, retry: () => pay(false), checkStatus, dismissRefusal: () => setPhase("idle") };
}
