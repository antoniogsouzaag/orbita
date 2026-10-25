"use client";

import { GripVertical, Eye, EyeOff, LayoutGrid } from "lucide-react";
import * as React from "react";
import { Reorder, useDragControls } from "motion/react";
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
      <DialogContent title={title} description="Arraste pela alça para reordenar. No teclado, use as setas para cima e para baixo na alça.">
        <Reorder.Group axis="y" values={o} onReorder={setO} layoutScroll className="max-h-[55dvh] space-y-2 overflow-y-auto p-1" aria-label="Ordem dos blocos">
          {o.map((id, i) => <SortableWidget key={id} id={id} label={labels[id] ?? id} hidden={h.includes(id)} position={i + 1} total={o.length} onMove={(direction) => move(i, direction)} onToggle={() => setH(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id])} />)}
        </Reorder.Group>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={pending} onClick={() => start(async () => { try { await updateSettings({ [field]: { order: o as never, hidden: h as never } }); setOpen(false); } catch { toast.error("Não foi possível salvar a organização dos blocos."); } })}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableWidget({ id, label, hidden, position, total, onMove, onToggle }: { id: string; label: string; hidden: boolean; position: number; total: number; onMove: (direction: number) => void; onToggle: () => void }) {
  const controls = useDragControls();
  return <Reorder.Item value={id} dragListener={false} dragControls={controls} className={cn("relative flex items-center gap-2 rounded-xl border border-border bg-surface px-2 py-2", hidden && "opacity-50")} whileDrag={{ zIndex: 1, scale: 1.02 }}>
    <button type="button" onPointerDown={event => controls.start(event)} onKeyDown={event => { if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); onMove(event.key === "ArrowUp" ? -1 : 1); } }} className="touch-none cursor-grab rounded-lg p-2 text-muted active:cursor-grabbing" aria-label={`Mover ${label}, posição ${position} de ${total}`}><GripVertical className="size-4" /></button>
    <span className="min-w-0 flex-1 text-[13px]">{label}</span>
    <button type="button" onClick={onToggle} className="rounded-lg p-2 text-muted hover:text-fg" aria-label={`${hidden ? "Mostrar" : "Ocultar"} ${label}`} aria-pressed={!hidden}>{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
  </Reorder.Item>;
}
