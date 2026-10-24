"use client";

import { Check, LayoutGrid, RotateCcw } from "lucide-react";
import * as React from "react";
import { DraggableWidgetGrid, type WidgetItem } from "@/components/ui/draggable-widget-grid";
import { cn } from "@/lib/utils";

/**
 * Painel de widgets reorganizável. O conteúdo de cada widget chega pronto do
 * servidor (`panels`); aqui ficam só a ordem e o modo de edição. A ordem é uma
 * preferência deste navegador (localStorage), sem afetar outros dispositivos.
 */
export function WidgetBoard({ storageKey, items, panels, title, className }: {
  storageKey: string;
  items: WidgetItem[];
  panels: Record<string, React.ReactNode>;
  title?: React.ReactNode;
  className?: string;
}) {
  const key = `orbita:board:${storageKey}`;
  const [order, setOrder] = React.useState<WidgetItem[] | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  // Restaura a ordem salva, respeitando widgets novos ou removidos.
  React.useEffect(() => {
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch {}
    const byId = new Map(items.map((i) => [i.id, i]));
    const known = saved.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    const rest = items.filter((i) => !saved.includes(i.id));
    const next = known.length ? [...known, ...rest] : items;
    // Preferência guardada no navegador: só existe depois de montar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrder(next);
    // O grid guarda a ordem inicial; só remonta quando a salva é diferente.
    if (next.some((item, i) => item.id !== items[i]?.id)) setVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = order ?? items;
  const changed = order !== null && order.some((item, i) => item.id !== items[i]?.id);

  const save = (next: WidgetItem[]) => {
    setOrder(next);
    try { localStorage.setItem(key, JSON.stringify(next.map((i) => i.id))); } catch {}
  };
  const reset = () => {
    try { localStorage.removeItem(key); } catch {}
    setOrder(items);
    setVersion((v) => v + 1);
  };

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex min-h-8 flex-wrap items-center gap-2">
        {title && <div className="min-w-0 flex-1">{title}</div>}
        <div className="ml-auto flex items-center gap-1.5">
          {editing && changed && (
            <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] text-muted transition hover:bg-surface-2 hover:text-fg">
              <RotateCcw className="size-3.5" />Restaurar
            </button>
          )}
          <button type="button" aria-pressed={editing} onClick={() => setEditing((v) => !v)}
            className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition", editing ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted hover:border-border-strong hover:text-fg")}>
            {editing ? <Check className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
            {editing ? "Concluir" : "Organizar"}
          </button>
        </div>
      </div>
      {editing && <p className="text-[12px] text-faint"><span className="[@media(pointer:coarse)]:hidden">Arraste os painéis para mudar a ordem.</span><span className="hidden [@media(pointer:coarse)]:inline">Pressione e segure um painel, depois arraste.</span> A ordem fica salva neste navegador.</p>}
      <DraggableWidgetGrid
        key={version}
        items={current}
        onChange={save}
        editable={editing}
        renderItem={(item) => panels[item.id]}
        maxColumns={4}
        minColumns={1}
        cellSize={280}
        rowHeight={204}
        gap={12}
        radius={18}
      />
    </section>
  );
}
