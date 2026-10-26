"use client";

import { ArrowUp, Brain, Check, CheckCircle2, Copy, Eye, History, Plus, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { ThinkingState, type TraceNode } from "@/components/ui/ai-agent-response";
import { type AiAction, type AiSource, type AiStep, type ChatPart } from "@/lib/ai-stream";
import { readChatStream } from "@/lib/ai-chat-stream";
import { boundedChatHistory, CHAT_LIMITS } from "@/lib/orbe-chat";
import { cn } from "@/lib/utils";
import { OrbeMemoryDialog } from "./orbe-memory-dialog";
import { stepNode, workingLabel } from "./orbe-steps";

type Msg = { role: "user" | "assistant"; content: string; actions?: AiAction[]; sources?: AiSource[]; parts?: ChatPart[]; startedAt?: number; durationMs?: number };
type Scope = "pessoal" | "empresa";

const SUGGESTIONS: Record<Scope, string[]> = {
  pessoal: ["O que devo priorizar hoje?", "Reorganize minhas tarefas atrasadas", "Cria tarefa: revisar proposta amanhã às 10h", "O que está fora do ar agora?", "Resuma as regras do vault", "Monte um plano para quitar minha dívida"],
  empresa: ["O que a empresa deve priorizar para crescer?", "Explore o Vault e proponha metas para os próximos 30 dias", "Quais oportunidades existem entre nossos produtos e serviços?", "Vamos pensar no próximo passo do Barberias"],
};

/** Pergunta enviada pela captura da Home: a tela da ORBE a envia ao abrir. */
export const pendingPromptKey = (scope: Scope) => `orbita:chat:pending:${scope}`;

type Segment = { type: "text"; text: string } | { type: "steps"; steps: AiStep[] };
function segments(m: Msg): Segment[] {
  const parts: ChatPart[] = m.parts ?? [
    // Conversas antigas: só havia a lista de consultas, sem ordem nem status ao vivo.
    ...(m.sources ?? []).map((s, i): ChatPart => ({ type: "step", step: { id: i, name: s.name, status: s.ok ? "done" : "failed", write: false } })),
    ...(m.content ? [{ type: "text" as const, text: m.content }] : []),
  ];
  const out: Segment[] = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (p.type === "step") { if (last?.type === "steps") last.steps.push(p.step); else out.push({ type: "steps", steps: [p.step] }); }
    else if (p.text.trim() || last?.type === "text") { if (last?.type === "text") last.text += p.text; else out.push({ type: "text", text: p.text }); }
  }
  return out;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {}); }}
      className="grid size-7 place-items-center rounded-md text-faint transition hover:bg-surface-2 hover:text-fg"
      aria-label={copied ? "Copiado" : "Copiar resposta"}
      title={copied ? "Copiado" : "Copiar"}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function AssistantMessage({ m, live }: { m: Msg; live: boolean }) {
  const segs = segments(m);
  const stepGroups = segs.filter(s => s.type === "steps").length;
  const lastStep = [...segs].reverse().find((s): s is Extract<Segment, { type: "steps" }> => s.type === "steps")?.steps.at(-1);
  const waiting = live && (segs.length === 0 || segs.at(-1)?.type === "steps");
  return (
    <div className="group/msg flex flex-col gap-3">
      {segs.map((s, i) => {
        if (s.type === "text") return <div key={i} className="prose-orbita text-[15px]"><ReactMarkdown remarkPlugins={[remarkGfm]}>{s.text}</ReactMarkdown></div>;
        const working = waiting && i === segs.length - 1;
        const nodes: TraceNode[] = s.steps.map(stepNode);
        return <ThinkingState key={i} nodes={nodes} working={working} workingLabel={working ? workingLabel(lastStep) : undefined} startedAt={m.startedAt} durationMs={stepGroups === 1 ? m.durationMs : undefined} />;
      })}
      {waiting && segs.length === 0 && <ThinkingState nodes={[]} working workingLabel="Pensando…" startedAt={m.startedAt} />}
      {!live && segs.length === 0 && !m.actions?.length && <p className="text-[13.5px] text-faint">Resposta interrompida antes de concluir.</p>}
      {!!m.actions?.length && (
        <div className="flex flex-wrap gap-1.5" aria-label="Ações executadas">
          {m.actions.map((a, j) => (
            <Link key={j} href={a.href} className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[12px] text-success hover:bg-success/15">
              <CheckCircle2 className="size-3.5" /> {a.label}
            </Link>
          ))}
        </div>
      )}
      {!live && m.content && <div className="-ml-1 flex opacity-60 transition group-hover/msg:opacity-100"><CopyButton text={m.content} /></div>}
    </div>
  );
}

