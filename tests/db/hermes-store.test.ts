import { describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { saveHermesOperation, storedHermesHistory, storedHermesOperation } from "@/server/hermes-store";
import { reportDispatchResult } from "@/server/dispatch";
import type { HermesOperation } from "@/server/hermes";

describe("persistência comum Hermes", () => {
  it("guarda pedido e resposta da análise no mesmo registro, sem perder texto nem regredir estado final", async () => {
    const value: HermesOperation = { id: crypto.randomUUID(), action: "agent.analyze", status: "sending", text: "Analisar operação", createdAt: new Date().toISOString(), checkedAt: new Date().toISOString(), detail: "Enviando" };
    expect(await saveHermesOperation(value, {text:value.text})).toMatchObject({text:value.text});
    await saveHermesOperation({...value,status:"accepted"});
    const done = await saveHermesOperation({...value,status:"completed",responseText:"Análise pronta",agentExecution:true});
    expect(done).toMatchObject({id:value.id,text:value.text,responseText:"Análise pronta",agentExecution:true});
    expect(await saveHermesOperation({...value,status:"running"})).toEqual(done);
    expect(await storedHermesOperation(value.id)).toEqual(done);
    expect((await storedHermesHistory()).find(row=>row.id===value.id)).toEqual(done);
    expect(await reportDispatchResult("Hermes Oracle", {pedido_id:value.id,estado:"falhou",resumo:"Legado"})).toMatchObject({ok:false});
    expect(await storedHermesOperation(value.id)).toEqual(done);
  });
  it("preserva legado, migra na consulta e não regride conclusão", async () => {
    const db = await getDb();
    const legacy: HermesOperation = { id: crypto.randomUUID(), action: "diagnostics.read", status: "accepted", createdAt: "2026-10-24T10:00:00.000Z", checkedAt: "2026-10-24T10:00:00.000Z", detail: "Legado" };
    await db.insert(settings).values({ key: `hermes-operation:${legacy.id}`, value: legacy });
    expect(await storedHermesOperation(legacy.id)).toEqual(legacy);
    const done = await saveHermesOperation({ ...legacy, status: "completed", detail: "Concluído", checkedAt: "2026-10-24T11:00:00.000Z" });
    expect(done.status).toBe("completed");
    expect((await saveHermesOperation({ ...legacy, status: "unknown" })).status).toBe("completed");
    const history = await storedHermesHistory();
    expect(history.filter(row => row.id === legacy.id)).toHaveLength(1);
    expect(history.find(row => row.id === legacy.id)?.detail).toBe("Concluído");
    expect(await reportDispatchResult("Tom", { pedido_id: legacy.id, estado: "falhou", resumo: "Origem incorreta" })).toMatchObject({ ok: false });
    expect((await storedHermesOperation(legacy.id))?.status).toBe("completed");
  });
});
