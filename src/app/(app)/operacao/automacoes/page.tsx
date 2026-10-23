import { CheckCircle2, CircleDashed, FileText, Workflow, XCircle } from "lucide-react";
import { Card, PageHeader, SectionLabel } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { n8nOverview } from "@/server/ops";

export const metadata = { title: "Automações" };

export default async function Page() {
  const n8n = await n8nOverview();
  const liveIds = new Set(n8n.instances.flatMap((i) => i.workflows.map((w) => w.id)));
  const byWhere = new Map<string, typeof n8n.documented>();
  for (const d of n8n.documented) {
    if (!byWhere.has(d.where)) byWhere.set(d.where, []);
    byWhere.get(d.where)!.push(d);
  }
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
      <PageHeader icon={<Workflow />} title="Automações" description="Workflows ao vivo no n8n cruzados com o que está documentado em “Automações Ativas” no vault." />

      {n8n.configured ? (
        n8n.instances.map((inst) => (
          <section key={inst.name}>
            <SectionLabel className="mb-3">n8n · {inst.name}</SectionLabel>
            {!inst.ok ? (
              <Card className="p-4 text-[13px] text-danger">{inst.error}</Card>
            ) : (
              <Card className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b border-border text-left text-[12px] text-faint"><th className="px-4 py-2.5 font-medium">Workflow</th><th className="px-4 py-2.5 font-medium">Estado</th><th className="px-4 py-2.5 font-medium">No vault</th><th className="px-4 py-2.5 font-medium">Atualizado</th></tr></thead>
                  <tbody>
                    {inst.workflows.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)).map((w) => (
                      <tr key={w.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5"><a href={`${inst.url}/workflow/${w.id}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">{w.name}</a><div className="font-mono text-[11px] text-faint">{w.id}</div></td>
                        <td className="px-4 py-2.5">{w.active ? <span className="flex items-center gap-1 text-success"><CheckCircle2 className="size-3.5" />ativo</span> : <span className="flex items-center gap-1 text-faint"><CircleDashed className="size-3.5" />inativo</span>}</td>
                        <td className="px-4 py-2.5 text-[12px]">{w.documented ? <span className="text-muted">{w.documented.description.slice(0, 90)}</span> : w.active ? <span className="text-warning">não documentado</span> : <span className="text-faint">—</span>}</td>
                        <td className="px-4 py-2.5 text-[12px] text-faint">{new Date(w.updatedAt).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </section>
        ))
      ) : (
        <Card className="p-5 text-[13px] text-muted">
          Para ver os workflows ao vivo, crie uma chave de API em cada n8n (Settings → n8n API) e defina <code>N8N_INSTANCES</code>. Enquanto isso, abaixo está o que o vault documenta.
        </Card>
      )}

      <section id="falhas">
        {n8n.configured && (
          <>
            <SectionLabel className="mb-3">Falhas recentes</SectionLabel>
            <Card className="divide-y divide-border">
              {n8n.instances.flatMap((i) => i.errors).length === 0 && <p className="p-4 text-[13px] text-muted">Nenhuma falha recente. ✅</p>}
              {n8n.instances.flatMap((i) => i.errors).sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 30).map((e) => (
                <a key={`${e.instance}-${e.id}`} href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-surface-2">
                  <XCircle className="size-4 text-danger" /><span className="truncate">{e.workflowName}</span><span className="ml-auto shrink-0 text-[12px] text-faint">{e.instance} · {new Date(e.startedAt).toLocaleString("pt-BR")}</span>
                </a>
              ))}
            </Card>
          </>
        )}
      </section>

      <section>
        <SectionLabel className="mb-3">Documentado no vault · {n8n.documented.length}</SectionLabel>
        <div className="space-y-4">
          {[...byWhere.entries()].map(([where, list]) => (
            <Card key={where} className="p-4">
              <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold"><FileText className="size-4 text-muted" />{where}</div>
              <div className="divide-y divide-border">
                {list.map((d) => (
                  <div key={`${d.name}-${d.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2 text-[13px]">
                    <span className="font-medium">{d.name}</span>
                    {d.id && <code className={cn("font-mono text-[11px]", n8n.configured ? (liveIds.has(d.id) ? "text-success" : "text-danger") : "text-faint")} title={n8n.configured ? (liveIds.has(d.id) ? "Encontrado no n8n" : "Não encontrado no n8n") : undefined}>{d.id}</code>}
                    <span className="ml-auto text-[12px] text-faint">{d.schedule}</span>
                    {d.description && <p className="w-full text-[12.5px] text-muted">{d.description}</p>}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
