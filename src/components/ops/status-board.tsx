"use client";

import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export type BoardItem = { url: string; name: string; group: string; ok: boolean; unstable?: boolean; status: number | null; error: string | null; ms: number | null; checkedAt: string; since?: string; source: string };

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `há ${h}h` : `há ${Math.round(h / 24)}d`;
}

export function StatusBoard({ initial, groupOrder }: { initial: BoardItem[]; groupOrder: string[] }) {
  const [items, setItems] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  // Novos dados do servidor substituem a verificação local.
  const [prevInitial, setPrevInitial] = React.useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  const checkNow = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/ops/status?force=1");
      if (!r.ok) return void toast.error("Não foi possível verificar agora");
      const json = (await r.json()) as { results: { url: string; name: string; group: string; ok: boolean; status: number; error?: string; ms: number; checkedAt: string }[] };
      const byUrl = new Map(items.map((i) => [i.url, i]));
      for (const r of json.results) byUrl.set(r.url, { ...(byUrl.get(r.url) ?? {}), url: r.url, name: r.name, group: byUrl.get(r.url)?.group ?? r.group, ok: r.ok, status: r.status || null, error: r.error ?? null, ms: r.ms, checkedAt: r.checkedAt, source: "Órbita (agora)" });
      setItems([...byUrl.values()]);
      toast.success("Verificação feita pela Órbita");
    } finally {
      setLoading(false);
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

  const up = items.filter((i) => i.ok).length;
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-[14px] font-semibold">Disponibilidade</div>
          <div className="text-[12px] text-faint">Resultados enviados pelos monitores do n8n · queda confirmada após 2 falhas seguidas</div>
        </div>
        {items.length > 0 && (
          <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums", up === items.length ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>{up}/{items.length} no ar</span>
        )}
        <Button size="sm" variant="ghost" onClick={checkNow} disabled={loading} className={items.length ? "" : "ml-auto"}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} Verificar agora
        </Button>
      </div>
      {items.length === 0 && (
        <p className="py-6 text-center text-[13px] text-muted">Nenhum resultado recebido ainda. Ligue o envio no n8n (veja “Integração com o n8n”) ou clique em “Verificar agora”.</p>
      )}
      <div className="space-y-5">
        {groups.map(([group, list]) => (
          <div key={group}>
            <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-faint">
              {group}<span className="font-normal normal-case tracking-normal">{list.filter((i) => i.ok).length}/{list.length}</span>
            </div>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((r) => {
                let host = r.url;
                try {
                  const u = new URL(r.url);
                  host = u.host + (u.pathname !== "/" ? u.pathname : "");
                } catch {}
                const Icon = !r.ok ? XCircle : r.unstable ? AlertTriangle : CheckCircle2;
                return (
                  <Tooltip key={r.url} content={`${r.source} · ${ago(r.checkedAt)}${r.since ? ` · neste estado desde ${new Date(r.since).toLocaleString("pt-BR")}` : ""}`}>
                    <a href={r.url} target="_blank" rel="noreferrer" className={cn("group flex min-w-0 max-w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 transition hover:border-border-strong", !r.ok ? "border-danger/40 bg-danger/5" : r.unstable ? "border-warning/40" : "border-border")}>
                      <Icon className={cn("size-4 shrink-0", !r.ok ? "text-danger" : r.unstable ? "text-warning" : "text-success")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.name}</span>
                        <span className="block truncate text-[11.5px] text-faint">{host}</span>
                      </span>
                      <span className={cn("shrink-0 text-right text-[11px] tabular-nums", r.ok ? "text-muted" : "text-danger")}>
                        {r.status ?? r.error ?? "—"}
                        {r.ms !== null && <span className="block text-faint">{r.ms}ms</span>}
                      </span>
                      <ExternalLink className="size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
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
