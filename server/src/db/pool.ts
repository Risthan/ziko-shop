import pg from "pg";

export type Db = pg.Pool;
export type DbClient = pg.PoolClient;

export function createPool(connectionString: string, ssl = false): Db {
  return new pg.Pool({
    connectionString,
    // Le certificat du serveur est toujours vérifié (pas de rejectUnauthorized: false).
    ssl: ssl ? { rejectUnauthorized: true } : undefined,
    max: 10,
    // Une requête bloquée ne doit jamais garder un client indéfiniment.
    statement_timeout: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Exécute `work` dans une transaction. COMMIT si tout se passe bien,
 * ROLLBACK si une erreur est levée : aucune écriture partielle possible.
 */
export async function withTransaction<T>(db: Db, work: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
