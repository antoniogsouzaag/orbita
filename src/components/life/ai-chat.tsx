"use client";

import { ArrowUp, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = ["O que devo priorizar hoje?", "Como foi minha semana?", "Quais agentes cuidam do VPS-03?", "Quais sites são P1 e o que fazer se um cair?", "Resuma as regras do vault", "Monte um plano para quitar minha dívida"];
const KEY = "orbita:chat";

export function AiChat({ enabled }: { enabled: boolean }) {
  const [msgs, setMsgs] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
      setMsgs(JSON.parse(sessionStorage.getItem(KEY) ?? "[]"));
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history.slice(-20) }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha ao consultar a IA" }));
        setMsgs([...history, { role: "assistant", content: `⚠️ ${err.error}` }]);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...history, { role: "assistant", content: acc }]);
      }
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
            <h2 className="text-lg font-semibold">Pergunte sobre seu dia ou sobre a AG LABS</h2>
            <p className="mt-1 text-[13px] text-muted">A IA vê suas tarefas, hábitos, agenda, metas e busca no vault da empresa para responder.{!enabled && " Configure a chave da IA em Integrações para ativar."}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => <button key={s} disabled={!enabled} onClick={() => send(s)} className="rounded-full border border-border bg-surface-2 px-3 py-1.5 text-[12.5px] hover:border-accent/50 disabled:opacity-50">{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "user" ? (
              <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[14px] text-accent-fg">{m.content}</div>
            ) : (
              <div className="prose-orbita max-w-[88%] text-[14px]">{m.content ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown> : <span className="animate-pulse text-muted">Pensando…</span>}</div>
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
