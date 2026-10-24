import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src"), "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    environment: "node",
    env: { APP_TIMEZONE: "America/Sao_Paulo", PGLITE_DIR: "memory", DATABASE_URL: "" },
    testTimeout: 30_000,
    hookTimeout: 30_000, // PGlite + migrations can exceed 10s on Windows cold filesystem.
  },
});
