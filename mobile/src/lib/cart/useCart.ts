import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "../storage";
import {
  addLine,
  afterOrderPaid,
  cartCount,
  checkoutKeyFor,
  emptyCart,
  removeLine,
  setLineQuantity,
  type CartLine,
  type CartState,
} from "./cartLogic";

const KEY = "ziko:cart:v1";

/**
 * Le panier vit sur le téléphone (il survit à la fermeture de l'app).
 * Un petit magasin partagé : chaque écran qui l'affiche se met à jour seul.
 */
let state: CartState = emptyCart;
const listeners = new Set<() => void>();

function update(next: CartState) {
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
  void writeJson(KEY, state);
}

void readJson<CartState>(KEY, emptyCart).then((saved) => {
  // Ce qui a été ajouté avant la fin du chargement passe en premier.
  if (state.lines.length === 0 && Array.isArray(saved?.lines)) update({ lines: saved.lines, checkout: saved.checkout ?? null });
});

export const cart = {
  get: () => state,
  add: (productId: string, quantity = 1, max?: number) => update({ ...state, lines: addLine(state.lines, productId, quantity, max) }),
  setQuantity: (productId: string, quantity: number, max?: number) =>
    update({ ...state, lines: setLineQuantity(state.lines, productId, quantity, max) }),
  remove: (productId: string) => update({ ...state, lines: removeLine(state.lines, productId) }),
  /** Clé à envoyer avec la commande (réutilisée tant que le panier ne change pas). */
  checkoutKey: (newKey: () => string) => checkoutKeyFor(state, newKey),
  /** Retient la commande créée pour ce contenu de panier. */
  markOrdered: (key: string, signature: string, orderId: string) => update({ ...state, checkout: { key, signature, orderId } }),
  /** Appelé à chaque paiement confirmé : vide le panier si c'était SA commande. */
  orderPaid: (orderId: string) => update(afterOrderPaid(state, orderId)),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCart(): { lines: CartLine[]; count: number } {
  const current = useSyncExternalStore(subscribe, cart.get, cart.get);
  return { lines: current.lines, count: cartCount(current.lines) };
}
