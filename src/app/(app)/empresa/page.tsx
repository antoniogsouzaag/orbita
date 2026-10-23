import { Activity, AlertTriangle, ArrowUpRight, Bot, Building2, CheckCircle2, CheckSquare, GitPullRequest, Globe, HeartPulse, Inbox, Lightbulb, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { NewTaskButton } from "@/components/tasks/task-detail";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { relativeDay, today } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { agentTasks, recentActivity } from "@/server/agents";
import { githubInbox } from "@/server/github-inbox";
import { liveOps } from "@/server/ops-live";
import { listTasks } from "@/server/tasks";

export const metadata = { title: "Empresa" };

function ago(iso: string | Date) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
}

export default async function Page() {
  const [live, agentAsks, activity, gh, due, upcoming] = await Promise.all([liveOps(), agentTasks(), recentActivity(6), githubInbox(), listTasks({ view: "hoje", scope: "empresa", limit: 20 }), listTasks({ view: "proximos", scope: "empresa", limit: 8 })]);
  const t = today();
  const asks = agentAsks.filter((x) => x.status !== "done");
  const down = live.status.filter((s) => !s.ok);
  const wf24 = live.events.filter((e) => e.kind === "workflow_error" && Date.now() - e.createdAt.getTime() < 86_400_000);
  const soon = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
  const silent = live.monitors.filter((m) => m.silent);
  const waiting = asks.length + gh.items.length + due.filter((d) => d.dueDate && d.dueDate < t).length;

  const tiles = [
    { label: "No ar", value: live.status.length ? `${live.status.length - down.length}/${live.status.length}` : "—", icon: Activity, tone: down.length ? "danger" : live.status.length ? "success" : "", href: "/operacao" },
    { label: "Falhas 24h", value: String(wf24.length), icon: AlertTriangle, tone: wf24.length ? "warning" : "", href: "/operacao/automacoes" },
    { label: "Domínios < 45d", value: String(soon.length), icon: Globe, tone: soon.length ? "warning" : "", href: "/operacao" },
    { label: "Monitores", value: live.monitors.length ? `${live.monitors.length - silent.length}/${live.monitors.length}` : "—", icon: HeartPulse, tone: silent.length ? "danger" : "", href: "/operacao" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Building2 />} title="AG LABS" description="O que precisa de você hoje, o estado da operação e o que os agentes estão fazendo." actions={<NewTaskButton scope="empresa" />} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((x) => (
          <Link key={x.label} href={x.href} className="card group flex items-center gap-3 p-4 transition hover:border-border-strong">
            <span className={cn("grid size-10 place-items-center rounded-xl bg-surface-2", x.tone === "danger" ? "text-danger" : x.tone === "warning" ? "text-warning" : x.tone === "success" ? "text-success" : "text-muted")}>
              <x.icon className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[22px] font-semibold leading-none tabular-nums tracking-tight">{x.value}</span>
              <span className="mt-1 block text-[12px] text-muted">{x.label}</span>
            </span>
            <ArrowUpRight className="ml-auto size-4 text-faint opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>

      {down.length > 0 && (
        <Link href="/operacao" className="flex items-center gap-3 rounded-2xl border border-danger/40 bg-danger/8 px-4 py-3 text-[13.5px]">
          <XCircle className="size-4 shrink-0 text-danger" />
          <span><b>Fora do ar:</b> {down.map((d) => d.name).join(", ")}</span>
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader icon={<Inbox />} title="Aguardando você" meta={waiting ? `${waiting} ${waiting === 1 ? "item" : "itens"}` : "nada pendente"} />
          <div className="space-y-5 px-5 pb-5">
            <Group icon={<Bot />} label="Pedidos dos agentes" empty="Nenhum pedido aberto." count={asks.length}>
              {asks.slice(0, 6).map((a) => (
                <Row key={a.id} href={`/tarefas?escopo=empresa&task=${a.id}`} title={a.title} meta={`${a.tags.find((x) => x.startsWith("agente:"))?.slice(7) ?? "agente"} · ${ago(a.createdAt)}`} tone={a.priority >= 3 ? "danger" : undefined} />
              ))}
            </Group>
            <Group icon={<CheckSquare />} label="Tarefas vencidas ou de hoje" empty="Em dia." count={due.length}>
              {due.slice(0, 6).map((x) => (
                <Row key={x.id} href={`/tarefas?escopo=empresa&task=${x.id}`} title={x.title} meta={x.dueDate ? relativeDay(x.dueDate) : ""} tone={x.dueDate && x.dueDate < t ? "danger" : undefined} />
              ))}
            </Group>
            <Group icon={<GitPullRequest />} label="GitHub — PRs e propostas" empty={gh.configured ? (gh.error ? `Não consegui ler: ${gh.error}` : "Nenhum PR ou proposta esperando.") : "Configure GITHUB_INBOX_TOKEN (Integrações) para ver PRs e propostas da aglabs-core."} count={gh.items.length}>
              {gh.items.slice(0, 8).map((i) => (
                <Row key={i.url} href={i.url} external title={i.title} meta={`${i.repo} #${i.number} · ${ago(i.updatedAt)}`} badge={i.kind === "pr" ? (i.draft ? "rascunho" : "PR") : "proposta"} badgeIcon={i.kind === "proposta" ? <Lightbulb className="size-3" /> : <GitPullRequest className="size-3" />} />
              ))}
            </Group>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader icon={<CheckSquare />} title="Próximas da empresa" href="/tarefas?escopo=empresa" hrefLabel="Todas" />
            <div className="px-3 pb-3">
              {upcoming.length === 0 ? (
                <p className="px-2 pb-2 text-[13px] text-muted">Nada nos próximos 14 dias.</p>
              ) : (
                upcoming.map((x) => <Row key={x.id} href={`/tarefas?escopo=empresa&task=${x.id}`} title={x.title} meta={x.dueDate ? relativeDay(x.dueDate) : ""} />)
              )}
            </div>
          </Card>

          <Card>
            <CardHeader icon={<Bot />} title="Atividade dos agentes" href="/agentes" hrefLabel="Agentes" />
            <div className="px-5 pb-5 text-[13px]">
              {activity.length === 0 ? (
                <p className="text-muted">Nenhum agente conectado ainda.</p>
              ) : (
                <ul className="space-y-2">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      {a.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : <XCircle className="size-3.5 shrink-0 text-danger" />}
                      <span className="shrink-0 font-medium">{a.agent}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">{a.summary}</span>
                      <span className="shrink-0 text-[11.5px] text-faint">{ago(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="border-dashed">
            <CardHeader icon={<Users />} title="CRM" meta="próxima integração" />
            <p className="px-5 pb-5 text-[13px] text-muted">
              Clientes, funil, receita e tarefas da Maia e do Léo vão aparecer aqui quando o CRM ganhar o próprio servidor MCP. A Órbita pede, o CRM executa com as regras dele.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Group({ icon, label, empty, count, children }: { icon: React.ReactNode; label: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint [&_svg]:size-3.5">
        {icon} {label} {count > 0 && <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] tracking-normal text-muted">{count}</span>}
      </div>
      {count === 0 ? <p className="px-1 text-[13px] text-muted">{empty}</p> : <div className="-mx-2">{children}</div>}
    </section>
  );
}

function Row({ href, title, meta, tone, external, badge, badgeIcon }: { href: string; title: string; meta?: string; tone?: "danger"; external?: boolean; badge?: string; badgeIcon?: React.ReactNode }) {
  const body = (
    <>
      <span className={cn("size-1.5 shrink-0 rounded-full", tone === "danger" ? "bg-danger" : "bg-border-strong")} />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {badge && <span className="flex shrink-0 items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{badgeIcon}{badge}</span>}
      {meta && <span className={cn("shrink-0 text-[12px]", tone === "danger" ? "text-danger" : "text-faint")}>{meta}</span>}
    </>
  );
  const cls = "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition hover:bg-surface-2";
  return external ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{body}</a> : <Link href={href} className={cls}>{body}</Link>;
}
