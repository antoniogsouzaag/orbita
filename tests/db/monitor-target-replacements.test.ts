import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db";
import { opsEvents, opsStatus, opsHeartbeats } from "@/db/schema";
import { ingest, IngestSchema, liveOps } from "@/server/ops-live";
import { reconcileStoredMonitorTargets } from "@/server/monitor-target-replacements";
import { reconcileMonitorTargets } from "@/server/monitor-target-replacements";

describe.each([
 ["https://pack-canva.pages.dev/", "https://pack.lojalabs.com.br/"],
 ["https://lp.aglabs.app.br/", "https://aglabs.app.br/sobre"],
])("substituição autorizada %s → %s", (oldUrl, newUrl) => {
const run = (urls: string[], source = "n8n-vps03-ping", status = 200) => ingest(IngestSchema.parse({source, links:urls.map(url=>({url,nome:"Pack Canva",status}))}));
beforeEach(async () => {
 const db = await getDb(); await db.delete(opsEvents); await db.delete(opsStatus);
 await run([oldUrl], undefined, 503); await run([oldUrl], undefined, 503);
});
it("arquiva o estado anterior, resolve como substituição e não inventa recuperação", async () => {
 await run([newUrl]); await run([newUrl]);
 const db = await getDb(), status = await db.select().from(opsStatus), events = await db.select().from(opsEvents);
 expect(status.map(s=>s.url)).toEqual([newUrl]);
 const down = events.find(e=>e.kind === "site_down")!;
 expect(down.resolvedAt).not.toBeNull(); expect(down.detail.resolution).toMatchObject({reason:"target_replaced",replacementUrl:newUrl});
 expect(events.filter(e=>e.kind === "site_up")).toHaveLength(0);
 const archived = events.filter(e=>e.kind === "site_target_replaced"); expect(archived).toHaveLength(1);
 expect(archived[0].detail.previous).toMatchObject({url:oldUrl,ok:false,fails:2});
});
it("não retira endereço ainda recebido nem usa nome para inferir outra troca", async () => {
 await run([oldUrl,newUrl],undefined,503);
 await run(["https://outro.example/"]);
 expect((await (await getDb()).select().from(opsStatus)).map(s=>s.url)).toContain(oldUrl);
 expect((await (await getDb()).select().from(opsEvents)).find(e=>e.kind === "site_down")!.resolvedAt).toBeNull();
});
it("não retira por outra fonte ou sem receipt exato", async () => {
 await run([newUrl], "outra-fonte");
 expect(await reconcileMonitorTargets("n8n-vps03-ping",[newUrl],new Date())).toBe(0);
 const at = new Date();
 await (await getDb()).delete(opsStatus);
 await run([oldUrl],undefined,503); await run([oldUrl],undefined,503);
 expect(await reconcileMonitorTargets("n8n-vps03-ping",[newUrl],at)).toBe(0);
 expect((await (await getDb()).select().from(opsStatus)).map(s=>s.url)).toContain(oldUrl);
});
it("mantém falhas reais do novo destino sem reaproveitar o estado do antigo", async () => {
 await run([newUrl],undefined,503); await run([newUrl],undefined,503);
 const db=await getDb(), statuses=await db.select().from(opsStatus), events=await db.select().from(opsEvents);
 expect(statuses).toHaveLength(1); expect(statuses[0]).toMatchObject({url:newUrl,ok:false,fails:2});
 expect(events.find(e=>e.kind === "site_down" && e.detail.url === newUrl)?.resolvedAt).toBeNull();
});

it("preserva o monitor independente da raiz do app", async () => {
 await run(["https://aglabs.app.br/"], undefined, 503);
 await run(["https://aglabs.app.br/"], undefined, 503);
 await run([newUrl]);
 const status = await (await getDb()).select().from(opsStatus);
 expect(status.find(s => s.url === "https://aglabs.app.br/")).toMatchObject({ok:false,fails:2});
 expect(status.some(s => s.url === oldUrl)).toBe(false);
 expect(status.some(s => s.url === newUrl)).toBe(true);
});

it("reconcilia receipt anterior ao deploy sem refazer check ou batida", async () => {
 const db=await getDb(), at=new Date(Date.now()+60_000), beats=await db.select().from(opsHeartbeats);
 await db.insert(opsStatus).values({url:newUrl,name:"Pack Canva",source:"n8n-vps03-ping",ok:true,checkedAt:at,changedAt:at});
 const live = await liveOps();
 // Future receipts never authorize reconciliation.
 expect(live.status.some(s=>s.url===oldUrl)).toBe(true);
 const after = await reconcileStoredMonitorTargets(await db.select().from(opsStatus),at.getTime()+1);
 expect(after).toBeLessThanOrEqual(1);
 expect((await db.select().from(opsStatus)).map(s=>s.url)).toEqual([newUrl]);
 expect((await db.select().from(opsStatus))[0].checkedAt).toEqual(at);
 expect(await db.select().from(opsHeartbeats)).toEqual(beats);
});

});
