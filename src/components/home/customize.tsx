"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { updateSettings } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function Customize({ order, hidden, labels, field = "widgets", title = "Personalizar o Início" }: { order: string[]; hidden: string[]; labels: Record<string, string>; field?: "widgets" | "empresaWidgets"; title?: string }) {
  const [o, setO] = React.useState(order);
  const [h, setH] = React.useState(hidden);
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const move = (i: number, d: number) =>
    setO((list) => {
      const next = [...list];
      const j = i + d;
      if (j < 0 || j >= next.length) return list;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  return (
    <Dialog open={open} onOpenChange={(value) => { if (value) { setO(order); setH(hidden); } setOpen(value); }}>
      <DialogTrigger className="flex items-center gap-1.5 text-[12.5px] text-muted hover:text-fg">
        <LayoutGrid className="size-3.5" /> Personalizar
      </DialogTrigger>
      <DialogContent title={title} description="Mostre, esconda e reordene os blocos.">
        <div className="space-y-1">
          {o.map((id, i) => (
            <div key={id} className={cn("flex items-center gap-2 rounded-xl border border-border px-3 py-2", h.includes(id) && "opacity-50")}>
              <span className="flex-1 text-[13.5px]">{labels[id] ?? id}</span>
              <button onClick={() => move(i, -1)} className="rounded p-1 text-muted hover:text-fg" aria-label="Subir"><ArrowUp className="size-4" /></button>
              <button onClick={() => move(i, 1)} className="rounded p-1 text-muted hover:text-fg" aria-label="Descer"><ArrowDown className="size-4" /></button>
              <button onClick={() => setH((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))} className="rounded p-1 text-muted hover:text-fg" aria-label="Mostrar/ocultar">
                {h.includes(id) ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={pending} onClick={() => start(async () => { try { await updateSettings({ [field]: { order: o as never, hidden: h as never } }); setOpen(false); } catch { toast.error("Não foi possível salvar a organização dos blocos."); } })}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
