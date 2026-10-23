// Aplica migrations pendentes antes do build (Vercel). Sem DATABASE_URL, não faz nada.
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("[migrate] DATABASE_URL ausente — pulando migrations");
  process.exit(0);
}
const migrationsFolder = path.join(process.cwd(), "drizzle");
try {
  if (/neon\.tech/.test(url)) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    await migrate(drizzle(neon(url)), { migrationsFolder });
  } else {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder });
    await client.end();
  }
  console.log("[migrate] banco atualizado");
} catch (e) {
  console.error("[migrate] falhou:", e instanceof Error ? e.message : e);
  process.exit(1);
}
