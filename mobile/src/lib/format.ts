const NBSP = " "; // espace insécable : « 35 000 FC » ne se coupe jamais en fin de ligne

/** Formate un prix en francs congolais : 35000 -> « 35 000 FC ». */
export function formatCdf(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${grouped}${NBSP}FC`;
}

/** « Le Classique — Noir » -> { model: "Le Classique", color: "Noir" }. */
export function splitProductName(name: string): { model: string; color: string | null } {
  const [model, color] = name.split(/\s+[—–-]\s+/, 2);
  return { model: (model ?? name).trim(), color: color?.trim() || null };
}

/** Minuscules sans accents, pour une recherche tolérante (« creme » trouve « Crème »). */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Texte du stock affiché au client. */
export function stockLabel(stock: number): string {
  if (stock <= 0) return "Épuisé";
  if (stock <= 3) return `Plus que ${stock} en stock`;
  return `${stock} en stock`;
}

/** Numéro de commande court et lisible : les 8 premiers caractères de l'identifiant. */
export function shortOrderNumber(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
