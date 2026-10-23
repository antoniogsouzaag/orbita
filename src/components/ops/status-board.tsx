"use client";

import { CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CheckResult } from "@/server/ops";

type Resp = { configured: boolean; total: number; up: number; results: CheckResult[]; checkedAt: string };

export function StatusBoard() {
  const [data, setData] = React.useState<Resp | null>(null);
  const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(async (force = false) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/ops/status${force ? "?force=1" : ""}`);
      if (r.ok) setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
    const t = setInterval(() => load(), 120_000);
    return () => clearInterval(t);
  }, [load]);

  const groups = React.useMemo(() => {
    const m = new Map<string, CheckResult[]>();
    for (const r of data?.results ?? []) {
      if (!m.has(r.group)) m.set(r.group, []);
      m.get(r.group)!.push(r);
    }
    return [...m.entries()];
  }, [data]);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div>
          <div className="text-[14px] font-semibold">Disponibilidade</div>
          <div className="text-[12px] text-faint">Lista lida de “Monitoramento de Disponibilidade” no vault · 2xx/3xx = no ar</div>
        </div>
        {data?.configured && (
          <span className={cn("ml-auto rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums", data.up === data.total ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
            {data.up}/{data.total} no ar
          </span>
        )}
        <Button size="icon-sm" variant="ghost" onClick={() => load(true)} disabled={loading} aria-label="Verificar agora" className={data?.configured ? "" : "ml-auto"}>
          {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
        </Button>
      </div>
      {!data && loading && <div className="py-8 text-center text-[13px] text-muted">Verificando endereços…</div>}
      {data && !data.configured && <div className="py-8 text-center text-[13px] text-muted">Conecte o vault para carregar a lista de monitoramento.</div>}
      <div className="space-y-5">
        {groups.map(([group, items]) => (
          <div key={group}>
            <div className="mb-2 flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-faint">
              {group}
              <span className="font-normal normal-case tracking-normal">{items.filter((i) => i.ok).length}/{items.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => {
                let host = r.url;
                try {
                  const u = new URL(r.url);
                  host = u.host + (u.pathname !== "/" ? u.pathname : "");
                } catch {}
                return (
                  <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className={cn("group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition hover:border-border-strong", r.ok ? "border-border" : "border-danger/40 bg-danger/5")}>
                    {r.ok ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <XCircle className="size-4 shrink-0 text-danger" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{host}</span>
                      <span className="block truncate text-[11.5px] text-faint">{r.name}</span>
                    </span>
                    <span className={cn("shrink-0 text-right text-[11px] tabular-nums", r.ok ? "text-muted" : "text-danger")}>
                      {r.status || r.error}
                      <br />
                      <span className="text-faint">{r.ms}ms</span>
                    </span>
                    <ExternalLink className="size-3 shrink-0 text-faint opacity-0 group-hover:opacity-100" />
                  </a>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {data?.checkedAt && <div className="mt-4 text-right text-[11px] text-faint">Última verificação: {new Date(data.checkedAt).toLocaleTimeString("pt-BR")}</div>}
    </Card>
  );
}
