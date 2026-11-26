// `npm run db:local` : lance un vrai PostgreSQL local, sans Docker ni installation.
// Les données sont gardées dans server/.pgdata. Ctrl+C pour l'arrêter.
import EmbeddedPostgres from "embedded-postgres";

const PORT = 5433;
const pg = new EmbeddedPostgres({
  databaseDir: ".pgdata",
  user: "ziko",
  password: "ziko",
  port: PORT,
  persistent: true,
  onLog: () => undefined,
});

try {
  await pg.initialise();
} catch {
  // Déjà initialisée lors d'un précédent lancement.
}
await pg.start();
await pg.createDatabase("ziko_shop").catch(() => undefined);

console.log("PostgreSQL local prêt. Dans server/.env, mettez :");
console.log(`DATABASE_URL=postgres://ziko:ziko@localhost:${PORT}/ziko_shop`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
