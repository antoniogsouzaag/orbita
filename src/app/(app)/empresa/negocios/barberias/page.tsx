import { ProductAppMetrics } from "@/components/empresa/product-app-metrics";
import { CRM_EMAIL_CATEGORIES } from "@/lib/crm-aggregates";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Radio, GitPullRequest } from "lucide-react";
import { BusinessTask } from "@/components/empresa/business-task";
import { ProductCommercial } from "@/components/empresa/product-commercial";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/revenue-charts-kpi";
import { BARBERIAS, belongsToBarberias } from "@/lib/business";
import { liveOps } from "@/server/ops-live";
import { githubInbox } from "@/server/github-inbox";
import { socialChannels, socialConfigured } from "@/server/social";
import { crmUrl } from "@/server/crm";
import { listTasks } from "@/server/tasks";
import { appRegistry } from "@/server/ops";

export const metadata = { title: "Negócios · Barberias" };
export default async function Page({ searchParams }: { searchParams: Promise<{ dias?: string; categoria?: string }> }) {
  const sp = await searchParams;
  const days = [7,30,90].includes(Number(sp.dias)) ? Number(sp.dias) : 30;
  const category = CRM_EMAIL_CATEGORIES.find(item => item === sp.categoria);
  const [liveResult, githubResult, socialResult, tasksResult, registryResult] = await Promise.allSettled([liveOps(), githubInbox(), socialConfigured() ? socialChannels() : Promise.resolve([]), listTasks({ scope: "empresa", tag: BARBERIAS.tag, limit: 20 }), appRegistry()]);
  const live = liveResult.status === "fulfilled" ? liveResult.value.status.filter((item) => belongsToBarberias(item.url)) : [];
  const github = githubResult.status === "fulfilled" ? githubResult.value : null;
  const issues = github?.items.filter((item) => item.repo === BARBERIAS.repo) ?? [];
  const channels = socialResult.status === "fulfilled" ? socialResult.value.filter((item) => item.customer?.id === BARBERIAS.postizGroupId) : [];
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const app = registryResult.status === "fulfilled" ? registryResult.value.find((item) => item.repo.split("/").at(-1) === BARBERIAS.repo) : null;
  const crm = crmUrl();
  return <div className="mx-auto max-w-6xl space-y-3 px-4 sm:px-6">
    <Link href="/empresa/negocios" className="inline-flex text-xs text-muted hover:text-fg">← Todos os negócios</Link>
    <PageHeader icon={<Image src={BARBERIAS.logo} alt="" width={36} height={36} className="size-9 object-contain" />} title="Barberias" description="Indicadores e prioridades do negócio, consultados nas fontes conectadas." />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      { label: "Ações abertas", value: tasksResult.status === "rejected" ? "—" : tasks.length, note: tasks.length === 20 ? "20 mais recentes · consulta limitada" : "Órbita · tag barberias" },
      { label: "Ações vencidas", value: tasksResult.status === "rejected" ? "—" : tasks.filter((task) => task.dueDate && task.dueDate < new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })).length, note: "Entre as ações carregadas" },
      { label: "PRs para revisar", value: !github?.configured || github.error ? "—" : issues.filter((item) => item.kind === "pr" && !item.draft).length, note: github?.truncated ? "GitHub · consulta parcial" : "GitHub · repositório barberias" },
      { label: "Disponibilidade observada", value: liveResult.status === "rejected" || !live.length ? "—" : `${live.filter((item) => item.ok).length}/${live.length}`, note: "Última resposta dos monitores" },
    ].map((item) => <KpiCard key={item.label} label={item.label} value={item.value} hint={item.note} />)}</div>
    <p className="text-[11px] text-faint">Consultado em {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · cada fonte informa sua própria cobertura e atualização.</p>
    <Suspense fallback={<Card className="p-4 text-xs text-muted">Consultando dados administrativos do app…</Card>}><ProductAppMetrics product="barberias" /></Suspense>
    <form className="card flex flex-wrap items-end gap-3 p-4"><div><Label htmlFor="barberias-dias">Janela de e-mails</Label><Select id="barberias-dias" name="dias" defaultValue={String(days)} className="w-36">{[7,30,90].map(day => <option key={day} value={day}>{day} dias</option>)}</Select></div><div><Label htmlFor="barberias-categoria">Categoria</Label><Select id="barberias-categoria" name="categoria" defaultValue={category ?? ""} className="w-48"><option value="">Todas</option>{CRM_EMAIL_CATEGORIES.map(item => <option key={item}>{item}</option>)}</Select></div><Button type="submit" variant="primary">Aplicar</Button></form>
    <Suspense key={`${days}:${category}`} fallback={<Card className="p-4" role="status">Consultando funil comercial e e-mails do Barberias no CRM…</Card>}><ProductCommercial produto={BARBERIAS.id} dias={days} categoria={category} /></Suspense>
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"><div className="space-y-3">
      <Card className="p-4"><h2 className="text-[14px] font-semibold tracking-tight">Decisões que precisam de atenção</h2><ul className="mt-3 space-y-2 text-xs text-muted">{live.some((item) => !item.ok) && <li className="rounded-xl bg-warning/10 p-3">{live.filter((item) => !item.ok).length} verificações falharam. Consulte os incidentes antes de retomar divulgação.</li>}{issues.filter((item) => item.kind === "pr" && !item.draft).length > 0 && <li><Link className="text-accent" href="/github">Revisar {issues.filter((item) => item.kind === "pr" && !item.draft).length} PRs abertos do produto ↗</Link></li>}<li className="rounded-xl border border-border p-3"><p className="font-medium text-fg">Comercial na origem</p><p className="mt-2 text-xs leading-relaxed">Os indicadores comerciais acima consultam somente o produto barberias no CRM. Contas e etapa comercial são sinais distintos; confirme cobranças e próximos passos nos sistemas de origem. O resumo geral nunca substitui dados indisponíveis do produto.</p><div className="mt-3 flex flex-wrap gap-3 text-xs">{crm && <a href={crm} target="_blank" rel="noopener noreferrer" className="text-accent">Abrir CRM ↗</a>}<a href="https://barberias.com.br/super-admin" target="_blank" rel="noopener noreferrer" className="text-accent">Abrir administração do Barberias ↗</a></div></li></ul></Card>
      <Card className="p-4"><h2 className="text-[14px] font-semibold tracking-tight">Próximas ações do Barberias</h2><p className="mt-1 text-xs text-muted">Tarefas internas da Órbita, vinculadas explicitamente pela tag barberias.</p>{tasksResult.status === "rejected" ? <p className="mt-3 text-sm text-warning">Não foi possível consultar as tarefas.</p> : !tasks.length ? <p className="mt-3 text-sm text-muted">Nenhuma ação aberta com este vínculo. Adicione a próxima decisão ou melhoria.</p> : <ul className="mt-3 divide-y divide-border">{tasks.map((task) => <li key={task.id}><Link href={`/tarefas?escopo=empresa&tag=barberias&task=${task.id}`} className="block py-2 text-sm hover:text-accent">{task.title}{task.dueDate && <span className="mt-1 block text-[11px] text-faint">Prazo: {task.dueDate}</span>}</Link></li>)}</ul>}<BusinessTask /></Card>
    </div><div className="space-y-3">
      <Card className="p-4"><h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight"><Radio className="size-4 text-muted" />Canais do negócio</h2>{socialResult.status === "rejected" ? <p className="mt-3 text-xs text-warning">Não foi possível consultar os canais do Postiz.</p> : !channels.length ? <p className="mt-3 text-xs text-muted">{socialConfigured() ? "Nenhum canal com o grupo Barberias retornado." : "Postiz ainda não conectado neste ambiente."}</p> : <ul className="mt-3 space-y-2">{channels.map((channel) => <li key={channel.id}><Link href={`/redes?canal=${encodeURIComponent(channel.id)}`} prefetch={false} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3"><span><span className="block text-sm">{channel.name}</span><span className="mt-1 block text-[11px] text-muted">{channel.identifier.replace("-standalone", "")} · {channel.disabled ? "desativado" : "listado no Postiz"}</span></span><ArrowUpRight className="size-4 text-faint" /></Link></li>)}</ul>}<p className="mt-3 text-[11px] leading-relaxed text-faint">Vínculo pelo grupo do Postiz, sem associação por semelhança de nome.</p></Card>
      <Card className="p-4"><h2 className="text-[14px] font-semibold tracking-tight">Operação do produto</h2>{liveResult.status === "rejected" ? <p className="mt-3 text-xs text-warning">Consulta de monitoramento indisponível.</p> : !live.length ? <p className="mt-3 text-xs text-muted">Nenhuma verificação recebida para este domínio.</p> : <ul className="mt-3 divide-y divide-border">{live.map((item) => <li key={item.url} className="py-2 text-xs"><p className="flex justify-between gap-3"><span>{item.name}</span><span className={item.ok ? "text-success" : "text-warning"}>{item.ok ? "Respondeu" : "Falhou"}</span></p><p className="mt-1 text-[10px] text-faint">{new Date(item.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></li>)}</ul>}<Link href="/operacao" className="mt-3 inline-block text-xs text-accent hover:underline">Ver monitoramento e incidentes ↗</Link></Card>
      <Card className="p-4"><h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight"><GitPullRequest className="size-4 text-muted" />Evolução do produto</h2>{!github || github.error || !github.configured ? <p className="mt-3 text-xs text-warning">Consulta GitHub indisponível. Veja a conexão e tente novamente.</p> : !issues.length ? <p className="mt-3 text-xs text-muted">Nenhum PR ou proposta visível para este repositório.</p> : <ul className="mt-3 divide-y divide-border">{issues.slice(0, 5).map((item) => <li key={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" className="block py-2 text-xs leading-relaxed hover:text-accent">{item.title}<span className="mt-1 block text-[10px] text-faint">#{item.number} · {item.kind === "pr" ? "PR" : "Proposta"}</span></a></li>)}</ul>}<div className="mt-3 flex flex-wrap gap-3 text-xs text-accent"><Link href="/github">Todas as revisões ↗</Link>{app?.pagePath && <Link href={`/vault?p=${encodeURIComponent(app.pagePath)}`}>Ficha no vault ↗</Link>}</div></Card>
    </div></div>
  </div>;
}
