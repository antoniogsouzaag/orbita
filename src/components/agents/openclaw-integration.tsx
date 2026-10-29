"use client";
import * as React from "react";
import { toast } from "sonner";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { refreshOpenclaw, sendOpenclaw } from "@/app/actions/openclaw";
import type { DispatchStatus } from "@/db/schema";
import type { DispatchView } from "@/server/dispatch";
import type { openclawConfiguration, OpenclawCommand } from "@/server/openclaw";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Chip } from "@/components/ui/misc";

const ACTION_LABEL: Record<string, string> = { "diagnostics.read": "Diagnóstico do VPS-02", "incident.diagnose": "Diagnóstico de incidente", "request.tom": "Pedido ao Tom" };
const STATUS: Partial<Record<DispatchStatus, { label: string; color: string }>> = {
  sending: { label: "enviando", color: "var(--muted)" },
  accepted: { label: "recebido", color: "var(--accent)" },
  rejected: { label: "recusado", color: "var(--danger)" },
  unknown: { label: "envio incerto", color: "var(--warning)" },
  running: { label: "em execução", color: "var(--accent)" },
  completed: { label: "concluído", color: "var(--success)" },
  failed: { label: "falhou", color: "var(--danger)" },
};
const when = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const isUrl = (s: string) => /^https:\/\/\S+$/.test(s);

export function OpenclawIntegration({ config, initial, history: controlledHistory, onHistoryChange, hideHistory = false, variant = "card" }: { config: ReturnType<typeof openclawConfiguration>; initial: DispatchView[]; history?: DispatchView[]; onHistoryChange?: React.Dispatch<React.SetStateAction<DispatchView[]>>; hideHistory?: boolean; /** "action": só os botões e o diálogo, para usar dentro de outro card. */ variant?: "card" | "action" }) {
  const [open, setOpen] = React.useState(false);
  const [localHistory, setLocalHistory] = React.useState(initial);
 const history = controlledHistory ?? localHistory;
 const setHistory = onHistoryChange ?? setLocalHistory;
  const [pending, start] = React.useTransition();
  const [texto, setTexto] = React.useState("");
  const ready = config.enabled && config.endpointConfigured && config.tokenConfigured;

  function send(command: OpenclawCommand, reset?: () => void) {
    start(async () => {
      try {
        const item = await sendOpenclaw(command);
        setHistory(old => [item, ...old.filter((row) => row.id !== item.id)].slice(0, 30));
        if (["accepted", "running", "completed"].includes(item.status)) { toast.success(item.status === "completed" ? "Resultado do Tom disponível." : "Pedido recebido pelo gateway do Tom."); reset?.(); }
        else toast.error(item.detail);
      } catch { toast.error("Não foi possível registrar o pedido."); }
    });
  }
  function refresh() {
    start(async () => { try { setHistory(await refreshOpenclaw()); } catch { toast.error("Não foi possível atualizar o histórico."); } });
  }

  const dialog = (
      <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent title="Mensagem para Tom" description="Pedido manual ao diretor do OpenClaw. O retorno fica no histórico do agente." wide>
      <div className="flex flex-wrap gap-2">
        <Chip color={config.enabled ? "var(--success)" : "var(--muted)"}>Despacho {config.enabled ? "habilitado" : "desabilitado"}</Chip>
        <Chip color={config.endpointConfigured ? "var(--success)" : "var(--warning)"}>Rota {config.endpointConfigured ? "configurada" : "pendente"}</Chip>
        <Chip color={config.tokenConfigured ? "var(--success)" : "var(--warning)"}>Token {config.tokenConfigured ? "configurado" : "pendente"}</Chip>
      </div>

      <div>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); send({ action: "request.tom", params: { texto } }, () => setTexto("")); }}>
          <label htmlFor="pedido-tom" className="text-xs font-medium text-muted">Pedido ao Tom</label>
          <Textarea id="pedido-tom" required minLength={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que o Tom deve analisar ou propor para o VPS-02 e os agentes do OpenClaw" />
          <Button size="sm" disabled={!ready || pending}><Send className="size-4" />Enviar mensagem</Button>
        </form>
      </div>
      <p className="text-xs text-muted">Este canal retorna análise e proposta, sem mudanças automáticas. Recebido significa que o gateway aceitou o pedido; acompanhe o resultado no histórico. Se o envio for incerto, confira antes de reenviar.</p>

      </DialogContent></Dialog>
  );
  if (variant === "action") return <>
    <Button size="sm" onClick={() => setOpen(true)}><MessageSquare />Mensagem</Button>
    {dialog}
  </>;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold">Tom · OpenClaw (VPS-02)</h2>
          <p className="mt-1 text-sm text-muted">{ready ? "Pedidos entram pela rota /hooks/orbita. O adaptador interno do Tom devolve diagnóstico e proposta aqui pelo MCP." : "Saída para o OpenClaw pendente de configuração no servidor."}</p>
        </div>
        <Button size="sm" variant="ghost" disabled={pending} onClick={refresh} aria-label="Atualizar pedidos"><RefreshCw className="size-4" />Atualizar</Button>
      </div>
      <Button size="sm" onClick={() => setOpen(true)}><MessageSquare />Mensagem</Button>
      {dialog}
      {!hideHistory && <details className="rounded-xl border border-border px-4"><summary className="cursor-pointer py-3 text-sm font-medium">Histórico de pedidos <span className="ml-2 text-xs text-muted">{history.length} registros</span></summary><div className="divide-y divide-border">
        {history.length === 0 && <p className="py-3 text-sm text-muted">Nenhum pedido enviado ainda.</p>}
        {history.map((item) => {
          const status = STATUS[item.status] ?? { label: "Envio incerto", color: "var(--warning)" };
          const ask = typeof item.params?.texto === "string" ? item.params.texto : typeof item.params?.assunto === "string" ? item.params.assunto : null;
          return (
            <div key={item.id} className="space-y-1.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{ACTION_LABEL[item.action] ?? item.action}</span>
                <Chip color={status.color}>{status.label}</Chip>
                {item.silent && <Chip color="var(--warning)">sem retorno</Chip>}
                <span className="ml-auto text-xs text-faint">{when(item.createdAt)}</span>
              </div>
              {ask && <p className="line-clamp-2 text-xs text-muted">{ask}</p>}
              {item.summary ? <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm">{item.summary}</p> : <p className="text-xs text-muted">{item.detail}</p>}
              {item.evidence && <p className="break-all text-xs text-muted">Evidência: {isUrl(item.evidence) ? <a className="underline" href={item.evidence} target="_blank" rel="noopener noreferrer">{item.evidence}</a> : item.evidence}</p>}
              <p className="break-all text-[10px] text-faint">{item.id}{item.reportedBy ? ` · ${item.reportedBy}` : ""}{item.finishedAt ? ` · encerrado ${when(item.finishedAt)}` : ""}</p>
            </div>
          );
        })}
      </div></details>}
    </Card>
  );
}
