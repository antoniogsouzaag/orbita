import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __orbitaDb?: Promise<DB> };

/**
 * Escolhe o driver pelo ambiente:
 * - DATABASE_URL do Neon → driver HTTP do Neon (serverless, ideal na Vercel)
 * - outra DATABASE_URL → postgres-js (VPS/EasyPanel)
 * - sem DATABASE_URL → PGlite local em `.data/pglite` (dev) com migrations automáticas
 */
async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url && /neon\.tech/.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    return drizzle(neon(url), { schema }) as unknown as DB;
  }
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return drizzle(postgres(url, { max: 5 }), { schema }) as unknown as DB;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (dir !== "memory") await mkdir(dir, { recursive: true });
  const client = new PGlite(dir === "memory" ? undefined : dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalForDb.__orbitaDb ??= createDb().catch((e) => {
    globalForDb.__orbitaDb = undefined; // permite nova tentativa
    throw e;
  });
  return globalForDb.__orbitaDb;
}

export { schema };
