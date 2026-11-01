import { beforeEach, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { opsEvents } from "@/db/schema";
import { today, shiftDate, zonedToUtc } from "@/lib/dates";
import { journalFeed, submitJournalArticle } from "@/server/journal";
import { liveOps, opsEventsByDay } from "@/server/ops-live";
import { POST } from "@/app/api/mcp/route";
import { createAgentToken } from "@/server/agents";
import { assistantTools } from "@/server/assistant";

const actor = { id: "author-1", name: "Pesquisa autorizada" };
const input = () => ({ registro_id: "11111111-1111-4111-8111-111111111111", data: today(), secao: "ia", titulo: "Pesquisa com fontes", resumo: "Resumo da pesquisa do dia, sem dados pessoais.", conteudo: "Uma análise atribuída à fonte primária, sem fingir verificação independente.", fontes: [{ titulo: "Fonte de exemplo", url: "https://example.test/research" }], destaque: true });
beforeEach(async () => { await (await getDb()).delete(opsEvents); });
async function rpc(token: string, method: string, params: object) {
  const response = await POST(new Request("http://localhost/api/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: `Bearer ${token}` }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) }));
  return response.json();
}
it("retries concorrentes geram um registro, com recibo igual e identidade autenticada", async () => {
  const [a, b] = await Promise.all([submitJournalArticle(actor, input()), submitJournalArticle(actor, input())]);
  expect(a.id).toBe(b.id);
  expect([a.repetido, b.repetido].sort()).toEqual([false, true]);
  const rows = await (await getDb()).select().from(opsEvents);
  expect(rows).toHaveLength(1);
  expect(rows[0].source).toBe("jornal:author-1");
  expect((await journalFeed()).articles[0]).toMatchObject({ autor: actor.name, legado: false });
  await expect(submitJournalArticle(actor, { ...input(), titulo: "Conteúdo alterado" })).rejects.toThrow("outro conteúdo");
  const other = await submitJournalArticle({ id: "author-2", name: "Outro autor" }, input());
  expect(other.id).not.toBe(a.id);
});
it("recusa edições futuras ou fora da janela sem gravar", async () => {
  for (const data of [shiftDate(today(), 1), shiftDate(today(), -31)]) await expect(submitJournalArticle(actor, { ...input(), data })).rejects.toThrow("últimos 30 dias");
  expect(await (await getDb()).select().from(opsEvents)).toEqual([]);
});
it("matérias não competem com alertas e gráficos operacionais", async () => {
  await submitJournalArticle(actor, input());
  await (await getDb()).insert(opsEvents).values({ kind: "agente_alerta", severity: "warning", source: "fixture", subject: "Alerta real" });
  expect((await liveOps()).events.map(event => event.subject)).toEqual(["Alerta real"]);
  expect((await opsEventsByDay()).some(row => row.kind === "jornal_materia")).toBe(false);
});
it("resumos legados usam a data de São Paulo e não ganham editoria de notícias por inferência", async () => {
  const db = await getDb();
  const start = zonedToUtc(today());
  await db.insert(opsEvents).values([
    { kind: "agente_resumo", source: "agente:tom", subject: "Resumo dentro da edição", detail: { message: "Triagem recebida", agent: "Tom" }, createdAt: start },
    { kind: "agente_resumo", source: "agente:tom", subject: "Resumo de ontem", detail: {}, createdAt: new Date(start.getTime() - 1) },
  ]);
  const feed = await journalFeed();
  expect(feed.articles).toHaveLength(1);
  expect(feed.articles[0]).toMatchObject({ titulo: "Resumo dentro da edição", legado: true, secao: "operacao", fontes: [] });
});
it("MCP preserva escopos e expõe guia/recibo sem dados pessoais ou financeiros", async () => {
  expect(assistantTools("pessoal").some(tool => tool.name === "consultar_jornal")).toBe(false);
  expect(assistantTools("empresa", { readOnly: true }).find(tool => tool.name === "consultar_jornal")?.readOnly).toBe(true);
  const reader = await createAgentToken("Leitor Jornal", ["status"]);
  const writer = await createAgentToken("Remetente Jornal", ["eventos"]);
  const context = await createAgentToken("Contexto Jornal", ["contexto"]);
  for (const [token, expected, denied] of [[reader, "consultar_jornal", "enviar_materia_jornal"], [writer, "enviar_materia_jornal", "consultar_jornal"]]) {
    const list = await rpc(token, "tools/list", {});
    const names = list.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toContain(expected); expect(names).not.toContain(denied);
    expect(names).not.toContain("orbita_consultar_jornal");
  }
  const denied = await rpc(context, "tools/call", { name: "enviar_materia_jornal", arguments: input() });
  expect(denied.result?.isError ?? !!denied.error).toBe(true);
  const sent = await rpc(writer, "tools/call", { name: "enviar_materia_jornal", arguments: input() });
  expect(sent.result.structuredContent).toMatchObject({ data: today(), repetido: false });
  const repeat = await rpc(writer, "tools/call", { name: "enviar_materia_jornal", arguments: input() });
  expect(repeat.result.structuredContent).toMatchObject({ id: sent.result.structuredContent.id, repetido: true });
  const read = await rpc(reader, "tools/call", { name: "consultar_jornal", arguments: { data: today() } });
  expect(read.result.structuredContent.materias[0]).toMatchObject({ autor: "Remetente Jornal", titulo: input().titulo });
  expect(JSON.stringify(read.result.structuredContent)).not.toMatch(/conteudo|receita_mes|agenda|contacts/);
  const guide = await rpc(reader, "resources/read", { uri: "orbita://jornal/guia" });
  expect(guide.result.contents[0].text).toContain("registro_id");
  const quick = await rpc(reader, "tools/call", { name: "documentacao", arguments: { secao: "inicio" } });
  expect(quick.result.content[0].text.length).toBeLessThan(2500);
  const [row] = await (await getDb()).select().from(opsEvents).where(eq(opsEvents.id, sent.result.structuredContent.id));
  expect(row.detail.author).toBe("Remetente Jornal");
});
