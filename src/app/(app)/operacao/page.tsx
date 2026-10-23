import { Bot, Gauge, LibraryBig, Server, Workflow, XCircle } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyButton } from "@/components/ops/copy-button";
import { StatusBoard } from "@/components/ops/status-board";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { agents, appRegistry, documentedAutomations, n8nOverview, vpsList } from "@/server/ops";

export const metadata = { title: "Operação" };

export default async function Page() {
  const [ags, vps, apps, docs, n8n, h] = await Promise.all([agents(), vpsList(), appRegistry(), documentedAutomations(), n8nOverview(), headers()]);
  const active = ags.filter((a) => /ativo/i.test(a.status)).length;
  const wf = n8n.instances.flatMap((i) => i.workflows);
  const errors = n8n.instances.flatMap((i) => i.errors).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const errors24 = errors.filter((e) => Date.now() - Date.parse(e.startedAt) < 86_400_000);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const ctxUrl = `${proto}://${host}/api/context`;
  const tiles = [
    { label: "Agentes ativos", value: `${active}/${ags.length}`, href: "/operacao/infra#agentes", icon: Bot },
    { label: "Servidores", value: String(vps.length), href: "/operacao/infra", icon: Server },
    { label: "Aplicações", value: String(apps.length), href: "/operacao/infra#apps", icon: LibraryBig },
    { label: n8n.configured ? "Workflows ativos" : "Automações (vault)", value: n8n.configured ? `${wf.filter((w) => w.active).length}/${wf.length}` : String(docs.length), href: "/operacao/automacoes", icon: Workflow },
    { label: "Falhas n8n (24h)", value: n8n.configured ? String(errors24.length) : "—", href: "/operacao/automacoes#falhas", icon: XCircle, tone: errors24.length ? "text-danger" : undefined },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Gauge />} title="Operação" description="Visão geral da AG LABS: disponibilidade, automações, servidores e agentes — derivada do vault." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="card p-4 transition hover:border-border-strong">
            <t.icon className="mb-3 size-4 text-muted" />
            <div className={`text-2xl font-bold tabular-nums ${t.tone ?? ""}`}>{t.value}</div>
            <div className="text-[12px] text-muted">{t.label}</div>
          </Link>
        ))}
      </div>
      <StatusBoard />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<XCircle />} title="Últimas falhas do n8n" href="/operacao/automacoes" />
          <div className="px-5 pb-5">
            {!n8n.configured && <p className="text-[13px] text-muted">Configure <code>N8N_INSTANCES</code> com a URL e a chave de API dos seus n8n para ver workflows e falhas aqui.</p>}
            {n8n.instances.filter((i) => !i.ok).map((i) => <p key={i.name} className="text-[13px] text-danger">{i.name}: {i.error}</p>)}
            {n8n.configured && errors.length === 0 && <p className="text-[13px] text-muted">Nenhuma falha recente. ✅</p>}
            <div className="space-y-1.5">
              {errors.slice(0, 8).map((e) => (
                <a key={`${e.instance}-${e.id}`} href={e.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-surface-2">
                  <XCircle className="size-3.5 shrink-0 text-danger" />
                  <span className="truncate">{e.workflowName}</span>
                  <span className="ml-auto shrink-0 text-[11.5px] text-faint">{e.instance} · {new Date(e.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </a>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader icon={<Bot />} title="Contexto para agentes" />
          <div className="space-y-3 px-5 pb-5 text-[13px] text-muted">
            <p>Quando um agente novo entrar na equipe, entregue este endpoint: ele devolve em markdown as regras do vault, agentes, servidores, aplicações, automações e monitoramento — sempre atualizado a partir do vault.</p>
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 font-mono text-[12px]">
              <span className="min-w-0 flex-1 break-all">GET {ctxUrl}?format=md&amp;live=1</span>
              <CopyButton text={`curl -H "Authorization: Bearer $CONTEXT_TOKEN" "${ctxUrl}?format=md&live=1"`} label="Copiar curl" />
            </div>
            <p className="text-[12px] text-faint">Autenticação: cabeçalho <code>Authorization: Bearer CONTEXT_TOKEN</code>. Não inclui dados pessoais, tarefas nem segredos. <Link href="/api/context?format=md" className="underline" target="_blank">Ver prévia</Link></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
