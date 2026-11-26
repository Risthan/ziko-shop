// `npm run seed` : applique les migrations puis ajoute les 9 pulls si la boutique est vide.
import { config } from "../src/config.js";
import { runMigrations } from "../src/db/migrate.js";
import { createPool } from "../src/db/pool.js";
import { seedIfEmpty } from "../src/db/seed.js";

const db = createPool(config.DATABASE_URL, config.DATABASE_SSL);
await runMigrations(db);
const added = await seedIfEmpty(db);
console.log(added > 0 ? `${added} produits ajoutés.` : "La boutique contient déjà des produits : rien à faire.");
await db.end();
