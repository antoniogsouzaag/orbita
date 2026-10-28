import { AlertTriangle, ArrowLeft, ArrowUpRight, Bot, CheckCircle2, Megaphone, Circle, ExternalLink, FileText, KeyRound, ListTodo, XCircle } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AgentAvatarEditor } from "@/components/agents/agent-avatar";
import { AgentSheet } from "@/components/agents/agent-sheet";
import { HermesIntegration } from "@/components/agents/hermes-integration";
import { OpenclawIntegration } from "@/components/agents/openclaw-integration";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Big, ColumnBars, WidgetShell, lastDays } from "@/components/ui/mini-charts";
import { agoLabel, canonicalAgentId } from "@/lib/team";
import { cn } from "@/lib/utils";
import { agentActivityByDay, agentTasks, listAgentTokens, recentActivity } from "@/server/agents";
import { listDispatches, toView } from "@/server/dispatch";
import { hermesWorkEnabled } from "@/server/hermes-work";
import { hermesConfiguration, hermesHistory } from "@/server/hermes";
import { openclawConfiguration } from "@/server/openclaw";
import { buildTeam } from "@/server/team";
import { getVaultIndexSafe } from "@/server/vault";
import { agentEvents } from "@/server/ops-live";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Agente · ${id.charAt(0).toUpperCase()}${id.slice(1).replace(/-/g, " ")}` };
}

/** Horário da requisição (componente do servidor renderiza uma vez por pedido). */
const requestTime = () => Date.now();
const when = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Links antigos (ex.: /agentes/oracle) levam ao integrante canônico.
  if (canonicalAgentId(id) !== id) redirect(`/agentes/${canonicalAgentId(id)}`);
  const [tokens, activity, daily, team] = await Promise.all([listAgentTokens(), recentActivity(300), agentActivityByDay(14)]).then(async ([t, a, d]) => [t, a, d, await buildTeam({ tokens: t, activity: a })] as const);
  const member = team.find((m) => m.id === id);
  if (!member) notFound();

  const mine = (name: string) => canonicalAgentId(name) === member.id;
  const [tasks, idx, tomHistory, oracleHistory, events] = await Promise.all([
    agentTasks(member.name).catch(() => []),
    member.path ? getVaultIndexSafe() : Promise.resolve(null),
    member.director === "tom" ? listDispatches({ target: "openclaw" }) : Promise.resolve([]),
    member.director === "oracle" ? hermesHistory() : Promise.resolve([]),
    agentEvents(member.id).catch(() => []),
  ]);

  // Ficha do vault, com os wikilinks e anexos desta nota resolvidos aqui.
  const note = member.path && idx ? idx.notes.get(member.path) ?? null : null;
  const links: Record<string, string> = {};
  const embeds: Record<string, string> = {};
  if (note && idx) {
    for (const m of note.body.matchAll(/(!?)\[\[([^\]|#]+)/g)) {
      const target = m[2].trim();
      if (m[1]) {
        const file = idx.files.find((f) => f.path === target || f.path.endsWith(`/${target}`));
        if (file) embeds[target] = file.path;
      } else {
        const path = idx.resolve(target);
        if (path) links[target] = path;
      }
    }
  }
  const props = note ? Object.entries(note.frontmatter).filter(([, v]) => ["string", "number", "boolean"].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x === "string"))).slice(0, 8) : [];

  const myTokens = tokens.filter((t) => mine(t.name));
  const myCalls = activity.filter((a) => mine(a.agent));
  const open = tasks.filter((t) => t.status !== "done");
  const days = lastDays(14);
  const perDay = days.map((d) => {
    const rows = daily.filter((r) => mine(r.agent) && r.day === d.key);
    const calls = rows.reduce((n, r) => n + r.calls, 0), failures = rows.reduce((n, r) => n + r.failures, 0);
    return { label: d.label, segments: [{ name: "com sucesso", tone: "accent" as const, value: calls - failures }, { name: "com falha", tone: "err" as const, value: failures }] };
  });
  const total14 = perDay.reduce((n, d) => n + d.segments[0].value + d.segments[1].value, 0);
  const now = requestTime();
  const seen = agoLabel(member.lastSeen, now);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <Link href="/agentes" className="inline-flex items-center gap-1.5 text-[12.5px] text-muted transition hover:text-fg"><ArrowLeft className="size-3.5" />Central dos agentes</Link>

      <header className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <AgentAvatarEditor id={member.id} name={member.name} emoji={member.emoji} src={member.avatar} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.025em]">{member.name}</h1>
            {member.director && <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-[11px] font-medium text-accent">Diretor</span>}
          </div>
          <p className="mt-1 text-[14px] leading-snug text-muted">{member.role || "Função ainda não documentada"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.runtime && <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted">{member.runtime}</span>}
            {member.area && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{member.area}</span>}
            {member.vaultStatus && <span className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] text-muted" title="Status documentado no vault">{member.vaultStatus}</span>}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className={cn("size-1.5 rounded-full", member.lastSeen && now - Date.parse(member.lastSeen) < 86_400_000 ? "bg-success" : "bg-faint")} />{seen ? `Ativo ${seen}` : "Nenhuma atividade registrada"}</span>
            <span className="tabular-nums">{member.calls} chamadas em 24h{member.failures ? <span className="text-danger"> · {member.failures} falhas</span> : null}</span>
            {open.length > 0 && <span className="tabular-nums text-warning">{open.length} pedido{open.length === 1 ? "" : "s"} aberto{open.length === 1 ? "" : "s"}</span>}
          </p>
        </div>
        {member.path && (
          <div className="flex shrink-0 gap-2 sm:flex-col">
            <Link href={`/vault?p=${encodeURIComponent(member.path)}`} className="btn-secondary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-medium"><FileText className="size-4" />Editar no vault</Link>
          </div>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
        <Card className="min-w-0">
          <CardHeader icon={<FileText />} title="Ficha" meta={note ? note.path : undefined} />
          {note ? (
            <div className="px-5 pb-6 sm:px-6">
              {props.length > 0 && (
                <dl className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {props.map(([k, v]) => <div key={k} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2"><dt className="truncate text-[10.5px] uppercase tracking-wider text-faint">{k}</dt><dd className="mt-0.5 truncate text-[12.5px]">{Array.isArray(v) ? v.join(", ") : String(v)}</dd></div>)}
                </dl>
              )}
              <AgentSheet body={note.body} links={links} embeds={embeds} />
            </div>
          ) : (
            <EmptyState icon={<FileText />} title={member.path ? "Ficha indisponível agora" : "Sem ficha no vault"}
              description={member.path ? "Não consegui ler o vault nesta consulta. Tente novamente em instantes." : "Adicione este agente ao Registro de Agentes no vault com um link para a ficha dele."}
              action={<Link href="/vault" className="text-[12.5px] text-accent hover:underline">Abrir o vault ↗</Link>} />
          )}
        </Card>

        <aside className="min-w-0 space-y-4">
          {member.director === "tom" && <OpenclawIntegration config={openclawConfiguration()} initial={tomHistory.map((row) => toView(row))} />}
          {member.director === "oracle" && <HermesIntegration config={{...hermesConfiguration(),taskDispatchEnabled:await hermesWorkEnabled()}} initial={oracleHistory} />}
          {member.director === "easypanel" && <Card className="p-5 text-xs leading-relaxed text-muted">Pedidos pela Órbita ainda não estão conectados a este diretor. O acesso MCP funciona normalmente; o envio de pedidos segue o contrato do Hermes Oracle e entra numa etapa própria.</Card>}

          <div className="card h-[200px]">
            <WidgetShell title="Chamadas MCP" meta="14 dias">
              <Big unit={total14 === 1 ? "chamada" : "chamadas"}>{total14}</Big>
              <ColumnBars className="mt-auto" axis={[days[0].label, "hoje"]} label={`Chamadas MCP de ${member.name} por dia nos últimos 14 dias: ${total14} no total.`} columns={perDay} />
            </WidgetShell>
          </div>

          <Card>
            <CardHeader icon={<Megaphone />} title="Eventos registrados" meta="30 dias" href="/operacao" hrefLabel="Operação" />
            {events.length === 0 ? <p className="px-5 pb-4 text-[12.5px] text-muted">Nenhum alerta, incidente ou resumo enviado por este agente.</p> : (
              <ul className="max-h-[300px] space-y-0.5 overflow-y-auto px-3 pb-3">
                {events.map((e) => {
                  const Icon = e.kind === "agente_incidente" ? XCircle : e.kind === "agente_alerta" ? AlertTriangle : Bot;
                  const tone = e.kind === "agente_incidente" ? "text-danger" : e.kind === "agente_alerta" ? "text-warning" : "text-muted";
                  const message = String((e.detail as { message?: string }).message ?? "");
                  return (
                    <li key={e.id} className="flex gap-2.5 rounded-lg px-2 py-1.5">
                      <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone)} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-medium">{e.subject}</span>{message && <span className="line-clamp-2 text-[11.5px] text-faint">{message}</span>}</span>
                      <time dateTime={e.createdAt.toISOString()} className="shrink-0 text-[11px] tabular-nums text-faint">{when(e.createdAt)}</time>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={<ListTodo />} title="Pedidos do agente" meta={`${open.length} abertos`} href={`/tarefas?escopo=empresa`} hrefLabel="Tarefas" />
            {open.length === 0 ? <p className="px-5 pb-4 text-[12.5px] text-muted">Nenhum pedido aberto por este agente.</p> : (
              <ul className="divide-y divide-border px-5 pb-2">
                {open.slice(0, 6).map((t) => (
                  <li key={t.id}><Link href={`/tarefas?escopo=empresa&task=${t.id}`} className="flex items-start gap-2 py-2.5 text-[12.5px] hover:text-accent"><Circle className={cn("mt-0.5 size-3.5 shrink-0", t.priority >= 3 ? "text-danger" : "text-faint")} /><span className="min-w-0 flex-1 truncate">{t.title}</span>{t.dueDate && <span className="shrink-0 text-[11px] text-faint">{t.dueDate.split("-").reverse().slice(0, 2).join("/")}</span>}</Link></li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={<CheckCircle2 />} title="Atividade recente" meta={`${myCalls.length} chamadas`} />
            {myCalls.length === 0 ? <p className="px-5 pb-4 text-[12.5px] text-muted">Nenhuma chamada MCP registrada.</p> : (
              <ul className="max-h-[320px] space-y-0.5 overflow-y-auto px-3 pb-3">
                {myCalls.slice(0, 20).map((a) => (
                  <li key={a.id} className="flex gap-2.5 rounded-lg px-2 py-1.5">
                    {a.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />}
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px]">{a.summary}</span><code className="block truncate font-mono text-[10.5px] text-faint">{a.tool}</code></span>
                    <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-[11px] tabular-nums text-faint">{when(a.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader icon={<KeyRound />} title="Acessos MCP" href="/integracoes/mcp" hrefLabel="Gerenciar" />
            {myTokens.length === 0 ? <p className="px-5 pb-4 text-[12.5px] text-muted">Sem acesso MCP com este nome.</p> : (
              <ul className="space-y-3 px-5 pb-4">
                {myTokens.map((t) => (
                  <li key={t.id} className="text-[12.5px]">
                    <div className="flex items-center gap-2"><span className="font-medium">{t.name}</span><span className={cn("ml-auto text-[11px]", t.revoked ? "text-danger" : "text-faint")}>{t.revoked ? "revogado" : t.lastUsedAt ? `usado ${agoLabel(t.lastUsedAt.toISOString(), now)}` : "nunca usado"}</span></div>
                    <div className="mt-1.5 flex flex-wrap gap-1">{t.scopes.map((s) => <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-muted">{s}</span>)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {member.path && <Link href={`/vault?p=${encodeURIComponent(member.path)}`} className="flex items-center justify-center gap-1.5 text-[12px] text-faint hover:text-fg"><ExternalLink className="size-3.5" />Abrir a nota no vault<ArrowUpRight className="size-3" /></Link>}
        </aside>
      </div>
    </div>
  );
}
