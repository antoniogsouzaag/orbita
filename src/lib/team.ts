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
  director: "tom" | "oracle" | null;
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

/** Diretores com integração de pedidos na Órbita. */
export const DIRECTORS: { id: string; director: "tom" | "oracle"; name: string; runtime: string; role: string }[] = [
  { id: "tom", director: "tom", name: "Tom", runtime: "OpenClaw · VPS-02", role: "Diretor do ecossistema de agentes no OpenClaw" },
  { id: "oracle", director: "oracle", name: "Oracle", runtime: "Hermes · VPS-03", role: "Agente diretor no Hermes" },
];

/** Tempo relativo curto em português. */
export function agoLabel(iso: string | null, now: number) {
  if (!iso) return null;
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h} h` : `há ${Math.round(h / 24)} dias`;
}
