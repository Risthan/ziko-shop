import { DEFAULT_SIZE, isSize, type Size } from "../sizes.ts";

/**
 * Règles du panier, sans React ni stockage : faciles à tester.
 * Le panier ne contient que des identifiants, des quantités et des tailles ;
 * le nom, le prix et le stock viennent toujours du serveur.
 *
 * Une couleur n'apparaît qu'une fois dans le panier, avec UNE taille : c'est
 * la règle de l'API (une ligne par produit et par commande), qui garde le
 * paiement et le décompte du stock inchangés.
 */

/** Pièces maximum par article (comme pour une commande directe). */
export const MAX_PER_LINE = 10;
/** Articles différents maximum (limite de l'API). */
export const MAX_LINES = 20;

export interface CartLine {
  productId: string;
  quantity: number;
  size: Size;
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

/**
 * La taille déjà au panier pour cette couleur, si on en demande une AUTRE.
 * Sans taille précisée (bouton « + » rapide), il n'y a jamais de conflit.
 */
export function sizeConflict(lines: CartLine[], productId: string, size?: Size): Size | null {
  const existing = lines.find((line) => line.productId === productId);
  return existing && size && existing.size !== size ? existing.size : null;
}

/**
 * Ajoute un article, ou augmente sa quantité s'il est déjà dans le panier.
 * Sans taille précisée : celle déjà au panier, sinon M. Une autre taille pour
 * une couleur déjà présente ne change rien (voir `sizeConflict`).
 */
export function addLine(lines: CartLine[], productId: string, quantity = 1, max = MAX_PER_LINE, size?: Size): CartLine[] {
  const existing = lines.find((line) => line.productId === productId);
  if (existing) {
    if (size && size !== existing.size) return lines;
    return lines.map((line) => (line === existing ? { ...line, quantity: clamp(line.quantity + quantity, max) } : line));
  }
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, { productId, quantity: clamp(quantity, max), size: size ?? DEFAULT_SIZE }];
}

export function setLineQuantity(lines: CartLine[], productId: string, quantity: number, max = MAX_PER_LINE): CartLine[] {
  if (quantity <= 0) return removeLine(lines, productId);
  return lines.map((line) => (line.productId === productId ? { ...line, quantity: clamp(quantity, max) } : line));
}

/** Change la taille d'un article du panier. */
export function setLineSize(lines: CartLine[], productId: string, size: Size): CartLine[] {
  return lines.map((line) => (line.productId === productId ? { ...line, size } : line));
}

export function removeLine(lines: CartLine[], productId: string): CartLine[] {
  return lines.filter((line) => line.productId !== productId);
}

/** Relit un panier enregistré : les paniers d'avant les tailles passent en M. */
export function normalizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const line = entry as Partial<CartLine> | null;
    if (!line || typeof line.productId !== "string" || typeof line.quantity !== "number") return [];
    return [{ productId: line.productId, quantity: clamp(line.quantity), size: isSize(line.size) ? line.size : DEFAULT_SIZE }];
  });
}

/** Nombre total de pièces (pastille de l'onglet Panier). */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

/** Empreinte du contenu : change dès qu'un article, une quantité ou une taille change. */
export function cartSignature(lines: CartLine[]): string {
  return lines.map((line) => `${line.productId}:${line.size}x${line.quantity}`).join("|");
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
