import { createApp } from "./app.js";
import { config } from "./config.js";
import { runMigrations } from "./db/migrate.js";
import { createPool } from "./db/pool.js";
import { seedIfEmpty } from "./db/seed.js";

const db = createPool(config.DATABASE_URL, config.DATABASE_SSL);

const applied = await runMigrations(db);
if (applied.length > 0) console.log(`Migrations appliquées : ${applied.join(", ")}`);

if (config.SEED_ON_START) {
  const added = await seedIfEmpty(db);
  if (added > 0) console.log(`Boutique initialisée avec ${added} produits.`);
}

const server = createApp(db, config).listen(config.PORT, () => {
  console.log(`ZIKO SHOP API à l'écoute sur le port ${config.PORT}`);
});

// Arrêt propre (Render envoie SIGTERM lors d'un redéploiement) : on termine les
// requêtes en cours avant de fermer la connexion à la base.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`${signal} reçu, arrêt en cours…`);
    server.close(() => {
      void db.end().then(() => process.exit(0));
    });
  });
}