type ConversationRow = { id: string; title: string; updatedAt: string };
const when = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso));

/** Conversas anteriores do espaço: abrir ou apagar. */
function HistoryMenu({ scope, currentId, disabled, onOpen, onDeleted }: { scope: Scope; currentId?: string; disabled: boolean; onOpen: (id: string) => void; onDeleted: (id: string) => void }) {
  const [rows, setRows] = React.useState<ConversationRow[] | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const load = React.useCallback(() => {
    fetch(`/api/ai/conversas?escopo=${scope}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.conversations)).catch(() => setRows([]));
  }, [scope]);
  const remove = async (id: string) => {
    const res = await fetch(`/api/ai/conversas/${id}?escopo=${scope}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) { toast.error("Não foi possível apagar."); return; }
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
    onDeleted(id);
  };
  return (
    <Popover.Root open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (o) load(); }}>
      <Popover.Trigger disabled={disabled} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-50">
        <History className="size-3.5" /> Histórico
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 max-h-[60vh] w-[min(340px,calc(100vw-24px))] overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-1 shadow-soft animate-in">
          {rows === null ? <p className="px-3 py-3 text-[13px] text-faint">Carregando…</p>
            : rows.length === 0 ? <p className="px-3 py-3 text-[13px] text-faint">Nenhuma conversa guardada neste espaço.</p>
            : rows.map((r) => (
              <div key={r.id} className={cn("group flex items-center gap-1 rounded-lg hover:bg-surface-3", r.id === currentId && "bg-surface-3")}>
                <button type="button" onClick={() => { setIsOpen(false); onOpen(r.id); }} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                  <span className="block truncate text-[13px]">{r.title}</span>
                  <span className="text-[11px] text-faint">{when(r.updatedAt)}</span>
                </button>
                <button type="button" onClick={() => void remove(r.id)} className="mr-1 grid size-7 shrink-0 place-items-center rounded-md text-faint opacity-0 transition hover:text-danger focus:opacity-100 group-hover:opacity-100" aria-label={`Apagar conversa ${r.title}`}><Trash2 className="size-3.5" /></button>
              </div>
            ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function parseMessages(rows: unknown): Msg[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter((m): m is Msg => !!m && typeof m === "object" && ((m as Msg).role === "user" || (m as Msg).role === "assistant") && typeof (m as Msg).content === "string")
    .map((m) => ({ ...m, parts: Array.isArray(m.parts) ? m.parts : undefined }));
}

/** Endereço da conversa atual sem recarregar a página. */
function syncUrl(scope: Scope, id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (scope === "empresa") params.set("escopo", "empresa"); else params.delete("escopo");
  if (id) params.set("c", id); else params.delete("c");
  params.delete("memoria");
  const qs = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
}

export function AiChat({ enabled, scope = "pessoal", trustedActionOrigins = [], model, conversationId, openMemory = false }: { enabled: boolean; scope?: Scope; trustedActionOrigins?: string[]; model?: string; conversationId?: string; openMemory?: boolean }) {
  const [conv, setConv] = React.useState<{ id: string; saved: boolean; msgs: Msg[] } | null>(null);
  const ready = conv !== null;
  const msgs = React.useMemo(() => conv?.msgs ?? [], [conv]);
  const setMsgs = React.useCallback((next: Msg[]) => setConv((c) => (c ? { ...c, msgs: next } : c)), []);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [readOnly, setReadOnly] = React.useState(false);
  const [memoryOpen, setMemoryOpen] = React.useState(openMemory);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const active = React.useRef<AbortController | null>(null);
  const convRef = React.useRef(conv);
  React.useEffect(() => { convRef.current = conv; }, [conv]);
  const textarea = React.useRef<HTMLTextAreaElement>(null);
  const end = React.useRef<HTMLDivElement>(null);
  const router = useRouter();

  const startNew = React.useCallback(() => { setConv({ id: crypto.randomUUID(), saved: false, msgs: [] }); syncUrl(scope, null); setLoadError(null); }, [scope]);
  const open = React.useCallback(async (id: string) => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/ai/conversas/${id}?escopo=${scope}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConv({ id, saved: true, msgs: parseMessages(data.messages) });
      syncUrl(scope, id);
    } catch {
      setLoadError("Não foi possível abrir essa conversa. Ela pode ter expirado.");
      setConv({ id: crypto.randomUUID(), saved: false, msgs: [] });
      syncUrl(scope, null);
    }
  }, [scope]);

  // Conversa do endereço (?c=) ou uma nova. Atualizações da página (router.refresh) não trocam a conversa aberta.
  React.useEffect(() => {
    if (conversationId) { if (conversationId !== convRef.current?.id) void open(conversationId); }
    else if (!convRef.current) startNew();
  }, [conversationId, open, startNew]);

  /** Guarda no servidor; falha não interrompe a conversa, só avisa. */
  const persist = React.useCallback(async (id: string, all: Msg[]) => {
    try {
      const res = await fetch(`/api/ai/conversas/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope, messages: all }) });
      if (!res.ok) throw new Error();
      setConv((c) => (c && c.id === id ? { ...c, saved: true } : c));
      if (convRef.current?.id === id) syncUrl(scope, id);
    } catch { toast.error("A conversa não foi salva no histórico."); }
  }, [scope]);

  React.useEffect(() => () => { const pending = active.current; active.current = null; pending?.abort(); }, []);
  React.useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [input]);
  // Ao enviar, vai até o fim; depois acompanha a resposta só se a pessoa continuar perto do fim.
  const jumpToEnd = React.useRef(false);
  React.useEffect(() => {
    const jump = jumpToEnd.current;
    jumpToEnd.current = false;
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 320;
    if (!jump && !nearBottom) return;
    // Espera o layout (e a rolagem ao topo da navegação vinda da Home) antes de descer.
    setTimeout(() => end.current?.scrollIntoView({ behavior: jump ? "auto" : "smooth", block: "end" }), jump ? 60 : 0);
  }, [msgs]);

  const send = React.useCallback(async (text: string) => {
    const q = text.trim();
    const current = convRef.current;
    if (!q || active.current || !current) return;
    const convId = current.id;
    const controller = new AbortController();
    active.current = controller;
    let latest: Msg[] = [];
    const update = (next: Msg[]) => { latest = next; if (active.current === controller) setMsgs(next); };
    const history: Msg[] = [...current.msgs, { role: "user", content: q }];
    const startedAt = Date.now();
    jumpToEnd.current = true;
    update([...history, { role: "assistant", content: "", startedAt }]);
    setInput("");
    setBusy(true);
    let last: Msg = { role: "assistant", content: "", startedAt };
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ scope, readOnly, messages: boundedChatHistory(history).map(({ role, content }) => ({ role, content })) }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha ao consultar a IA" }));
        update([...history, { role: "assistant", content: `⚠️ ${err.error}` }]);
        return;
      }
      const parsed = await readChatStream(res.body, value => { last = { role: "assistant", content: value.text, actions: value.actions, sources: value.sources, parts: value.parts, startedAt }; update([...history, last]); }, trustedActionOrigins);
      update([...history, { ...last, durationMs: Date.now() - startedAt }]);
      if (parsed.actions.length && active.current === controller) router.refresh();
    } catch {
      const notice = controller.signal.aborted ? "⚠️ Resposta interrompida. Ações já iniciadas podem concluir; confira o estado antes de repetir." : "⚠️ Não foi possível falar com ORBE agora.";
      const parts: ChatPart[] = [...(last.parts ?? []).map(p => (p.type === "step" && p.step.status === "running" ? { ...p, step: { ...p.step, status: "failed" as const } } : p)), { type: "text", text: `${last.content ? "\n\n" : ""}${notice}` }];
      latest = [...history, { ...last, content: `${last.content}${last.content ? "\n\n" : ""}${notice}`, parts, durationMs: Date.now() - startedAt }];
      if (active.current === controller) setMsgs(latest);
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
      // Guarda também respostas interrompidas: recibos já recebidos não se perdem.
      if (latest.length) void persist(convId, latest.map((m) => ({ ...m, startedAt: undefined })));
    }
  }, [persist, readOnly, router, scope, setMsgs, trustedActionOrigins]);

  // Pergunta vinda da captura da Home: sempre numa conversa nova.
  const pendingHandled = React.useRef(false);
  React.useEffect(() => {
    if (!enabled || !ready || pendingHandled.current) return;
    pendingHandled.current = true;
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(pendingPromptKey(scope)); sessionStorage.removeItem(pendingPromptKey(scope)); } catch {}
    if (!pending) return;
    if (convRef.current?.msgs.length) { const fresh = { id: crypto.randomUUID(), saved: false, msgs: [] }; convRef.current = fresh; setConv(fresh); syncUrl(scope, null); }
    void send(pending);
  }, [enabled, ready, scope, send]);

  const empty = msgs.length === 0;
  const composer = (
    <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="rounded-[26px] border border-border-strong bg-surface shadow-soft transition focus-within:border-accent/50">
      <textarea
        ref={textarea}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) void send(input); } }}
        rows={1}
        autoFocus
        maxLength={CHAT_LIMITS.user}
        disabled={!enabled}
        aria-label="Mensagem para ORBE"
        placeholder={enabled ? (empty ? "Pergunte ou peça uma ação…" : "Responder à ORBE…") : "IA desativada — configure a chave em Integrações"}
        className="block max-h-[220px] min-h-12 w-full resize-none bg-transparent px-5 pb-1 pt-3.5 text-[15px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1">
        <button
          type="button"
          onClick={() => setReadOnly(v => !v)}
          disabled={busy}
          aria-pressed={readOnly}
          title="Consultar sem executar escritas"
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition disabled:opacity-50", readOnly ? "border-accent/40 bg-accent/10 text-accent" : "border-transparent text-muted hover:bg-surface-2 hover:text-fg")}
        >
          <Eye className="size-3.5" /> Somente leitura
        </button>
        {busy ? (
          <button type="button" onClick={() => active.current?.abort()} className="ml-auto grid size-9 place-items-center rounded-full bg-fg text-bg transition hover:opacity-85" aria-label="Interromper resposta">
            <Square className="size-3.5 fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || !enabled} className="ml-auto grid size-9 place-items-center rounded-full bg-fg text-bg transition hover:opacity-85 disabled:bg-surface-3 disabled:text-faint" aria-label="Enviar">
            <ArrowUp className="size-4" />
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] w-full max-w-3xl flex-col px-4 sm:px-6">
      <header className="flex items-center gap-2 pb-4 text-[13px]">
        <span className="font-semibold tracking-tight">ORBE</span>
        <span className="text-faint">·</span>
        <span className="text-muted">{scope === "empresa" ? "Empresa" : "Pessoal"}</span>
        {model && <span className="hidden truncate text-faint sm:inline">· {model}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          <HistoryMenu scope={scope} currentId={conv?.id} disabled={busy} onOpen={(id) => void open(id)} onDeleted={(id) => { if (id === conv?.id) startNew(); }} />
          <button type="button" onClick={() => setMemoryOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-muted transition hover:bg-surface-2 hover:text-fg"><Brain className="size-3.5" /> Memória</button>
          {!empty && (
            <button type="button" disabled={busy} onClick={startNew} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-muted transition hover:bg-surface-2 hover:text-fg disabled:opacity-50">
              <Plus className="size-3.5" /> Nova
            </button>
          )}
        </div>
      </header>
      {loadError && <p role="status" className="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[13px] text-warning">{loadError}</p>}
      <OrbeMemoryDialog scope={scope} open={memoryOpen} onOpenChange={(o) => { setMemoryOpen(o); if (!o) syncUrl(scope, conv?.saved ? conv.id : null); }} />

      {!ready ? null : empty ? (
        <div className="flex flex-1 flex-col justify-center pb-16">
          <h1 className="mb-6 text-center text-[28px] font-semibold tracking-tight sm:text-[32px]">{scope === "empresa" ? "O que a AG LABS decide hoje?" : "Como posso ajudar hoje?"}</h1>
          {composer}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS[scope].map((s) => (
              <button key={s} type="button" disabled={!enabled} onClick={() => void send(s)} className="rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-[13px] text-muted transition hover:border-border-strong hover:text-fg disabled:opacity-50">{s}</button>
            ))}
          </div>
          {!enabled && <p className="mt-4 text-center text-[13px] text-muted">Configure a chave da IA em <Link href="/integracoes" className="text-accent hover:underline">Integrações</Link> para ativar.</p>}
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-col gap-8 pb-6" role="log" aria-live="polite" aria-busy={busy}>
            {msgs.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed">{m.content}</div>
              </div>
            ) : (
              <AssistantMessage key={i} m={m} live={busy && i === msgs.length - 1} />
            ))}
            <div ref={end} className="scroll-mb-72" />
          </div>
          <div className="sticky bottom-[calc(6rem+var(--shell-safe-bottom,0px))] z-10 -mx-2 bg-gradient-to-t from-bg via-bg/90 to-transparent px-2 pt-6">
            {composer}
            <p className="mt-2 text-center text-[11.5px] text-faint">Conversas ficam no histórico por 60 dias. Interromper não desfaz ações já iniciadas.</p>
          </div>
        </>
      )}
    </div>
  );
}
