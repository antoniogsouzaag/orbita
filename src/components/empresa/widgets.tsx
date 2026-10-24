import { stageLabel } from "@/lib/github-triage";
import { agentSlug } from "@/lib/team";
import { AlertTriangle, ArrowUpRight, Bot, Briefcase, CheckCircle2, CheckSquare, FolderKanban, GitPullRequest, Globe, HeartPulse, Inbox, Lightbulb, Server, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { CRM_ASSIGNEE } from "@/server/crm";
import type { EmpresaData } from "@/server/empresa";

function ago(iso: string | Date) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60) return `há ${Math.max(m, 1)} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)} dias`;
}

/* ───────── Aguardando você ───────── */
export function WaitingWidget({ asks, due, crmMine, crmTasksUrl, today }: Pick<EmpresaData, "asks" | "due" | "crmMine" | "crmTasksUrl" | "today">) {
  const total = asks.length + due.length + crmMine.length;
  return (
    <Card className="h-full">
      <CardHeader icon={<Inbox />} title="Aguardando você" meta={total ? `${total} ${total === 1 ? "item" : "itens"}` : "nada pendente"} />
      {total === 0 ? (
        <EmptyState icon={<CheckCircle2 />} title="Nada esperando por você" description="Pedidos dos agentes, tarefas vencidas e pendências do CRM aparecem aqui." />
      ) : (
        <div className="space-y-4 px-5 pb-5">
          {asks.length > 0 && (
            <Group icon={<Bot />} label="Pedidos dos agentes" count={asks.length}>
              {asks.slice(0, 5).map((a) => (
                <Row key={a.id} href={`/tarefas?escopo=empresa&task=${a.id}`} title={a.title} meta={`${a.tags.find((x) => x.startsWith("agente:"))?.slice(7) ?? "agente"} · ${ago(a.createdAt)}`} tone={a.priority >= 3 ? "danger" : undefined} />
              ))}
            </Group>
          )}
          {due.length > 0 && (
            <Group icon={<CheckSquare />} label="Tarefas vencidas ou de hoje" count={due.length}>
              {due.slice(0, 5).map((x) => (
                <Row key={x.id} href={`/tarefas?escopo=empresa&task=${x.id}`} title={x.title} meta={x.dueDate ? relativeDay(x.dueDate) : ""} tone={x.dueDate && x.dueDate < today ? "danger" : undefined} />
              ))}
            </Group>
          )}
          {crmMine.length > 0 && (
            <Group icon={<Users />} label="CRM — suas tarefas" count={crmMine.length}>
              {crmMine.slice(0, 5).map((x) => (
                <Row key={x.id} href={crmTasksUrl ?? "/empresa"} external={!!crmTasksUrl} title={`${x.titulo}${x.contato?.nome ? ` · ${x.contato.nome}` : ""}`} meta={x.prazo ? relativeDay(x.prazo) : ""} tone={x.vencida ? "danger" : undefined} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Card>
  );
}

/* ───────── Operação agora ───────── */
export function OperationWidget({ ops }: { ops: EmpresaData["ops"] }) {
  const stats = [
    { label: "No ar", value: ops.total ? `${ops.total - ops.down.length}/${ops.total}` : "—", tone: ops.down.length ? "text-danger" : ops.total ? "text-success" : "" },
    { label: "Falhas 24h", value: String(ops.failures.length), tone: ops.failures.length ? "text-warning" : "" },
    { label: "Domínios < 45d", value: String(ops.soon.length), tone: ops.soon.length ? "text-warning" : "" },
    { label: "Monitores", value: ops.monitors.length ? `${ops.monitors.length - ops.silent.length}/${ops.monitors.length}` : "—", tone: ops.silent.length ? "text-danger" : "" },
  ];
  return (
    <Card className="h-full">
      <CardHeader icon={<Server />} title="Operação agora" href="/operacao" hrefLabel="Operação" />
      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <div className="text-[11.5px] text-muted">{s.label}</div>
              <div className={cn("text-[20px] font-semibold tabular-nums", s.tone)}>{s.value}</div>
            </div>
          ))}
        </div>
        {ops.down.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-border pt-3">
            {ops.down.slice(0, 4).map((d) => (
              <div key={d.url} className="flex items-center gap-2 text-[13px]"><XCircle className="size-3.5 shrink-0 text-danger" /><span className="truncate">{d.name}</span><span className="ml-auto shrink-0 text-[11.5px] text-faint">{ago(d.changedAt)}</span></div>
            ))}
          </div>
        )}
        {ops.silent.length > 0 && <p className="mt-3 text-[12.5px] text-danger">Sem sinal: {ops.silent.map((m) => m.label).join(", ")}</p>}
        {!ops.total && <p className="mt-3 text-[12.5px] text-muted">Os monitores do n8n ainda não enviaram dados.</p>}
      </div>
    </Card>
  );
}

/* ───────── CRM ───────── */
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const FUNNEL = ["Lead", "Contatado", "Atendimento", "Proposta", "Pagamento"] as const;

export function CrmWidget({ crm }: { crm: EmpresaData["crm"] }) {
  const open = crm.configured && crm.ok && crm.url ? (
    <a href={crm.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12.5px] text-muted hover:text-fg">Abrir CRM <ArrowUpRight className="size-3.5" /></a>
  ) : undefined;
  return (
    <Card className="h-full">
      <CardHeader icon={<Users />} title="CRM" actions={open} />
      {!crm.configured ? (
        <p className="px-5 pb-5 text-[13px] text-muted">
          Conecte o servidor MCP do CRM com <code className="text-[12px]">CRM_MCP_URL</code> e <code className="text-[12px]">CRM_MCP_TOKEN</code> para ver o funil, a receita e as tarefas da Maia e do Léo.
        </p>
      ) : !crm.ok ? (
        <p className="px-5 pb-5 text-[13px] text-muted"><AlertTriangle className="mr-1 inline size-3.5 text-warning" />Não consegui ler o CRM: {crm.error}</p>
      ) : (
        <CrmBody crm={crm} />
      )}
    </Card>
  );
}

function CrmBody({ crm }: { crm: Extract<EmpresaData["crm"], { ok: true }> }) {
  const s = crm.summary;
  const max = Math.max(1, ...FUNNEL.map((k) => s.funil[k]));
  const delta = s.receita_mes - s.receita_mes_anterior;
  const owners = Object.entries(s.tarefas.por_responsavel).filter(([k, n]) => n > 0 && k !== "antonio");
  return (
    <div className="space-y-4 px-5 pb-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <div className="text-[11.5px] text-muted">Receita do mês</div>
          <div className="truncate text-[18px] font-semibold tabular-nums">{brl(s.receita_mes)}</div>
          {(s.receita_mes || s.receita_mes_anterior) > 0 && <div className={cn("text-[11.5px] tabular-nums", delta >= 0 ? "text-success" : "text-danger")}>{delta >= 0 ? "+" : "−"}{brl(Math.abs(delta))} vs. mês anterior</div>}
        </div>
        <div>
          <div className="text-[11.5px] text-muted">Oportunidades</div>
          <div className="text-[18px] font-semibold tabular-nums">{s.oportunidades_abertas}</div>
          <div className="text-[11.5px] text-faint">{s.novos_7d} novos em 7 dias</div>
        </div>
        <div>
          <div className="text-[11.5px] text-muted">Clientes</div>
          <div className="text-[18px] font-semibold tabular-nums">{s.clientes}</div>
          <div className="text-[11.5px] text-faint">{s.contatos_a_qualificar} a qualificar</div>
        </div>
      </div>
      <div className="space-y-1.5">
        {FUNNEL.map((k) => (
          <div key={k} className="flex items-center gap-2 text-[12.5px]">
            <span className="w-[84px] shrink-0 text-muted">{k}</span>
            <Progress value={(s.funil[k] / max) * 100} className="h-1" />
            <span className="w-6 shrink-0 text-right tabular-nums">{s.funil[k]}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-3 text-[12.5px]">
        <div className="flex items-center gap-2">
          <span className="font-medium">Tarefas do time</span>
          <span className="text-muted">{s.tarefas.pendentes} pendentes</span>
          {s.tarefas.vencidas > 0 && <span className="text-danger">· {s.tarefas.vencidas} vencidas</span>}
        </div>
        {owners.length > 0 && <div className="mt-1 text-faint">{owners.map(([k, n]) => `${CRM_ASSIGNEE[k] ?? k} ${n}`).join(" · ")}</div>}
        {crm.team.length > 0 && (
          <ul className="mt-2 space-y-1">
            {crm.team.slice(0, 4).map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <span className={cn("size-1.5 shrink-0 rounded-full", x.vencida ? "bg-danger" : "bg-border-strong")} />
                <span className="min-w-0 flex-1 truncate">{x.titulo}</span>
                <span className="shrink-0 text-faint">{x.responsavel ? CRM_ASSIGNEE[x.responsavel] : "—"}{x.prazo ? ` · ${relativeDay(x.prazo)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ───────── GitHub ───────── */
export function GithubWidget({ gh }: { gh: EmpresaData["gh"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<GitPullRequest />} title="Evolução no GitHub" meta={gh.items.length ? String(gh.items.length) : undefined} href="/github" hrefLabel="Revisar" />
      <div className="px-3 pb-3">
        {gh.items.length === 0 ? (
          <p className="px-2 pb-2 text-[13px] text-muted">
            {gh.configured ? (gh.error ? `Não consegui ler: ${gh.error}` : "Nenhum PR ou item de evolução visível ao token atual.") : "Configure o acesso ao GitHub em Integrações para acompanhar os PRs."}
          </p>
        ) : (
          gh.items.slice(0, 7).map((i) => (
            <Row key={i.url} href={i.url} external title={i.title} meta={`${i.repo} #${i.number} · ${ago(i.updatedAt)}`} badge={stageLabel(i)} badgeIcon={i.kind === "proposta" ? <Lightbulb className="size-3" /> : <GitPullRequest className="size-3" />} />
          ))
        )}
        {gh.configured && !gh.error && <p className="px-2 pt-2 text-[11px] leading-relaxed text-faint">{gh.credential === "VAULT_GITHUB_TOKEN" ? "Usando o token do Knowledge · cobertura limitada aos repositórios permitidos." : "Repositórios visíveis ao token configurado."}{gh.truncated ? " Consulta parcial." : ""}</p>}
      </div>
    </Card>
  );
}

/* ───────── Agentes ───────── */
export function AgentsWidget({ activity }: { activity: EmpresaData["activity"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Bot />} title="Atividade dos agentes" href="/agentes" hrefLabel="Agentes" />
      <div className="px-5 pb-5 text-[13px]">
        {activity.length === 0 ? (
          <p className="text-muted">Nenhum agente conectado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                {a.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : <XCircle className="size-3.5 shrink-0 text-danger" />}
                <Link href={`/agentes/${agentSlug(a.agent)}`} className="shrink-0 font-medium hover:text-accent">{a.agent}</Link>
                <span className="min-w-0 flex-1 truncate text-muted">{a.summary}</span>
                <span className="shrink-0 text-[11.5px] text-faint">{ago(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ───────── Projetos ───────── */
export function ProjectsWidget({ projects }: { projects: EmpresaData["projects"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<FolderKanban />} title="Projetos" href="/projetos?escopo=empresa" hrefLabel="Projetos" />
      {projects.length === 0 ? (
        <EmptyState icon={<Briefcase />} title="Nenhum projeto da empresa" description="Projetos com área Empresa aparecem aqui." />
      ) : (
        <div className="space-y-3 px-5 pb-5">
          {projects.slice(0, 6).map((p) => {
            const total = p.open + p.done;
            return (
              <Link key={p.id} href={`/projetos/${p.id}?escopo=empresa`} className="block">
                <div className="flex items-center gap-2 text-[13.5px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-[12px] tabular-nums text-muted">{p.open} abertas</span>
                </div>
                {total > 0 && <Progress value={(p.done / total) * 100} color={p.color} className="mt-1.5" />}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ───────── Incidentes e falhas ───────── */
const KIND: Record<string, string> = { site_down: "Fora do ar", workflow_error: "Falha de workflow", domain_alert: "Domínio", monitor_silent: "Monitor em silêncio" };

export function IncidentsWidget({ incidents }: { incidents: EmpresaData["incidents"] }) {
  const sorted = [...incidents].sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || b.createdAt.getTime() - a.createdAt.getTime());
  return (
    <Card className="h-full">
      <CardHeader icon={<AlertTriangle />} title="Incidentes e falhas" meta="7 dias" href="/operacao/automacoes" hrefLabel="Automações" />
      <div className="px-5 pb-5 text-[13px]">
        {sorted.length === 0 ? (
          <p className="text-muted">Nada nos últimos 7 dias. ✅</p>
        ) : (
          <ul className="space-y-2">
            {sorted.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className={cn("size-1.5 shrink-0 rounded-full", e.resolvedAt ? "bg-border-strong" : e.severity === "critical" || e.kind === "site_down" ? "bg-danger" : "bg-warning")} />
                <span className="shrink-0 text-muted">{KIND[e.kind] ?? e.kind}</span>
                <span className="min-w-0 flex-1 truncate">{e.subject}</span>
                <span className="shrink-0 text-[11.5px] text-faint">{e.resolvedAt ? "resolvido" : ago(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ───────── Domínios ───────── */
export function DomainsWidget({ domains }: { domains: EmpresaData["domains"] }) {
  return (
    <Card className="h-full">
      <CardHeader icon={<Globe />} title="Domínios" href="/operacao" hrefLabel="Operação" />
      <div className="px-5 pb-5 text-[13px]">
        {domains.length === 0 ? (
          <p className="text-muted">O monitor de domínios ainda não enviou dados.</p>
        ) : (
          <ul className="space-y-2">
            {domains.slice(0, 6).map((d) => {
              const days = d.days;
              return (
                <li key={d.domain} className="flex items-center gap-2">
                  <HeartPulse className={cn("size-3.5 shrink-0", d.error ? "text-danger" : days !== null && days < 30 ? "text-warning" : "text-faint")} />
                  <span className="min-w-0 flex-1 truncate">{d.domain}</span>
                  <span className={cn("shrink-0 tabular-nums", days !== null && days < 30 ? "text-warning" : "text-faint")}>{d.error ? "erro" : days !== null ? `${days} dias` : "—"}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ───────── Partes ───────── */
function Group({ icon, label, count, children }: { icon: React.ReactNode; label: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-faint [&_svg]:size-3.5">
        {icon} {label} <span className="rounded-full bg-surface-3 px-1.5 py-px text-[10.5px] tracking-normal text-muted">{count}</span>
      </div>
      <div className="-mx-2">{children}</div>
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
