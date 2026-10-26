"use client";

import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { addMemoryAction, deleteMemoryAction, loadMemory, updateMemoryAction, type MemoryView } from "@/app/actions/orbe";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Scope = "pessoal" | "empresa";
type Block = "geral" | Scope;
const LABEL: Record<Block, { title: string; hint: string }> = {
  geral: { title: "Como trabalhar com você", hint: "Preferências e correções que valem nos dois espaços." },
  pessoal: { title: "Pessoal", hint: "Aprendizados da sua rotina que ainda não estão em outro lugar." },
  empresa: { title: "Empresa", hint: "Combinados e lições da AG LABS que não estão no Vault." },
};

function Usage({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="flex items-center gap-2 text-[11.5px] text-faint">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-surface-3"><div className={cn("h-full rounded-full", pct >= 90 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} /></div>
      <span className="tabular-nums">{used}/{limit}</span>
    </div>
  );
}

function Item({ item, onChange }: { item: MemoryView; onChange: () => void }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(item.content);
  const [pending, start] = React.useTransition();
  const save = () => start(async () => {
    const r = await updateMemoryAction(item.id, value);
    if (!r.ok) { toast.error(r.message); return; }
    setEditing(false); onChange();
  });
  const remove = () => start(async () => { await deleteMemoryAction(item.id); onChange(); });
  return (
    <li className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2">
      <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-faint" />
      {editing ? (
        <textarea value={value} onChange={(e) => setValue(e.target.value)} maxLength={400} rows={3} autoFocus className="min-w-0 flex-1 resize-none rounded-md border border-border bg-surface-2 px-2 py-1 text-[13.5px] outline-none focus:border-accent/60" />
      ) : (
        <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed">{item.content}{item.source === "consolidacao" && <span className="ml-1.5 text-[11px] text-faint">· consolidado</span>}</p>
      )}
      <div className={cn("flex shrink-0 gap-0.5", !editing && "opacity-0 transition group-hover:opacity-100 focus-within:opacity-100")}>
        {editing ? (
          <>
            <button type="button" disabled={pending} onClick={save} className="grid size-7 place-items-center rounded-md text-success hover:bg-surface-3" aria-label="Salvar"><Check className="size-3.5" /></button>
            <button type="button" disabled={pending} onClick={() => { setEditing(false); setValue(item.content); }} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3" aria-label="Cancelar"><X className="size-3.5" /></button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-fg" aria-label="Editar anotação"><Pencil className="size-3.5" /></button>
            <button type="button" disabled={pending} onClick={remove} className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-3 hover:text-danger" aria-label="Apagar anotação"><Trash2 className="size-3.5" /></button>
          </>
        )}
      </div>
    </li>
  );
}

function AddItem({ block, onChange }: { block: Block; onChange: () => void }) {
  const [value, setValue] = React.useState("");
  const [pending, start] = React.useTransition();
  const add = () => start(async () => {
    const r = await addMemoryAction(block, value);
    if (!r.ok) { toast.error(r.message); return; }
    setValue(""); onChange();
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) add(); }} className="mt-1 flex items-center gap-2 px-2">
      <Plus className="size-3.5 shrink-0 text-faint" />
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={400} placeholder="Adicionar anotação…" className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-faint" />
      {value.trim() && <button disabled={pending} className="rounded-md px-2 py-0.5 text-[12px] text-accent hover:bg-surface-2">Guardar</button>}
    </form>
  );
}

/** Ver, editar e apagar o que a ORBE guardou. Mostra o bloco geral e o do espaço atual. */
export function OrbeMemoryDialog({ scope, open, onOpenChange }: { scope: Scope; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [data, setData] = React.useState<Awaited<ReturnType<typeof loadMemory>> | null>(null);
  const reload = React.useCallback(() => { loadMemory(scope).then(setData).catch(() => toast.error("Não foi possível carregar a memória.")); }, [scope]);
  React.useEffect(() => { if (open) reload(); }, [open, reload]);
  const blocks: Block[] = ["geral", scope];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide title="Memória da ORBE" description="Anotações curtas que ela usa em toda conversa. O limite obriga a guardar só o que importa; o resto fica no Vault e nas fontes da Órbita.">
        {!data ? <p className="py-6 text-center text-[13px] text-faint">Carregando…</p> : (
          <div className="space-y-5">
            {blocks.map((b) => {
              const items = data.items.filter((i) => i.scope === b);
              const used = items.reduce((n, i) => n + i.content.length, 0);
              return (
                <section key={b}>
                  <div className="mb-1 flex items-center gap-2 px-2">
                    <h3 className="text-[13px] font-semibold">{LABEL[b].title}</h3>
                    <span className="ml-auto"><Usage used={used} limit={data.limits[b]} /></span>
                  </div>
                  <p className="mb-1.5 px-2 text-[12px] text-faint">{LABEL[b].hint}</p>
                  {items.length ? <ul>{items.map((i) => <Item key={`${i.id}:${i.updatedAt}`} item={i} onChange={reload} />)}</ul> : <p className="px-2 py-1 text-[13px] text-faint">Nada guardado ainda.</p>}
                  <AddItem block={b} onChange={reload} />
                </section>
              );
            })}
            <p className="border-t border-border px-2 pt-3 text-[12px] text-faint">Conversas ficam guardadas por 60 dias. Uma rotina diária revisa as conversas encerradas e traz para cá só o que for durável, antes de elas expirarem.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
