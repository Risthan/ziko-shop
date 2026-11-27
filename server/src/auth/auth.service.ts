import { createHash, randomBytes } from "node:crypto";
import type { Db } from "../db/pool.js";
import { AppError } from "../http/errors.js";
import type { LoginInput, RegisterInput, UpdateProfileInput } from "./auth.schemas.js";
import { DUMMY_HASH, hashPassword, verifyPassword } from "./passwords.js";

/** Un téléphone reste connecté 30 jours sans activité, puis doit se reconnecter. */
export const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  created_at: Date;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  phone: row.phone,
  createdAt: row.created_at.toISOString(),
});

const USER_COLUMNS = "id, email, full_name, phone, created_at";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const errorsAuth = {
  required: () => new AppError(401, "AUTH_REQUIRED", "Connectez-vous pour continuer."),
  expired: () => new AppError(401, "SESSION_EXPIRED", "Votre session a expiré. Reconnectez-vous."),
  invalidCredentials: () => new AppError(401, "INVALID_CREDENTIALS", "Adresse e-mail ou mot de passe incorrect."),
  emailUsed: () =>
    new AppError(409, "EMAIL_ALREADY_USED", "Un compte existe déjà avec cette adresse e-mail. Connectez-vous plutôt.", {
      fields: [{ path: "email", message: "Adresse déjà utilisée." }],
    }),
};

/** Ouvre une session : le jeton n'est renvoyé qu'une fois, la base n'en garde que l'empreinte. */
async function openSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [userId, hashToken(token), SESSION_DAYS],
  );
  return token;
}

export async function register(db: Db, input: RegisterInput): Promise<{ user: User; token: string }> {
  const passwordHash = await hashPassword(input.password);
  try {
    const { rows } = await db.query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, phone) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLUMNS}`,
      [input.email, passwordHash, input.fullName, input.phone ?? null],
    );
    const user = toUser(rows[0]!);
    return { user, token: await openSession(db, user.id) };
  } catch (error) {
    if ((error as { code?: string; constraint?: string }).constraint === "users_email_key") throw errorsAuth.emailUsed();
    throw error;
  }
}

export async function login(db: Db, input: LoginInput): Promise<{ user: User; token: string }> {
  const { rows } = await db.query<UserRow & { password_hash: string }>(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`,
    [input.email],
  );
  const row = rows[0];
  // Même calcul que l'adresse existe ou non : on ne révèle pas qui a un compte.
  const valid = await verifyPassword(input.password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !valid) throw errorsAuth.invalidCredentials();
  return { user: toUser(row), token: await openSession(db, row.id) };
}

/** Le client derrière un jeton, ou une erreur si le jeton est inconnu ou expiré. */
export async function userFromToken(db: Db, token: string): Promise<User> {
  const { rows } = await db.query<UserRow & { session_id: string }>(
    `UPDATE sessions s SET last_used_at = now(), expires_at = now() + make_interval(days => $2)
     FROM users u
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id
     RETURNING u.id, u.email, u.full_name, u.phone, u.created_at, s.id AS session_id`,
    [hashToken(token), SESSION_DAYS],
  );
  const row = rows[0];
  if (!row) throw errorsAuth.expired();
  return toUser(row);
}

export async function logout(db: Db, token: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function updateProfile(db: Db, userId: string, input: UpdateProfileInput): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone = CASE WHEN $3::boolean THEN $4 ELSE phone END
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, input.fullName ?? null, input.phone !== undefined, input.phone ?? null],
  );
  return toUser(rows[0]!);
}

/**
 * Suppression du compte (exigée par les boutiques d'applications). Les
 * sessions disparaissent ; les commandes restent (données comptables), sans
 * lien vers la personne.
 */
export async function deleteAccount(db: Db, userId: string, password: string): Promise<void> {
  const { rows } = await db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [userId]);
  if (!rows[0] || !(await verifyPassword(password, rows[0].password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Mot de passe incorrect. Votre compte n'a pas été supprimé.");
  }
  await db.query("DELETE FROM users WHERE id = $1", [userId]);
}
