import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Mots de passe : scrypt (inclus dans Node, aucune dépendance), avec un sel
 * aléatoire par compte. Format stocké : « scrypt$N$r$p$sel$empreinte ».
 * Coûteux à calculer exprès, pour ralentir toute tentative de cassage.
 */
const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Comparaison à temps constant : la durée ne révèle rien du mot de passe attendu. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !expected) return false;
  const key = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
  const wanted = Buffer.from(expected, "base64url");
  return key.length === wanted.length && timingSafeEqual(key, wanted);
}

/** Empreinte de remplacement : même temps de calcul quand l'adresse n'existe pas. */
export const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86);
