import "server-only";
import { getVaultIndex, getVaultProvider } from "@/server/vault";
import { agents, appRegistry, checkTargets, documentedAutomations, monitorTargets, n8nOverview, vpsList } from "./ops";

/** Pacote de contexto operacional para agentes (sem dados pessoais nem segredos). */
export async function buildContext(opts: { live?: boolean } = {}) {
  const [ags, vps, apps, autos, targets] = await Promise.all([agents(), vpsList(), appRegistry(), documentedAutomations(), monitorTargets()]);
  const status = opts.live && targets ? await checkTargets(targets) : null;
  const n8n = opts.live ? await n8nOverview() : null;
  let index: string | null = null;
  let rules: string | null = null;
  let notes: { path: string; title: string; type: string; status: string }[] = [];
  if (getVaultProvider()) {
    const idx = await getVaultIndex();
    const inicio = [...idx.notes.values()].find((n) => /in[ií]cio/i.test(n.title) && n.frontmatter.type === "index");
    const guia = [...idx.notes.values()].find((n) => /guia de contribui/i.test(n.title));
    index = inicio?.body ?? null;
    rules = guia?.body ?? null;
    notes = [...idx.notes.values()].map((n) => ({ path: n.path, title: n.title, type: String(n.frontmatter.type ?? ""), status: String(n.frontmatter.status ?? "") }));
  }
  return { generatedAt: new Date().toISOString(), vault: { index, rules, notes }, agents: ags, vps, apps, automations: autos, monitoring: targets, status, n8n };
}

export function contextToMarkdown(c: Awaited<ReturnType<typeof buildContext>>): string {
  const lines: string[] = [];
  lines.push(`# Contexto operacional — AG LABS`, ``, `Gerado em ${c.generatedAt} pela Órbita a partir do vault canônico. Fonte de verdade: o vault (\`aglabs-core/ag-labs-knowledge\`).`, ``);
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
      lines.push(`- ${m.priority} · ${m.name}: ${m.url}${s ? ` → ${s.ok ? "✅" : "❌"} ${s.status || s.error}` : ""}`);
    }
  }
  if (c.n8n?.configured) {
    lines.push(``, `## n8n (ao vivo)`, ``);
    for (const i of c.n8n.instances) lines.push(`- ${i.name}: ${i.ok ? `${i.workflows.filter((w) => w.active).length} workflows ativos de ${i.workflows.length}; ${i.errors.length} falhas recentes` : `erro: ${i.error}`}`);
  }
  lines.push(``, `## Notas do vault (${c.vault.notes.length})`, ``);
  for (const n of c.vault.notes) lines.push(`- \`${n.path}\`${n.type ? ` — ${n.type}` : ""}${n.status ? ` (${n.status})` : ""}`);
  return lines.join("\n");
}
