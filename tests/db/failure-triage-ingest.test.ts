import { describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { IngestSchema, ingest } from "@/server/ops-live";

const fail = (workflow: string, message: string) => ingest(IngestSchema.parse({ source: "n8n-teste-triagem", workflowError: { workflow, node: "HTTP Request", message } }));
const last = async (workflow: string) => {
  const db = await getDb();
  const [row] = await db.select().from(opsEvents).where(eq(opsEvents.subject, workflow)).orderBy(desc(opsEvents.createdAt)).limit(1);
  return row.detail as Record<string, unknown>;
};

describe("falha de workflow recebida com causa provável", () => {
  it("grava a causa quando a mensagem entrega e preserva o resto do detalhe", async () => {
    await fail("triagem: credencial", "Request failed with status code 401");
    expect(await last("triagem: credencial")).toMatchObject({ node: "HTTP Request", message: "Request failed with status code 401", cause: "credencial", causeSource: "regras" });
  });

  it("sem regra e sem Jev configurado, registra a falha sem causa", async () => {
    await fail("triagem: indefinida", "Algo estranho aconteceu");
    const detail = await last("triagem: indefinida");
    expect(detail).toMatchObject({ message: "Algo estranho aconteceu" });
    expect(detail).not.toHaveProperty("cause");
  });
});
