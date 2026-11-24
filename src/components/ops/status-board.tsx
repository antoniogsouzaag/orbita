"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import * as React from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type BoardItem = { url: string; name: string; group: string; ok: boolean; stale?: boolean; unstable?: boolean; status: number | null; error: string | null; ms: number | null; checkedAt: string; since?: string; source: string };

const probeSchema = z.object({
  configured: z.boolean(),
  total: z.number().int().nonnegative(),
  results: z.array(z.object({
    url: z.string(), name: z.string(), ok: z.boolean(), status: z.number().int().nonnegative(),
    error: z.string().optional(), ms: z.number().nonnegative(), checkedAt: z.iso.datetime(),
  })),
});
type ProbeState =
  | { status: "idle" | "loading" | "unavailable" | "empty" | "error" }
  | { status: "results"; total: number; rows: z.infer<typeof probeSchema>["results"] };

const probeMessage: Record<Exclude<ProbeState["status"], "idle" | "results">, string> = {
  loading: "Verificação pontual em andamento…",
  unavailable: "Verificação pontual indisponível. Não foi possível carregar a lista de endereços do vault.",
  empty: "Nenhum endereço configurado para verificação pontual.",
  error: "Não foi possível concluir a verificação pontual. Tente novamente.",
};

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)}d`;
}

export function StatusBoard({ initial: items, groupOrder }: { initial: BoardItem[]; groupOrder: string[] }) {
  const [probe, setProbe] = React.useState<ProbeState>({ status: "idle" });
  const loading = probe.status === "loading";

  const checkNow = async () => {
    setProbe({ status: "loading" });
    try {
      const r = await fetch("/api/ops/status?force=1");
      if (!r.ok) throw new Error("Verificação indisponível");
      const data = probeSchema.parse(await r.json());
      if (!data.configured) setProbe({ status: "unavailable" });
      else if (data.total === 0 && data.results.length === 0) setProbe({ status: "empty" });
      else setProbe({ status: "results", total: data.total, rows: data.results });
    } catch {
      setProbe({ status: "error" });
    }
  };

  const groups = React.useMemo(() => {
    const m = new Map<string, BoardItem[]>();
    for (const r of items) {
      const g = r.group || "Outros";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return [...m.entries()].sort((a, b) => {
      const ia = groupOrder.indexOf(a[0]);
      const ib = groupOrder.indexOf(b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0]);
    });
  }, [items, groupOrder]);

  const current = items.filter((i) => !i.stale);
  const up = current.filter((i) => i.ok).length;
  const stale = items.length - current.length;
  return (
    <Card className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[14px] font-semibold">Disponibilidade</div>
          <div className="text-[12px] text-faint">Resultados enviados pelos monitores do n8n · queda confirmada após 2 falhas seguidas</div>
        </div>
        {items.length > 0 && (
          <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums", stale ? "bg-warning/15 text-warning" : up === current.length ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>{current.length ? `${up}/${current.length} no ar` : "Sem verificação recente"}{stale ? ` · ${stale} sem atualização` : ""}</span>
        )}
        <Button size="sm" variant="ghost" onClick={checkNow} disabled={loading} className={items.length ? "" : "ml-auto"}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Verificar agora
        </Button>
      </div>
      {probe.status !== "idle" && (
        <section aria-label="Verificação pontual da Órbita" className="mb-4 rounded-lg border border-border bg-surface-2/50 p-3">
          <h3 className="text-[13px] font-semibold">Verificação pontual · Órbita</h3>
          <p className="mt-1 text-xs text-muted">Este teste não confirma queda ou recuperação e não altera o histórico do n8n.</p>
          {probe.status === "results" ? (
            <>
              <p role="status" className="mt-2 text-xs text-muted">{probe.rows.length < probe.total ? `Resultado parcial: ${probe.rows.length} de ${probe.total} endereços retornaram.` : `${probe.rows.length} endereço(s) verificado(s).`}</p>
              {probe.rows.length > 0 && <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {probe.rows.map((row, index) => (
                  <li key={`${row.url}:${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs">
                    <span className="min-w-0 break-all font-medium" title={row.url}>{row.name || row.url}</span>
                    <span className="text-muted">
                      <span className={row.ok ? "text-success" : "text-warning"}>{row.ok ? "Respondeu ao teste" : "Falhou no teste"}</span>
                      {row.status ? ` · HTTP ${row.status}` : ""}{row.error ? ` · ${row.error}` : ""} · {row.ms} ms · <time dateTime={row.checkedAt}>{new Date(row.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" })}</time>
                    </span>
                  </li>
                ))}
              </ul>}
            </>
          ) : <p role="status" className="mt-2 text-xs text-muted">{probeMessage[probe.status]}</p>}
        </section>
      )}
      {items.length === 0 && (
        <p className="py-6 text-center text-[13px] text-muted">Nenhum resultado recebido do n8n ainda. “Verificar agora” faz um teste separado, sem substituir os dados dos monitores.</p>
      )}
      <div className="space-y-4">
        {groups.map(([group, list]) => (
          <div key={group}>
            <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-faint">
              {group}<span className="font-normal normal-case tracking-normal">{list.some((i) => !i.stale) ? `${list.filter((i) => i.ok && !i.stale).length}/${list.filter((i) => !i.stale).length} recentes` : "sem verificação recente"}{list.some((i) => i.stale) ? ` · ${list.filter((i) => i.stale).length} sem atualização` : ""}</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {list.map((r) => {
                let host = r.url;
                try {
                  const u = new URL(r.url);
                  host = u.host + (u.pathname !== "/" ? u.pathname : "");
                } catch {}
                const Icon = r.stale ? AlertTriangle : !r.ok ? XCircle : r.unstable ? AlertTriangle : CheckCircle2;
                return (
                  <Tooltip key={r.url} content={`${r.name} · ${host} · ${r.source} · ${ago(r.checkedAt)}${r.error ? ` · ${r.error}` : ""}${r.since ? ` · neste estado desde ${new Date(r.since).toLocaleString("pt-BR")}` : ""}`}>
                    <a href={r.url} target="_blank" rel="noreferrer" aria-label={`${r.name} · ${host} · ${r.stale ? "Sem verificação recente" : !r.ok ? "Fora do ar" : r.unstable ? "Instável" : "No ar"}${r.status ? ` · último HTTP ${r.status}` : ""}`} className={cn("group flex min-h-9 min-w-0 max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 transition hover:border-border-strong", r.stale ? "border-warning/40" : !r.ok ? "border-danger/40 bg-danger/5" : r.unstable ? "border-warning/40" : "border-border")}>
                      <Icon className={cn("size-4 shrink-0", r.stale ? "text-warning" : !r.ok ? "text-danger" : r.unstable ? "text-warning" : "text-success")} />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{r.name || host}</span>
                      <span className={cn("flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10.5px] tabular-nums", r.stale ? "text-warning" : r.ok ? "text-muted" : "text-danger")}>
                        {r.stale ? "Sem atualização" : r.status ?? (r.error ? "Falha" : "—")}
                        {!r.stale && r.ms !== null && <span className="text-faint">{r.ms}ms</span>}
                      </span>
                      <ExternalLink className="size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
                    </a>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
