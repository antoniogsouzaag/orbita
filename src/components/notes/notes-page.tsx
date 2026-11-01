"use client";
import { confirmAction } from "@/components/ui/confirm-action";

import { Archive, ArchiveRestore, Eye, NotebookPen, PencilLine, Pin, PinOff, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { autosaveNote, createNote, deleteNote, saveNote, setNoteArchived } from "@/app/actions/core";
import { MarkdownEditor } from "@/components/markdown/editor";
import { MarkdownView } from "@/components/markdown/view";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import type { Note, TaskScope } from "@/db/schema";
import { ARCHIVED_NOTE_TAG, noteHref } from "@/lib/note-scope";
import { cn } from "@/lib/utils";

export function NotesPage({ notes, selected, scope = "pessoal", archived = false, projectId }: { notes: Note[]; selected: Note | null; scope?: TaskScope; archived?: boolean; projectId?: string }) {
  const router = useRouter();
  const href = (id?: string, archived = false) => noteHref(scope, id, archived, projectId);
  const [q, setQ] = React.useState("");
  const [title, setTitle] = React.useState(selected?.title ?? "");
  const [content, setContent] = React.useState(selected?.content ?? "");
  const [mode, setMode] = React.useState<"edit" | "view">("edit");
  const [preview, setPreview] = React.useState<Note | null>(null);
  const [saved, setSaved] = React.useState(true);
  const [busy, start] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  const [selection, setSelection] = React.useState(selected?.id);
  const pending = React.useRef<{ id: string; patch: { title?: string; content?: string } } | null>(null);
  const chain = React.useRef(Promise.resolve());
  const saving = React.useRef(0);
  const currentId = React.useRef(selected?.id);
  if (selection !== selected?.id) {
    setSelection(selected?.id); setTitle(selected?.title ?? ""); setContent(selected?.content ?? ""); setSaved(true);
  }
  const flush = React.useCallback(() => {
    clearTimeout(timer.current);
    const payload = pending.current;
    if (!payload) return;
    pending.current = null;
    saving.current += 1;
    chain.current = chain.current.catch(() => {}).then(async () => {
      try {
        await autosaveNote(payload.id, payload.patch, scope);
        if (currentId.current === payload.id && !pending.current && saving.current === 1) setSaved(true);
        // Enquanto a nota segue aberta a lista usa o texto local; ao sair dela, sincroniza uma vez.
        if (currentId.current !== payload.id) router.refresh();
      } catch {
        if (currentId.current === payload.id) {
          const current = pending.current as { id: string; patch: { title?: string; content?: string } } | null;
          pending.current = { id: payload.id, patch: { ...payload.patch, ...(current?.id === payload.id ? current.patch : {}) } };
          setSaved(false);
        }
        toast.error("A nota não foi salva. Mantenha esta tela aberta e tente editar novamente.");
      } finally { saving.current -= 1; }
    });
  }, [router, scope]);
  React.useEffect(() => {
    currentId.current = selected?.id;
    return () => flush();
  }, [selected?.id, flush]);
  React.useEffect(() => {
    const beforeLeave = (event: BeforeUnloadEvent) => { if (pending.current || saving.current) event.preventDefault(); };
    window.addEventListener("beforeunload", beforeLeave);
    return () => window.removeEventListener("beforeunload", beforeLeave);
  }, []);
  const persist = React.useCallback((patch: { title?: string; content?: string }) => {
    if (!selected) return;
    if (pending.current && pending.current.id !== selected.id) flush();
    pending.current = { id: selected.id, patch: { ...pending.current?.patch, ...patch } };
    clearTimeout(timer.current); setSaved(false);
    timer.current = setTimeout(flush, 700);
  }, [selected, flush]);

  const live = React.useMemo(() => selected ? notes.map((n) => n.id === selected.id ? { ...n, title, content } : n) : notes, [notes, selected, title, content]);
  const filtered = live.filter((n) => !q || `${n.title} ${n.content}`.toLowerCase().includes(q.toLowerCase()));
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
          <Button size="icon" variant="primary" onClick={() => start(async () => { const id = await createNote(undefined, undefined, scope, projectId); router.push(href(id)); })} aria-label="Nova nota"><Plus /></Button>
        </div>
        <div className="flex gap-2 border-b border-border px-3 py-2 text-[13px]">
          <button aria-pressed={!archived} onClick={() => router.push(href())} className={!archived ? "font-medium text-accent" : "text-muted"}>Ativas</button>
          <button aria-pressed={archived} onClick={() => router.push(href(undefined, true))} className={archived ? "font-medium text-accent" : "text-muted"}>Arquivadas</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && <p className="p-4 text-center text-[13px] text-muted">Nenhuma nota.</p>}
          {filtered.map((n) => (
            <button key={n.id} onClick={() => setPreview(n)} className={cn("mb-0.5 block w-full rounded-xl px-3 py-2.5 text-left transition", selected?.id === n.id ? "bg-surface-3" : "hover:bg-surface-2")}>
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
            <button onClick={() => router.push(href(undefined, archived))} className="text-[13px] text-muted lg:hidden">← Notas</button>
            <span className="text-[12px] text-faint">{saved ? "Salvo" : "Salvando…"}</span>
            <div className="ml-auto flex items-center gap-1">
              <Segmented value={mode} onChange={setMode} options={[{ value: "edit", label: <PencilLine className="size-3.5" /> }, { value: "view", label: <Eye className="size-3.5" /> }]} />
              <Button size="icon-sm" variant="ghost" onClick={() => start(() => saveNote(selected.id, { pinned: !selected.pinned }, scope).then(() => router.refresh()))} aria-label="Fixar">{selected.pinned ? <PinOff /> : <Pin />}</Button>
              <Button size="icon-sm" variant="ghost" disabled={busy} onClick={() => start(async () => {
                flush();
                await chain.current;
                if (pending.current) { toast.error("Salve as alterações antes de arquivar."); return; }
                try {
                  const next = !selected.tags.includes(ARCHIVED_NOTE_TAG);
                  await setNoteArchived(selected.id, next, scope);
                  toast.success(next ? "Nota arquivada" : "Nota restaurada");
                  router.push(href(undefined, archived));
                  router.refresh();
                } catch { toast.error("Não foi possível atualizar o arquivo da nota."); }
              })} aria-label={selected.tags.includes(ARCHIVED_NOTE_TAG) ? "Restaurar nota" : "Arquivar nota"}>{selected.tags.includes(ARCHIVED_NOTE_TAG) ? <ArchiveRestore /> : <Archive />}</Button>
              <Button size="icon-sm" variant="ghost" onClick={() => start(async () => { if (!await confirmAction("Excluir nota?")) return; await deleteNote(selected.id, scope); toast.success("Nota excluída"); router.push(href(undefined, archived)); })} aria-label="Excluir"><Trash2 /></Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
            <input value={title} onChange={(e) => { setTitle(e.target.value); persist({ title: e.target.value, content }); }} placeholder="Título" className="mb-3 w-full bg-transparent text-2xl font-bold tracking-tight outline-none" />
            {mode === "edit" ? (
              <MarkdownEditor value={content} onChange={(v) => { setContent(v); persist({ title, content: v }); }} linkTargets={titles} placeholder="Escreva em markdown. Use [[ para linkar outra nota." minHeight="50vh" />
            ) : (
              <MarkdownView content={content || "_Nota vazia_"} resolve={(t) => { const id = byTitle.get(t.toLowerCase()); return id ? href(id) : null; }} />
            )}
          </div>
        </Card>
      ) : (
        <Card className="hidden items-center justify-center lg:flex"><EmptyState icon={<NotebookPen />} title="Selecione ou crie uma nota" description={scope === "empresa" ? "Notas de trabalho em markdown, com [[links]] entre elas. Conhecimento canônico vai no Vault." : "Notas pessoais em markdown, com [[links]] entre elas."} /></Card>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        {preview && (
          <DialogContent wide title={preview.title || "Sem título"} description={`Atualizada em ${new Date(preview.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`}>
            <div className="max-h-[60vh] overflow-y-auto">
              <MarkdownView content={preview.content || "_Nota vazia_"} resolve={(t) => { const id = byTitle.get(t.toLowerCase()); return id ? href(id, archived) : null; }} />
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={() => setPreview(null)}>Fechar</Button>
              <Button variant="primary" onClick={() => { const id = preview.id; setPreview(null); router.push(href(id, archived)); }}><PencilLine /> Editar</Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
