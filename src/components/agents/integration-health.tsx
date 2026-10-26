"use client";

import { ArrowUpRight, CheckCircle2, Circle, CircleAlert, Loader2, Plug, RefreshCw } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { checkIntegrationsAction } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IntegrationHealthRow } from "@/server/integrations";

const STATES = {
  configured: { label: "Configurado", icon: Circle, color: "text-muted" },
  verified: { label: "Verificado", icon: CheckCircle2, color: "text-success" },
  warning: { label: "Requer atenção", icon: CircleAlert, color: "text-warning" },
  missing: { label: "Não configurado", icon: Circle, color: "text-faint" },
  error: { label: "Falha na verificação", icon: CircleAlert, color: "text-danger" },
};

export function IntegrationHealth({ initial }: { initial: IntegrationHealthRow[] }) {
  const [rows, setRows] = React.useState(initial);
  const [pending, start] = React.useTransition();
  const configured = rows.filter((row) => row.state !== "missing").length;
  const groups = ["Coleta dos negócios", "Conexões da central"] as const;
  const verified = rows.filter((row) => row.state === "verified").length;
  const attention = rows.filter((row) => row.state === "warning" || row.state === "error").length;

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-5 p-5">
        <div className="grid size-11 place-items-center rounded-2xl bg-accent/10 text-accent"><Plug className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Saúde das conexões</h2>
          <p className="mt-1 text-[12.5px] text-muted">{configured}/{rows.length} configuradas · {verified} verificadas{attention > 0 ? ` · ${attention} para revisar` : ""}</p>
        </div>
        <Button disabled={pending} onClick={() => start(async () => {
          try {
            setRows(await checkIntegrationsAction());
            toast.success("Diagnóstico atualizado");
          } catch { toast.error("Não foi possível concluir o diagnóstico. Tente novamente."); }
        })}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />} {pending ? "Verificando…" : "Verificar integrações"}</Button>
        <p className="w-full text-[12px] leading-relaxed text-faint">O diagnóstico consulta as conexões de leitura e as batidas registradas. Configuração, resposta da API e entrega de notificações são etapas distintas.</p>
      </Card>
      {groups.map(group => <section key={group} aria-label={group}>
        <h2 className="mb-3 text-base font-semibold">{group}</h2>
        {group === "Coleta dos negócios" && <p className="mb-3 text-xs leading-relaxed text-muted">App → CRM → Órbita. Cada produto mantém seu modelo e indicadores. Uma coleta verificada não comprova pagamento nem cobertura completa; confira a janela e a origem no negócio.</p>}
        <div className="grid gap-3 md:grid-cols-2">
        {rows.filter(row => (row.category ?? "Conexões da central") === group).map((row) => {
          const status = STATES[row.state];
          const Icon = status.icon;
          return (
            <Card key={row.id} className="flex min-w-0 flex-col p-5">
              <div className="flex flex-wrap items-start gap-2">
                <h3 className="text-[14px] font-semibold">{row.name}</h3>
                <span className={cn("ml-auto inline-flex items-center gap-1 text-[11px]", status.color)}><Icon className="size-3.5" />{status.label}</span>
              </div>
              <p className="mt-3 flex-1 text-[12.5px] leading-relaxed text-muted">{row.detail}</p>
              {row.env.length > 0 && <details className="mt-4 text-xs text-faint"><summary className="cursor-pointer">Configuração técnica</summary><div className="mt-2 flex flex-wrap gap-1">{row.env.map((env) => <code key={env} className="break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">{env}</code>)}</div></details>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[11px] text-faint">
                <span>{row.checkedAt ? `Consultado ${new Date(row.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "Conexão ainda não verificada"}</span>
                {row.href && <Link href={row.href} className="ml-auto inline-flex items-center gap-1 text-muted hover:text-fg">Abrir <ArrowUpRight className="size-3" /></Link>}
              </div>
            </Card>
          );
        })}
        </div>
      </section>)}
    </div>
  );
}
