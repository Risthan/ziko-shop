import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Démarre un vrai PostgreSQL jetable pour toute la suite de tests.
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
