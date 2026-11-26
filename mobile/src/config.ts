/**
 * Adresse de l'API. En développement, définissez EXPO_PUBLIC_API_URL dans
 * mobile/.env (ex. http://192.168.1.20:3000 pour un téléphone sur le même
 * Wi-Fi). Sinon, l'app utilise le serveur en ligne.
 */
const PRODUCTION_API_URL = "https://ziko-shop-api.onrender.com";

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/+$/, "");

/** Transforme un chemin d'image relatif (« /images/… ») en adresse complète. */
export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_URL}${path}`;
}
