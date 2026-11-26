/**
 * Règles du panier, sans React ni stockage : faciles à tester.
 * Le panier ne contient que des identifiants et des quantités ; le nom, le
 * prix et le stock viennent toujours du serveur.
 */

/** Pièces maximum par article (comme pour une commande directe). */
export const MAX_PER_LINE = 10;
/** Articles différents maximum (limite de l'API). */
export const MAX_LINES = 20;

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  /**
   * Passage en caisse en cours : même contenu = même clé d'idempotence, donc
   * renvoyer le panier (réseau coupé, retour arrière) ne crée pas deux commandes.
   */
  checkout: { key: string; signature: string; orderId: string | null } | null;
}

export const emptyCart: CartState = { lines: [], checkout: null };

const clamp = (quantity: number, max = MAX_PER_LINE) => Math.max(1, Math.min(Math.floor(quantity), max));

/** Ajoute un article, ou augmente sa quantité s'il est déjà dans le panier. */
export function addLine(lines: CartLine[], productId: string, quantity = 1, max = MAX_PER_LINE): CartLine[] {
  const existing = lines.find((line) => line.productId === productId);
  if (existing) return lines.map((line) => (line === existing ? { ...line, quantity: clamp(line.quantity + quantity, max) } : line));
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { productId, quantity: clamp(quantity, max) }];
}

export function setLineQuantity(lines: CartLine[], productId: string, quantity: number, max = MAX_PER_LINE): CartLine[] {
  if (quantity <= 0) return removeLine(lines, productId);
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: clamp(quantity, max) } : line));
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

/** Nombre total de pièces (pastille de l'onglet Panier). */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Empreinte du contenu : change dès qu'un article ou une quantité change. */
export function cartSignature(lines: CartLine[]): string {
  return lines.map((line) => `${line.productId}x${line.quantity}`).join("|");
}

/**
 * Clé d'idempotence à envoyer pour ce panier : on réutilise celle du
 * précédent envoi si le contenu n'a pas changé, sinon on en crée une neuve.
 */
export function checkoutKeyFor(state: CartState, newKey: () => string): { key: string; signature: string } {
  const signature = cartSignature(state.lines);
  if (state.checkout && state.checkout.signature === signature) return { key: state.checkout.key, signature };
  return { key: newKey(), signature };
}

/** La commande issue du panier est payée : le panier se vide. Sinon, rien ne change. */
export function afterOrderPaid(state: CartState, orderId: string): CartState {
  return state.checkout?.orderId === orderId ? emptyCart : state;
}
