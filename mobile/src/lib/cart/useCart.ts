import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "../storage";
import type { Size } from "../sizes";
import {
  addLine,
  afterOrderPaid,
  cartCount,
  checkoutKeyFor,
  emptyCart,
  normalizeLines,
  removeLine,
  setLineQuantity,
  setLineSize,
  sizeConflict,
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
  if (state.lines.length === 0 && Array.isArray(saved?.lines)) update({ lines: normalizeLines(saved.lines), checkout: saved.checkout ?? null });
});

export const cart = {
  get: () => state,
  /**
   * Ajoute un pull dans la taille choisie (sans taille : celle déjà au panier, sinon M).
   * Renvoie la taille déjà au panier si cette couleur y est dans une autre taille :
   * rien n'est ajouté, l'écran le signale (une seule taille par couleur et par commande).
   */
  add: (productId: string, quantity = 1, max?: number, size?: Size): { added: boolean; conflict: Size | null } => {
    const conflict = sizeConflict(state.lines, productId, size);
    if (conflict) return { added: false, conflict };
    update({ ...state, lines: addLine(state.lines, productId, quantity, max, size) });
    return { added: true, conflict: null };
  },
  setQuantity: (productId: string, quantity: number, max?: number) =>
    update({ ...state, lines: setLineQuantity(state.lines, productId, quantity, max) }),
  setSize: (productId: string, size: Size) => update({ ...state, lines: setLineSize(state.lines, productId, size) }),
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
