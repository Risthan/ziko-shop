import * as Crypto from "expo-crypto";

/**
 * Identifiant de paiement, comme celui que renverrait un opérateur Mobile Money.
 * Il est créé UNE fois par commande, puis réutilisé à chaque nouvelle tentative :
 * c'est ce qui permet au serveur de reconnaître un paiement déjà enregistré.
 */
export function newPaymentId(): string {
  return `MM-${Crypto.randomUUID()}`;
}

/** Clé d'idempotence de création de commande (même principe que l'identifiant de paiement). */
export function newIdempotencyKey(): string {
  return `CMD-${Crypto.randomUUID()}`;
}
