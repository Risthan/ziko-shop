import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./pool.js";

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

// Numéro arbitraire mais fixe : empêche deux instances du serveur de lancer
// les migrations en même temps (verrou consultatif PostgreSQL).
const MIGRATION_LOCK_ID = 727_001;

/**
 * Applique, dans l'ordre, les fichiers .sql de `migrations/` qui ne l'ont pas
 * encore été. Chaque fichier passe dans sa propre transaction.
 */
export async function runMigrations(db: Db): Promise<string[]> {
  const client = await db.connect();
  const applied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const done = await client.query<{ name: string }>("SELECT name FROM schema_migrations");
    const alreadyApplied = new Set(done.rows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      if (alreadyApplied.has(file)) continue;
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        applied.push(file);
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Échec de la migration ${file}`, { cause: error });
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
    client.release();
  }
  return applied;
}
