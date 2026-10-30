/** Organização das métricas do Postiz em grupos e resumos comparáveis (puro). */

export type MetricPoint = { total: string; date: string };
export type RawMetric = { label: string; data: MetricPoint[]; percentageChange?: number | null };

export const METRIC_GROUPS = ["audiencia", "alcance", "interacao", "outros"] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];
export const GROUP_LABELS: Record<MetricGroup, string> = { audiencia: "Audiência", alcance: "Alcance e visualizações", interacao: "Interação", outros: "Outros indicadores" };

const LABELS: Record<string, string> = { Followers: "Seguidores", "Follower Count": "Seguidores", "Page followers": "Seguidores da página", Impressions: "Impressões", Reach: "Alcance", Likes: "Curtidas", Views: "Visualizações", Comments: "Comentários", Shares: "Compartilhamentos", Saves: "Salvamentos", Replies: "Respostas", Subscribers: "Inscritos", Reposts: "Reposts", Quotes: "Citações", Clicks: "Cliques" };
/** Contagens acumuladas: o resumo é o último valor, não a soma. */
const CUMULATIVE = /^(followers|page followers|subscribers)$/i;
const GROUP_OF: [RegExp, MetricGroup][] = [
  [/follower|subscriber/i, "audiencia"],
  [/reach|impression|view/i, "alcance"],
  [/like|comment|share|save|repl|repost|quote|click|engag/i, "interacao"],
];

export function metricGroup(label: string): MetricGroup { return GROUP_OF.find(([re]) => re.test(label))?.[1] ?? "outros"; }

export function metricLabel(label: string, identifier: string) {
  if (/^instagram/.test(identifier) && label === "Follower Count") return "Novos seguidores";
  return LABELS[label] ?? label;
}

const num = (p: MetricPoint) => (p.total.trim() !== "" && Number.isFinite(Number(p.total)) ? Number(p.total) : null);

/** Resumo de uma série: último valor para acumulados; soma da janela para séries diárias. */
export function summarize(metric: RawMetric, identifier: string) {
  const points = [...metric.data].sort((a, b) => a.date.localeCompare(b.date));
  const values = points.map(num).filter((v): v is number => v !== null);
  const cumulative = CUMULATIVE.test(metric.label) && !(/^instagram/.test(identifier) && metric.label === "Follower Count");
  const value = values.length ? (cumulative ? values.at(-1)! : values.reduce((a, b) => a + b, 0)) : null;
  return {
    key: metric.label,
    label: metricLabel(metric.label, identifier),
    group: metricGroup(metric.label),
    kind: cumulative ? "ultimo" as const : "soma" as const,
    value,
    change: metric.percentageChange ?? null,
    points,
    values,
    lastDate: points.at(-1)?.date ?? null,
  };
}
export type MetricSummary = ReturnType<typeof summarize>;

export function groupMetrics(metrics: RawMetric[], identifier: string) {
  const all = metrics.map(m => summarize(m, identifier));
  return METRIC_GROUPS.map(group => ({ group, label: GROUP_LABELS[group], items: all.filter(m => m.group === group) })).filter(g => g.items.length);
}

/** Valor principal de um grupo por canal, para a tabela comparativa. */
export function headline(metrics: RawMetric[], identifier: string, group: MetricGroup): MetricSummary | null {
  const items = metrics.map(m => summarize(m, identifier)).filter(m => m.group === group && m.value !== null);
  if (!items.length) return null;
  if (group !== "interacao") return items.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
  // Interação: soma de curtidas, comentários, compartilhamentos etc. do mesmo perfil.
  return { ...items[0], key: "interacao", label: "Interações", value: items.reduce((a, m) => a + (m.value ?? 0), 0), change: null };
}

export function compact(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { notation: Math.abs(value) >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 });
}
