import "server-only";
import { DIRECTORS, agentSlug, type TeamMember } from "@/lib/team";
import { agentAvatarUrls } from "./agent-avatars";
import { agentActivitySummary, listAgentTokens, recentActivity } from "./agents";
import { agents } from "./ops";

type Inputs = {
  tokens?: Awaited<ReturnType<typeof listAgentTokens>>;
  activity?: Awaited<ReturnType<typeof recentActivity>>;
  summary?: Awaited<ReturnType<typeof agentActivitySummary>>;
};

/**
 * Junta o Registro de Agentes do vault, os acessos MCP, as fotos e os diretores
 * em um integrante por agente. Diretores primeiro; acessos sem ficha no fim.
 */
export async function buildTeam(input: Inputs = {}): Promise<TeamMember[]> {
  const [registry, tokens, activity, summary, avatars] = await Promise.all([
    agents().catch(() => []),
    input.tokens ?? listAgentTokens(),
    input.activity ?? recentActivity(60),
    input.summary ?? agentActivitySummary(),
    agentAvatarUrls().catch(() => new Map<string, string>()),
  ]);
  const activeTokens = tokens.filter((t) => !t.revoked);

  const statsFor = (id: string) => {
    const tokenRows = activeTokens.filter((t) => agentSlug(t.name) === id);
    const calls = activity.filter((a) => agentSlug(a.agent) === id);
    const rows = summary.rows.filter((r) => agentSlug(r.agent) === id);
    const seen = [...tokenRows.map((t) => t.lastUsedAt), calls[0]?.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      avatar: avatars.get(id) ?? null,
      lastSeen: seen?.toISOString() ?? null,
      lastMessage: calls[0]?.summary ?? null,
      calls: rows.reduce((n, r) => n + r.calls, 0),
      failures: rows.reduce((n, r) => n + r.failures, 0),
      scopes: [...new Set(tokenRows.flatMap((t) => t.scopes))],
    };
  };

  const members: TeamMember[] = [];
  const taken = new Set<string>();
  const uniqueId = (base: string) => {
    let id = base || "agente";
    for (let n = 2; taken.has(id); n++) id = `${base || "agente"}-${n}`;
    taken.add(id);
    return id;
  };

  for (const a of registry) {
    const base = agentSlug(a.name);
    const id = uniqueId(base);
    const d = DIRECTORS.find((x) => x.id === id);
    members.push({ id, name: a.name, role: a.role || d?.role || "", area: a.area, vaultStatus: a.status, emoji: a.emoji, path: a.path, director: d?.director ?? null, runtime: d?.runtime ?? null, ...statsFor(id) });
  }
  for (const d of DIRECTORS) {
    if (taken.has(d.id)) continue;
    taken.add(d.id);
    members.push({ id: d.id, name: d.name, role: d.role, area: "", vaultStatus: "", emoji: "🤖", path: null, director: d.director, runtime: d.runtime, ...statsFor(d.id) });
  }
  members.sort((a, b) => Number(!!b.director) - Number(!!a.director));
  // Acessos MCP sem ficha no registro também aparecem, para ninguém ficar de fora.
  for (const t of activeTokens) {
    const id = agentSlug(t.name);
    if (!id || taken.has(id)) continue;
    taken.add(id);
    members.push({ id, name: t.name, role: "Acesso MCP sem ficha no Registro de Agentes", area: "", vaultStatus: "", emoji: "🤖", path: null, director: null, runtime: null, ...statsFor(id) });
  }
  return members;
}
