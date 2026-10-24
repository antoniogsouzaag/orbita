"use client";

import { ArrowUp, CheckCircle2, Sparkles, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type AiAction, type AiSource } from "@/lib/ai-stream";
import { readChatStream } from "@/lib/ai-chat-stream";
import { boundedChatHistory, CHAT_LIMITS } from "@/lib/orbe-chat";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; actions?: AiAction[]; sources?: AiSource[] };
const SUGGESTIONS = ["O que devo priorizar hoje?", "Reorganize minhas tarefas atrasadas", "Cria tarefa: revisar proposta amanhã às 10h", "O que está fora do ar agora?", "Quais agentes cuidam do VPS-03?", "Quais sites são P1 e o que fazer se um cair?", "Resuma as regras do vault", "Monte um plano para quitar minha dívida"];
const EMPTY_HISTORY = "[]";
function subscribeHistory(listener: () => void) { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }
function parseHistory(raw: string): Msg[] { try { const rows = JSON.parse(raw); return Array.isArray(rows) ? boundedChatHistory(rows.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")) : []; } catch { return []; } }

export function AiChat({ enabled, scope = "pessoal", trustedActionOrigins = [] }: { enabled: boolean; scope?: "pessoal" | "empresa"; trustedActionOrigins?: string[] }) {
  const storageKey = `orbita:chat:${scope}`;
  const getHistory = React.useCallback(() => { try { return sessionStorage.getItem(storageKey) ?? EMPTY_HISTORY; } catch { return EMPTY_HISTORY; } }, [storageKey]);
  const savedHistory = React.useSyncExternalStore(subscribeHistory, getHistory, () => EMPTY_HISTORY);
  const saved = React.useMemo(() => parseHistory(savedHistory), [savedHistory]);
  const [current, setCurrent] = React.useState<Msg[] | null>(null);
  const msgs = current ?? saved;
  function setMsgs(next: Msg[]) { setCurrent(next); try { sessionStorage.setItem(storageKey, JSON.stringify(boundedChatHistory(next))); } catch {} }
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [readOnly, setReadOnly] = React.useState(false);
  const active = React.useRef<AbortController | null>(null);
  React.useEffect(() => () => { const pending = active.current; active.current = null; pending?.abort(); }, []);
  const end = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const update = (next: Msg[]) => { if (active.current === controller) setMsgs(next); };
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ scope, readOnly, messages: boundedChatHistory(history).map(({ role, content }) => ({ role, content })) }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha ao consultar a IA" }));
        update([...history, { role: "assistant", content: `⚠️ ${err.error}` }]);
        return;
      }
      const parsed = await readChatStream(res.body, value => update([...history, { role: "assistant", content: value.text, actions: value.actions, sources: value.sources }]), trustedActionOrigins);
      if (parsed.actions.length && active.current === controller) router.refresh();
    } catch {
      update([...history, { role: "assistant", content: controller.signal.aborted ? "⚠️ Resposta interrompida. Ações já iniciadas podem concluir; confira o estado antes de repetir." : "⚠️ Não foi possível falar com ORBE agora." }]);
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  };

  return (
    <Card className="flex min-h-[70vh] flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-3 text-[12px] text-muted">
        <label className="flex items-center gap-2"><input type="checkbox" checked={readOnly} disabled={busy} onChange={e => setReadOnly(e.target.checked)} /> Somente leitura — consultar sem executar escritas</label>
        <p className="mt-1">Histórico só nesta aba, separado por espaço; não é memória permanente. Interromper não desfaz ações já iniciadas.</p>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
        {msgs.length === 0 && (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-10 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent"><Sparkles className="size-6" /></span>
            <h2 className="text-lg font-semibold">{scope === "empresa" ? "ORBE · decisões da AG LABS" : "Seu dia com ORBE"}</h2>
            <p className="mt-1 text-[13px] text-muted">{scope === "empresa" ? "Estratégia, produtos, metas e operação conectados ao Vault e ao CRM. Vamos transformar contexto em próximos passos." : "Tarefas pessoais, hábitos, agenda e metas. A IA consulta seu contexto e pode executar as ações que você pedir."}{!enabled && " Configure a chave da IA em Integrações para ativar."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(scope === "empresa" ? ["O que a empresa deve priorizar para crescer?", "Explore o Vault e proponha metas para os próximos 30 dias", "Quais oportunidades existem entre nossos produtos e serviços?", "Vamos pensar no próximo passo do Barberias"] : SUGGESTIONS).map((s) => <button key={s} disabled={!enabled} onClick={() => send(s)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] hover:border-accent/50 disabled:opacity-50">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] text-accent-fg">{m.content}</div>
            ) : (
              <div className="max-w-[88%] space-y-2">
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.actions.map((a, j) => (
                      <Link key={j} href={a.href} className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[12px] text-success hover:bg-success/15">
                        <CheckCircle2 className="size-3.5" /> {a.label}
                      </Link>
                    ))}
                  </div>
                )}
                {!!m.sources?.length && <div className="flex flex-wrap gap-1.5" aria-label="Consultas realizadas">{m.sources.map((source, j) => <span key={j} className="rounded-full border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted">{source.ok ? "Consultou" : "Falhou"}: {source.name.replaceAll("_", " ")}</span>)}</div>}
                <div className="prose-orbita text-[14px]">{m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : !m.actions?.length && <span className="animate-pulse text-muted">Pensando…</span>}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-border p-3">
        {msgs.length > 0 && <Button type="button" size="icon" variant="ghost" disabled={busy} onClick={() => setMsgs([])} aria-label="Limpar conversa"><Trash2 /></Button>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          maxLength={CHAT_LIMITS.user}
          disabled={!enabled}
          placeholder={enabled ? "Converse com ORBE: ideias, dúvidas, objetivos ou ações…" : "IA desativada — configure OPENAI_API_KEY"}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[14px] outline-none focus:border-accent/60"
        />
        {busy && <Button type="button" size="icon" variant="ghost" onClick={() => active.current?.abort()} aria-label="Interromper resposta"><Square /></Button>}
        <button disabled={busy || !input.trim() || !enabled} className="grid size-11 place-items-center rounded-xl bg-fg text-bg disabled:bg-surface-3 disabled:text-faint" aria-label="Enviar"><ArrowUp className="size-4" /></button>
      </form>
    </Card>
  );
}
