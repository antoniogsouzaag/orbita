import "server-only";
import { AGENT_MANUAL_PATH, AGENT_MANUAL_URI, AGENT_MANUAL_VERSION } from "@/lib/agent-handbook";
import { getVaultIndexSafe, vaultHealth } from "@/server/vault";
import { agents, appRegistry, documentedAutomations, monitorTargets, n8nOverview, vpsList } from "./ops";
import { liveOps } from "./ops-live";

/** Pacote de contexto operacional para agentes (sem dados pessoais nem segredos). */
export async function buildContext(opts: { live?: boolean } = {}) {
  const [ags, vps, apps, autos, targets] = await Promise.all([agents(), vpsList(), appRegistry(), documentedAutomations(), monitorTargets()]);
  const live = opts.live ? await liveOps() : null;
  const status = live ? live.status.map((s) => ({ url: s.url, ok: s.ok, status: s.statusCode, error: s.error, checkedAt: s.checkedAt.toISOString() })) : null;
  const n8n = opts.live ? await n8nOverview() : null;
  let index: string | null = null;
  let rules: string | null = null;
  let notes: { path: string; title: string; type: string; status: string }[] = [];
  const health = await vaultHealth();
  const idx = health.ok ? await getVaultIndexSafe() : null;
  if (idx) {
    const inicio = [...idx.notes.values()].find((n) => /in[ií]cio/i.test(n.title) && n.frontmatter.type === "index");
    const guia = [...idx.notes.values()].find((n) => /guia de contribui/i.test(n.title));
    index = inicio?.body ?? null;
    rules = guia?.body ?? null;
    notes = [...idx.notes.values()].map((n) => ({ path: n.path, title: n.title, type: String(n.frontmatter.type ?? ""), status: String(n.frontmatter.status ?? "") }));
  }
  return {
    generatedAt: new Date().toISOString(),
    manual: { version: AGENT_MANUAL_VERSION, page: AGENT_MANUAL_PATH, resource: AGENT_MANUAL_URI },
    vault: { index, rules, notes, error: health.configured && !health.ok ? health.error : null },
    agents: ags,
    vps,
    apps,
    automations: autos,
    monitoring: targets,
    status,
    incidents: live ? live.events.filter((e) => e.severity !== "info" && !e.resolvedAt).map((e) => ({ subject: e.subject, since: e.createdAt.toISOString() })) : null,
    monitors: live ? live.monitors.map((m) => ({ label: m.label, lastSeen: m.lastSeen.toISOString(), silent: m.silent })) : null,
    n8n,
  };
}

export function contextToMarkdown(c: Awaited<ReturnType<typeof buildContext>>): string {
  const lines: string[] = [];
  lines.push(`# Contexto operacional — AG LABS`, ``, `Gerado em ${c.generatedAt} pela Órbita a partir do vault canônico. Fonte de verdade: o vault (\`aglabs-core/ag-labs-knowledge\`).`, ``);
  lines.push(`Manual da central: ${c.manual.page} · MCP ${c.manual.resource} · versão ${c.manual.version}. Tarefas pessoais e empresariais são separadas; atividades comerciais pertencem ao CRM.`, ``);
  if (c.vault.error) lines.push(`> ⚠️ Vault indisponível agora — inventário abaixo pode estar vazio. Motivo: ${c.vault.error}`, ``);
  if (c.vault.rules) lines.push(`## Regras do vault`, ``, c.vault.rules.replace(/^#.*\n/, "").trim(), ``);
  lines.push(`## Agentes (${c.agents.length})`, ``, `| Agente | Área | Função | Status | Ficha |`, `|---|---|---|---|---|`);
  for (const a of c.agents) lines.push(`| ${a.emoji} ${a.name} | ${a.area} | ${a.role} | ${a.status} | ${a.path ?? ""} |`);
  lines.push(``, `## Servidores (${c.vps.length})`, ``);
  for (const v of c.vps) lines.push(`- **${v.name}** (${v.provider}${v.identifier ? `, \`${v.identifier}\`` : ""}) — ${v.summary} · ficha: \`${v.path}\``);
  lines.push(``, `## Aplicações (${c.apps.length})`, ``, `| Repositório | Branch | Verificação | Portão |`, `|---|---|---|---|`);
  for (const a of c.apps) lines.push(`| ${a.repo} | ${a.branch} | \`${a.check}\` | ${a.gate} |`);
  lines.push(``, `## Automações documentadas (${c.automations.length})`, ``);
  for (const a of c.automations) lines.push(`- **${a.name}**${a.id ? ` (\`${a.id}\`)` : ""} — ${a.description}${a.schedule ? ` · ${a.schedule}` : ""} · ${a.where}`);
  if (c.monitoring) {
    lines.push(``, `## Monitoramento (${c.monitoring.length} endereços)`, ``);
    for (const m of c.monitoring) {
      const s = c.status?.find((x) => x.url === m.url);
      lines.push(`- ${m.priority} · ${m.name}: ${m.url}${s ? ` → ${s.ok ? "✅" : "❌"} ${s.status ?? s.error ?? ""}` : ""}`);
    }
  }
  if (c.incidents?.length) {
    lines.push(``, `## Incidentes abertos`, ``);
    for (const i of c.incidents) lines.push(`- ❌ ${i.subject} desde ${i.since}`);
  }
  if (c.monitors?.length) {
    lines.push(``, `## Monitores`, ``);
    for (const m of c.monitors) lines.push(`- ${m.silent ? "⚠️ em silêncio" : "✅"} ${m.label} — última batida ${m.lastSeen}`);
  }
  if (c.n8n?.configured) {
    lines.push(``, `## n8n (ao vivo)`, ``);
    for (const i of c.n8n.instances) lines.push(`- ${i.name}: ${i.ok ? `${i.workflows.filter((w) => w.active).length} workflows ativos de ${i.workflows.length}${i.workflowsPartial ? " na amostra; inventário incompleto" : ""}; ${i.errors.length} falhas recentes retornadas (limite 25)` : `erro: ${i.error}`}`);
  }
  lines.push(``, `## Notas do vault (${c.vault.notes.length})`, ``);
  for (const n of c.vault.notes) lines.push(`- \`${n.path}\`${n.type ? ` — ${n.type}` : ""}${n.status ? ` (${n.status})` : ""}`);
  return lines.join("\n");
}
