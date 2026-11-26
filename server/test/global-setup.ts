import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/**
 * Les tests tournent contre un VRAI PostgreSQL (pas un simulateur) : c'est
 * indispensable pour vérifier les verrous et les transactions concurrentes
 * qui empêchent le double paiement.
 */
export default async function setup(project: TestProject) {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), "ziko-pg-"));
  const port = 55_000 + Math.floor(Math.random() * 5_000);
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "test",
    password: "test",
    port,
    persistent: false,
    onLog: () => undefined,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase("ziko_test");
  project.provide("databaseUrl", `postgres://test:test@localhost:${port}/ziko_test`);

  return async () => {
    await pg.stop();
    await rm(dataDir, { recursive: true, force: true });
  };
}
