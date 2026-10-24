/** Um integrante do time: ficha do vault, acesso MCP, foto e (para diretores) a integração de pedidos. */
export type TeamMember = {
  id: string;
  name: string;
  role: string;
  area: string;
  vaultStatus: string;
  emoji: string;
  /** Caminho da ficha no vault. */
  path: string | null;
  director: DirectorKey | null;
  /** Origem da execução, ex.: "OpenClaw · VPS-02". */
  runtime: string | null;
  /** URL versionada da foto, ou null para usar as iniciais. */
  avatar: string | null;
  lastSeen: string | null;
  lastMessage: string | null;
  calls: number;
  failures: number;
  scopes: string[];
};

/** Identificador estável a partir do nome: minúsculas, sem acento, com hífens. */
export const agentSlug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type DirectorKey = "tom" | "oracle" | "easypanel";

/**
 * Os três diretores de ambiente. O id é o slug do nome no Registro de Agentes do vault
 * (o mesmo dos acessos MCP); aliases mantêm links e fotos de ids antigos no mesmo integrante.
 */
export const DIRECTORS: { id: string; aliases: string[]; director: DirectorKey; name: string; runtime: string; role: string }[] = [
  { id: "tom", aliases: [], director: "tom", name: "Tom", runtime: "OpenClaw · VPS-02", role: "Diretor do ecossistema de agentes no OpenClaw" },
  { id: "hermes-oracle", aliases: ["oracle"], director: "oracle", name: "Hermes Oracle", runtime: "Hermes · VPS-03", role: "Diretor do VPS-03 (Core/Oracle) no Hermes" },
  { id: "hermes-easypanel", aliases: ["easypanel", "hermes-easy"], director: "easypanel", name: "Hermes EasyPanel", runtime: "Hermes · VPS-01", role: "Diretor do VPS-01 (apps/EasyPanel) no Hermes" },
];

/** Id do integrante a partir de um nome ou slug: apelidos de diretor viram o id canônico. */
export function canonicalAgentId(nameOrId: string) {
  const id = agentSlug(nameOrId);
  return DIRECTORS.find((d) => d.aliases.includes(id))?.id ?? id;
}

export type TeamSources = {
  registry: { name: string; emoji: string; area: string; role: string; status: string; path: string | null }[];
  tokens: { name: string; revoked: boolean; lastUsedAt: Date | null; scopes: string[] }[];
  /** Mais recentes primeiro. */
  activity: { agent: string; summary: string; createdAt: Date }[];
  summary: { rows: { agent: string; calls: number; failures: number }[] };
  /** Foto por id gravado; ids antigos de diretor valem até haver foto no id canônico. */
  avatars: Map<string, string>;
};

/**
 * Junta o Registro de Agentes do vault, os acessos MCP, as fotos e os diretores
 * em um integrante por agente. Diretores primeiro, na ordem de DIRECTORS; acessos sem ficha no fim.
 */
export function composeTeam({ registry, tokens, activity, summary, avatars }: TeamSources): TeamMember[] {
  const activeTokens = tokens.filter((t) => !t.revoked);
  const photos = new Map<string, string>();
  for (const [key, url] of avatars) {
    const id = canonicalAgentId(key);
    if (id === key || !photos.has(id)) photos.set(id, url);
  }

  const statsFor = (id: string) => {
    const tokenRows = activeTokens.filter((t) => canonicalAgentId(t.name) === id);
    const calls = activity.filter((a) => canonicalAgentId(a.agent) === id);
    const rows = summary.rows.filter((r) => canonicalAgentId(r.agent) === id);
    const seen = [...tokenRows.map((t) => t.lastUsedAt), calls[0]?.createdAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    return {
      avatar: photos.get(id) ?? null,
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
    const id = uniqueId(canonicalAgentId(a.name));
    const d = DIRECTORS.find((x) => x.id === id);
    members.push({ id, name: a.name, role: a.role || d?.role || "", area: a.area, vaultStatus: a.status, emoji: a.emoji, path: a.path, director: d?.director ?? null, runtime: d?.runtime ?? null, ...statsFor(id) });
  }
  for (const d of DIRECTORS) {
    if (taken.has(d.id)) continue;
    taken.add(d.id);
    members.push({ id: d.id, name: d.name, role: d.role, area: "", vaultStatus: "", emoji: "🤖", path: null, director: d.director, runtime: d.runtime, ...statsFor(d.id) });
  }
  const rank = (m: TeamMember) => (m.director ? DIRECTORS.findIndex((d) => d.director === m.director) : DIRECTORS.length);
  members.sort((a, b) => rank(a) - rank(b));
  // Acessos MCP sem ficha no registro também aparecem, para ninguém ficar de fora.
  for (const t of activeTokens) {
    const id = canonicalAgentId(t.name);
    if (!id || taken.has(id)) continue;
    taken.add(id);
    members.push({ id, name: t.name, role: "Acesso MCP sem ficha no Registro de Agentes", area: "", vaultStatus: "", emoji: "🤖", path: null, director: null, runtime: null, ...statsFor(id) });
  }
  return members;
}

/** Tempo relativo curto em português. */
export function agoLabel(iso: string | null, now: number) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}
