"use client";

import { ArrowUp, CheckCircle2, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { splitActions, type AiAction } from "@/lib/ai-stream";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string; actions?: AiAction[] };
const SUGGESTIONS = ["O que devo priorizar hoje?", "Reorganize minhas tarefas atrasadas", "Cria tarefa: revisar proposta amanhã às 10h", "O que está fora do ar agora?", "Quais agentes cuidam do VPS-03?", "Quais sites são P1 e o que fazer se um cair?", "Resuma as regras do vault", "Monte um plano para quitar minha dívida"];
const EMPTY_HISTORY = "[]";
function subscribeHistory(listener: () => void) { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }
function parseHistory(raw: string): Msg[] { try { const rows = JSON.parse(raw); return Array.isArray(rows) ? rows.filter(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-30) : []; } catch { return []; } }

export function AiChat({ enabled, scope = "pessoal" }: { enabled: boolean; scope?: "pessoal" | "empresa" }) {
  const storageKey = `orbita:chat:${scope}`;
  const getHistory = React.useCallback(() => { try { return sessionStorage.getItem(storageKey) ?? EMPTY_HISTORY; } catch { return EMPTY_HISTORY; } }, [storageKey]);
  const savedHistory = React.useSyncExternalStore(subscribeHistory, getHistory, () => EMPTY_HISTORY);
  const saved = React.useMemo(() => parseHistory(savedHistory), [savedHistory]);
  const [current, setCurrent] = React.useState<Msg[] | null>(null);
  const msgs = current ?? saved;
  function setMsgs(next: Msg[]) { setCurrent(next); try { sessionStorage.setItem(storageKey, JSON.stringify(next.slice(-30))); } catch {} }
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  React.useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, messages: history.slice(-20).map(({ role, content }) => ({ role, content })) }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha ao consultar a IA" }));
        setMsgs([...history, { role: "assistant", content: `⚠️ ${err.error}` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      let parsed = splitActions("");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        parsed = splitActions(acc);
        setMsgs([...history, { role: "assistant", content: parsed.text, actions: parsed.actions }]);
      }
      if (parsed.actions.length) router.refresh();
    } catch {
      setMsgs([...history, { role: "assistant", content: "⚠️ Não foi possível falar com a IA agora." }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex min-h-[70vh] flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
        {msgs.length === 0 && (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-10 text-center">
            <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent"><Sparkles className="size-6" /></span>
            <h2 className="text-lg font-semibold">{scope === "empresa" ? "Próximas decisões da AG LABS" : "Organize seu dia"}</h2>
            <p className="mt-1 text-[13px] text-muted">{scope === "empresa" ? "Contexto empresarial, tarefas internas e operação. Atividades comerciais permanecem no CRM." : "Tarefas pessoais, hábitos, agenda e metas. A IA consulta seu contexto e pode executar as ações que você pedir."}{!enabled && " Configure a chave da IA em Integrações para ativar."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {(scope === "empresa" ? ["O que a empresa deve priorizar hoje?", "Revisar tarefas empresariais atrasadas", "O que está fora do ar agora?", "Resuma as regras do vault"] : SUGGESTIONS).map((s) => <button key={s} disabled={!enabled} onClick={() => send(s)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] hover:border-accent/50 disabled:opacity-50">{s}</button>)}
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
                <div className="prose-orbita text-[14px]">{m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : !m.actions?.length && <span className="animate-pulse text-muted">Pensando…</span>}</div>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-end gap-2 border-t border-border p-3">
        {msgs.length > 0 && <Button type="button" size="icon" variant="ghost" onClick={() => setMsgs([])} aria-label="Limpar conversa"><Trash2 /></Button>}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
          disabled={!enabled}
          placeholder={enabled ? "Escreva sua pergunta…" : "IA desativada — configure OPENAI_API_KEY"}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-[14px] outline-none focus:border-accent/60"
        />
        <button disabled={busy || !input.trim() || !enabled} className="grid size-11 place-items-center rounded-xl bg-fg text-bg disabled:bg-surface-3 disabled:text-faint" aria-label="Enviar"><ArrowUp className="size-4" /></button>
      </form>
    </Card>
  );
}
