"use client";

import { Eye, NotebookPen, PencilLine, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { createNote, deleteNote, saveNote } from "@/app/actions/core";
import { MarkdownEditor } from "@/components/markdown/editor";
import { MarkdownView } from "@/components/markdown/view";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import type { Note } from "@/db/schema";
import { cn } from "@/lib/utils";

export function NotesPage({ notes, selected }: { notes: Note[]; selected: Note | null }) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [title, setTitle] = React.useState(selected?.title ?? "");
  const [content, setContent] = React.useState(selected?.content ?? "");
  const [mode, setMode] = React.useState<"edit" | "view">("edit");
  const [saved, setSaved] = React.useState(true);
  const [, start] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    setTitle(selected?.title ?? "");
    setContent(selected?.content ?? "");
    setSaved(true);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = React.useCallback(
    (patch: { title?: string; content?: string }) => {
      if (!selected) return;
      clearTimeout(timer.current);
      setSaved(false);
      timer.current = setTimeout(() => {
        start(async () => {
          await saveNote(selected.id, patch);
          setSaved(true);
          router.refresh();
        });
      }, 700);
    },
    [selected, router],
  );

  const filtered = notes.filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q.toLowerCase()));
  const titles = notes.map((n) => n.title);
  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card className={cn("flex flex-col overflow-hidden lg:h-[calc(100dvh-170px)]", selected && "hidden lg:flex")}>
        <div className="flex gap-2 border-b border-border p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar notas" className="h-9 pl-8" />
          </div>
          <Button size="icon" variant="primary" onClick={() => start(async () => { const id = await createNote(); router.push(`/notas?id=${id}`); })} aria-label="Nova nota"><Plus /></Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="p-4 text-center text-[13px] text-muted">Nenhuma nota.</p>}
          {filtered.map((n) => (
            <button key={n.id} onClick={() => router.push(`/notas?id=${n.id}`)} className={cn("mb-0.5 block w-full rounded-xl px-3 py-2.5 text-left transition", selected?.id === n.id ? "bg-surface-3" : "hover:bg-surface-2")}>
              <div className="flex items-center gap-1.5 truncate text-[13.5px] font-medium">{n.pinned && <Pin className="size-3 shrink-0 text-accent" />}{n.title || "Sem título"}</div>
              <div className="mt-0.5 line-clamp-2 text-[12px] text-faint">{n.content.replace(/[#*`>\[\]]/g, "").slice(0, 120) || "Vazia"}</div>
              <div className="mt-1 text-[11px] text-faint">{new Date(n.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</div>
            </button>
          ))}
        </div>
      </Card>

      {selected ? (
        <Card className="flex min-h-[70vh] flex-col overflow-hidden lg:h-[calc(100dvh-170px)]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <button onClick={() => router.push("/notas")} className="text-[13px] text-muted lg:hidden">← Notas</button>
            <span className="text-[12px] text-faint">{saved ? "Salvo" : "Salvando…"}</span>
            <div className="ml-auto flex items-center gap-1">
              <Segmented value={mode} onChange={setMode} options={[{ value: "edit", label: <PencilLine className="size-3.5" /> }, { value: "view", label: <Eye className="size-3.5" /> }]} />
              <Button size="icon-sm" variant="ghost" onClick={() => start(() => saveNote(selected.id, { pinned: !selected.pinned }).then(() => router.refresh()))} aria-label="Fixar">{selected.pinned ? <PinOff /> : <Pin />}</Button>
              <Button size="icon-sm" variant="ghost" onClick={() => start(async () => { if (!confirm("Excluir nota?")) return; await deleteNote(selected.id); toast.success("Nota excluída"); router.push("/notas"); })} aria-label="Excluir"><Trash2 /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
            <input value={title} onChange={(e) => { setTitle(e.target.value); persist({ title: e.target.value, content }); }} placeholder="Título" className="mb-3 w-full bg-transparent text-2xl font-bold tracking-tight outline-none" />
            {mode === "edit" ? (
              <MarkdownEditor value={content} onChange={(v) => { setContent(v); persist({ title, content: v }); }} linkTargets={titles} placeholder="Escreva em markdown. Use [[ para linkar outra nota." minHeight="50vh" />
            ) : (
              <MarkdownView content={content || "_Nota vazia_"} resolve={(t) => { const id = byTitle.get(t.toLowerCase()); return id ? `/notas?id=${id}` : null; }} />
            )}
          </div>
        </Card>
      ) : (
        <Card className="hidden items-center justify-center lg:flex"><EmptyState icon={<NotebookPen />} title="Selecione ou crie uma nota" description="Notas pessoais em markdown, com [[links]] entre elas. Conhecimento da empresa vai no Vault." /></Card>
      )}
    </div>
  );
}
