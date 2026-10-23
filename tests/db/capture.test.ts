import { beforeAll, describe, expect, it } from "vitest";
import { POST } from "@/app/api/capture/route";
import { getDb } from "@/db";
import { notes, tasks, transactions } from "@/db/schema";
import { createCaptureToken, parseExpense, revokeCaptureToken } from "@/server/capture";

const call = (token: string | null, body: object) =>
  POST(new Request("http://localhost/api/capture", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }));

describe("atalho do iPhone", () => {
  let token = "";
  beforeAll(async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const db = await getDb();
    await db.delete(tasks);
    await db.delete(notes);
    await db.delete(transactions);
    token = await createCaptureToken();
  });

  it("recusa sem chave ou com chave errada", async () => {
    expect((await call(null, { texto: "oi" })).status).toBe(401);
    expect((await call("cap_errada_1234567890123", { texto: "oi" })).status).toBe(401);
  });

  it("cria tarefa em linguagem natural (sem IA configurada)", async () => {
    const res = await call(token, { texto: "comprar café amanhã 9h #casa" });
    expect(res.status).toBe(200);
    expect((await res.json()).mensagem).toContain("Tarefa criada");
    const db = await getDb();
    const [t] = await db.select().from(tasks);
    expect(t.tags).toEqual(["casa"]);
    expect(t.dueTime).toBe("09:00");
  });

  it("registra gasto e nota", async () => {
    expect((await (await call(token, { texto: "almoço 32,90 #alimentação", modo: "gasto" })).json()).mensagem).toContain("R$");
    expect((await (await call(token, { texto: "Ideia\nprimeira linha é o título", modo: "nota" })).json()).ok).toBe(true);
    const db = await getDb();
    expect((await db.select().from(transactions))[0]).toMatchObject({ amount: 32.9, category: "alimentação", kind: "despesa" });
    expect((await db.select().from(notes))[0].title).toBe("Ideia");
  });

  it("entende valores falados", () => {
    expect(parseExpense("gastei 12 reais no café")).toMatchObject({ valor: 12, descricao: "café" });
    expect(parseExpense("uber R$ 23.90 #transporte")).toMatchObject({ valor: 23.9, categoria: "transporte" });
    expect(parseExpense("sem número")).toBeNull();
  });

  it("chave revogada para de funcionar", async () => {
    await revokeCaptureToken();
    expect((await call(token, { texto: "teste" })).status).toBe(401);
  });
});
