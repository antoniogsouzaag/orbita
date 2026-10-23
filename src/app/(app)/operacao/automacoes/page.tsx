import { AlertTriangle, CheckCircle2, CircleDashed, Workflow, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { n8nOverview } from "@/server/ops";
import { liveOps } from "@/server/ops-live";
import { VaultBanner } from "@/components/vault/vault-banner";
import { getVaultIndexSafe } from "@/server/vault";

export const metadata = { title: "Automações" };

export default async function Page() {
  const [n8n, live] = await Promise.all([n8nOverview(), liveOps()]);
  const notePath = (await getVaultIndexSafe())?.resolve("Automações Ativas") ?? null;
  const sourcesVerified = n8n.configured && n8n.instances.every((instance) => instance.ok);
  const liveIds = new Set(n8n.instances.flatMap((i) => i.workflows.map((w) => w.id)));
  const missing = sourcesVerified ? n8n.documented.filter((d) => d.id && /^[A-Za-z0-9]{8,}$/.test(d.id) && !liveIds.has(d.id) && /n8n/i.test(d.where)) : [];
  const pushed = live.events.filter((e) => e.kind === "workflow_error");
  const pushedUrls = new Set(pushed.map((event) => String(event.detail.executionUrl ?? "")).filter(Boolean));
  const apiErrors = n8n.instances.flatMap((i) => i.errors).filter((error) => !pushedUrls.has(error.url));

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
      <PageHeader
        icon={<Workflow />}
        title="Automações"
        description={<>Estado ao vivo dos workflows. A descrição de cada automação está em <Link className="text-accent hover:underline" href={notePath ? `/vault?p=${encodeURIComponent(notePath)}` : "/vault"}>Automações Ativas</Link> no vault.</>}
      />

      <VaultBanner />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
      {n8n.configured ? (
        <>
          {missing.length > 0 && (
            <Card className="border-warning/40 p-4 text-[13px]">
              <div className="mb-1 font-medium text-warning">Documentado no vault, mas não encontrado no n8n ({missing.length})</div>
              {missing.map((m) => <div key={m.id} className="text-muted">{m.name} · <code className="font-mono text-[11.5px]">{m.id}</code> · {m.where}</div>)}
            </Card>
          )}
          {n8n.instances.map((inst) => (
            <section key={inst.name}>
              <SectionLabel className="mb-3">n8n · {inst.name}</SectionLabel>
              {!inst.ok ? (
                <Card className="p-4 text-[13px] text-danger">{inst.error}</Card>
              ) : (
                <Card className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead><tr className="border-b border-border text-left text-[12px] text-faint"><th className="px-4 py-2 font-medium">Workflow</th><th className="px-4 py-2 font-medium">Estado</th><th className="px-4 py-2 font-medium">Vault</th><th className="px-4 py-2 font-medium">Atualizado</th></tr></thead>
                    <tbody>
                      {[...inst.workflows].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)).map((w) => (
                        <tr key={w.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2"><a href={`${inst.url}/workflow/${w.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{w.name}</a></td>
                          <td className="px-4 py-2">{w.active ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" />ativo</span> : <span className="flex items-center gap-1 text-faint"><CircleDashed className="size-3.5" />inativo</span>}</td>
                          <td className="px-4 py-2 text-[12px]">{w.documented ? <span className="text-muted">documentado</span> : w.active ? <span className="text-warning">não documentado</span> : <span className="text-faint">—</span>}</td>
                          <td className="px-4 py-2 text-[12px] text-faint">{new Date(w.updatedAt).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </section>
          ))}
        </>
      ) : (
        <Card className="p-5 text-[13px] text-muted">
          Para listar os workflows ao vivo (ativos, inativos e quais não estão documentados no vault), crie uma chave em cada n8n (Settings → n8n API) e defina <code>N8N_INSTANCES</code>. Veja <Link href="/integracoes" className="text-accent hover:underline">Integrações</Link>.
        </Card>
      )}
      </div>
      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <SectionLabel className="mb-3">Falhas recentes</SectionLabel>
        <Card className="max-h-[65dvh] overflow-y-auto divide-y divide-border">
          {pushed.length + apiErrors.length === 0 && <p className="p-4 text-[12px] text-muted">{sourcesVerified ? "Nenhuma falha retornada pelas consultas atuais." : "Nenhuma falha recebida por ingestão. A consulta às APIs n8n está incompleta; isso não confirma ausência de falhas."}</p>}
          {pushed.map((e) => {
            const d = e.detail as { node?: string; message?: string; executionUrl?: string };
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px]">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{e.subject}</span><span className="block truncate text-[12px] text-faint">{d.node ? `nó ${d.node} · ` : ""}{d.message}</span></span>
                <span className="shrink-0 text-[12px] text-faint">{e.source} · {e.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                {d.executionUrl && <a href={d.executionUrl} target="_blank" rel="noreferrer" className="shrink-0 text-[12px] text-accent hover:underline">abrir ↗</a>}
              </div>
            );
          })}
          {apiErrors.map((e) => (
            <a key={`${e.instance}-${e.id}`} href={e.url} target="_blank" rel="noreferrer" className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12px] hover:bg-surface-2">
              <XCircle className="size-4 text-danger" /><span className="truncate">{e.workflowName}</span><span className="ml-auto shrink-0 text-[12px] text-faint">{e.instance} · {new Date(e.startedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
            </a>
          ))}
        </Card>
      </aside>

      </div>
    </div>
  );
}
