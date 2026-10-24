"use client";

import { ArrowUp, CheckSquare, ChevronsUpDown, FolderKanban, NotebookPen, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { createNote, quickAddTask } from "@/app/actions/core";
import { ParsePreview } from "@/components/tasks/parse-preview";
import { splitActions } from "@/lib/ai-stream";
import { relativeDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Tab = "tarefa" | "ia" | "nota";

export function Capture({ projects, aiEnabled, scope = "pessoal" }: { projects: { id: string; name: string; color: string }[]; aiEnabled: boolean; scope?: "pessoal" | "empresa" }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("tarefa");
  const [value, setValue] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();
  const [answer, setAnswer] = React.useState<string | null>(null);
  const [asking, setAsking] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  const project = projects.find((p) => p.id === projectId);

  const ask = async (question: string) => {
    setAsking(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ai/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, scope }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Falha ao consultar a IA" }));
        setAnswer(`⚠️ ${err.error}`);
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      let parsed = splitActions("");
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        acc += dec.decode(chunk, { stream: true });
        parsed = splitActions(acc);
        setAnswer(parsed.text);
      }
      if (parsed.actions.length) {
        toast.success(parsed.actions.map((a) => a.label).join(" · "));
        router.refresh();
      }
    } catch {
      setAnswer("⚠️ Não foi possível falar com ORBE agora.");
    } finally {
      setAsking(false);
    }
  };

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    if (scope === "empresa" && tab === "nota") { setTab("tarefa"); toast.info("Notas rápidas ficam no Pessoal. O conhecimento durável da empresa fica no Vault."); return; }
    if (tab === "ia") {
      setValue("");
      void ask(text);
      return;
    }
    start(async () => {
      try {
      if (tab === "tarefa") {
        const { parsed } = await quickAddTask(text, projectId, scope);
        const bits = [parsed.dueDate && `${relativeDay(parsed.dueDate)}${parsed.dueTime ? ` ${parsed.dueTime}` : ""}`, parsed.projectName, ...parsed.tags.map((t) => `#${t}`)].filter(Boolean);
        toast.success(`Tarefa criada${bits.length ? ` · ${bits.join(" · ")}` : ""}`);
      } else {
        const [first, ...rest] = text.split("\n");
        const id = await createNote(first.slice(0, 120), rest.join("\n"));
        toast.success("Nota criada", { action: { label: "Abrir", onClick: () => router.push(`/notas?id=${id}`) } });
      }
      setValue("");
      } catch { toast.error("Não foi possível salvar. Confira o projeto e tente novamente."); }
    });
  };

  const placeholder =
    scope === "empresa"
      ? tab === "tarefa" ? "O que a AG LABS precisa fazer?" : tab === "ia" ? "Pergunte sobre a operação, os agentes, o vault…" : "Nota rápida da empresa (1ª linha vira o título)…"
      : tab === "tarefa" ? "O que precisa ser feito?" : tab === "ia" ? "Pergunte sobre seu dia, suas tarefas ou a operação…" : "Escreva uma nota rápida (1ª linha vira o título)…";

  return (
    <div className="relative z-10 mx-auto -mt-28 w-full max-w-2xl px-4">
      <div className="glass capture-composer overflow-hidden rounded-2xl border border-white/10 shadow-soft">
        <div className="flex items-center gap-1 border-b border-border px-3">
          {([
            { id: "tarefa", label: "Tarefa", icon: CheckSquare },
            { id: "ia", label: "Perguntar à IA", icon: Sparkles },
            { id: "nota", label: "Nota", icon: NotebookPen },
          ] as const).filter((item) => scope === "pessoal" || item.id !== "nota").map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                ref.current?.focus();
              }}
              className={cn(
                "relative flex items-center gap-1.5 px-2.5 py-2.5 text-[13px] font-medium transition",
                tab === t.id ? "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-fg" : "text-faint hover:text-muted",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="px-4 pt-3">
          <textarea
            ref={ref}
            rows={2}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            className="capture-input w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-faint"
          />
          {tab === "tarefa" && <div className="pb-1"><ParsePreview value={value} projects={projects} /></div>}
        </div>
        <div className="flex items-center gap-2 px-3 pb-3 pt-1">
          {tab === "tarefa" && (
            <Popover.Root>
              <Popover.Trigger className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-fg">
                <FolderKanban className="size-3.5" style={project ? { color: project.color } : undefined} />
                <span className="max-w-[140px] truncate">{project?.name ?? "Sem projeto"}</span>
                <ChevronsUpDown className="size-3" />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content align="start" sideOffset={6} className="z-50 max-h-72 w-56 overflow-y-auto rounded-xl border border-border-strong bg-surface-2 p-1 shadow-soft animate-in">
                  <button onClick={() => setProjectId(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-3">Sem projeto</button>
                  {projects.map((p) => (
                    <Popover.Close asChild key={p.id}>
                      <button onClick={() => setProjectId(p.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-3">
                        <span className="size-2 rounded-full" style={{ background: p.color }} /> {p.name}
                      </button>
                    </Popover.Close>
                  ))}
                  {projects.length === 0 && <p className="px-2.5 py-2 text-[12px] text-muted">Crie projetos em Projetos.</p>}
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          )}
          <span className="hidden truncate text-[12px] text-faint sm:block">
            {tab === "tarefa" ? "Use #tag, !alta, hoje/amanhã, 15h e @projeto" : tab === "ia" ? (aiEnabled ? "A IA responde com o contexto deste espaço" : "Configure a chave da IA em Integrações") : "Enter salva · Shift+Enter quebra linha"}
          </span>
          <button
            onClick={submit}
            disabled={pending || asking || !value.trim()}
            className="ml-auto grid size-9 place-items-center rounded-full bg-fg text-bg transition hover:opacity-90 disabled:bg-surface-3 disabled:text-faint"
            aria-label="Enviar"
          >
            <ArrowUp className="size-4" />
          </button>
        </div>
        {answer !== null && (
          <div className="border-t border-border bg-surface-2/50 px-5 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
              <Sparkles className="size-3.5 text-accent" /> Resposta {asking && <span className="animate-pulse">…</span>}
              <button onClick={() => setAnswer(null)} className="ml-auto text-faint hover:text-fg">Fechar</button>
            </div>
            <div className="prose-orbita text-[14px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer || "Pensando…"}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
