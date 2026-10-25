import { beforeEach, expect, it } from "vitest";
import { getDb } from "@/db";
import { notes } from "@/db/schema";
import { buscarNotas, assistantTools } from "@/server/assistant";

beforeEach(async () => { const db = await getDb(); await db.delete(notes); });

it("returns notes across days beyond the former five-result cut without silent omissions", async () => {
  const db = await getDb();
  await db.insert(notes).values(Array.from({ length: 6 }, (_, i) => ({ title: `Refino UI ${i + 1}`, content: `Detalhe ${i + 1}`, updatedAt: new Date(`2026-10-${20 + i}T12:00:00Z`) })));
  const result = await buscarNotas.run({ busca: "Refino UI" });
  for (let i = 1; i <= 6; i++) expect(result.text).toContain(`Refino UI ${i}`);
  expect(result.text).toContain("2026-10-20T12:00:00.000Z");
  expect(result.text).not.toContain("Consulta parcial");
  const limited = await buscarNotas.run({ busca: "Refino UI", limite: 2 });
  expect(limited.text).toContain("Refino UI 6");
  expect(limited.text).not.toContain("Refino UI 1");
  expect(limited.text).toContain("Consulta parcial");
});

it("marks content truncation and makes scoped notes available in both workspaces", async () => {
  const db = await getDb();
  await db.insert(notes).values({ title: "Texto longo", content: "a".repeat(2100) });
  expect((await buscarNotas.run({ busca: "Texto longo" })).text).toContain("Conteúdo parcial");
  expect(assistantTools("empresa").some(tool => tool.name === "buscar_notas")).toBe(true);
  expect(buscarNotas.schema.safeParse({ busca: "UI", limite: 1000 }).success).toBe(false);
});
