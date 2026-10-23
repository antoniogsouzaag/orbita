"use client";

import { Check, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { updateSettings } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { COVER_PRESETS } from "@/lib/covers";
import { cn } from "@/lib/utils";

type Photo = { id: string; thumb: string; url: string; author: string; authorUrl: string; color: string };

export function CoverPicker({ open, onOpenChange, current }: { open: boolean; onOpenChange: (v: boolean) => void; current: string }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Photo[] | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const [pending, start] = React.useTransition();

  const choose = (c: { url: string; author?: string; authorUrl?: string; color?: string; id?: string }) =>
    start(async () => {
      await updateSettings({ cover: { url: c.url, author: c.author, authorUrl: c.authorUrl, color: c.color, source: c.author ? "unsplash" : "custom" } });
      if (c.id) fetch(`/api/covers?track=${encodeURIComponent(c.id)}`).catch(() => {});
      toast.success("Capa atualizada");
      onOpenChange(false);
    });

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/covers?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!res.ok) toast.error(json.error ?? "Busca indisponível");
      else setResults(json.results);
    } finally {
      setSearching(false);
    }
  };

  const list: Photo[] = results ?? COVER_PRESETS.map((p) => ({ id: "", thumb: p.url.replace("w=2400", "w=480"), url: p.url, author: p.author, authorUrl: p.authorUrl, color: p.color }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Trocar capa" description="Escolha uma foto do Unsplash ou cole a URL de uma imagem." wide>
        <form onSubmit={search} className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Unsplash (ex.: montanhas, cidade à noite)" className="pl-9" />
          </div>
          <Button disabled={searching}>{searching ? "Buscando…" : "Buscar"}</Button>
        </form>
        {results && (
          <button onClick={() => setResults(null)} className="mb-2 text-[12.5px] text-muted hover:text-fg">← Voltar às sugestões</button>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {list.map((p) => (
            <button
              key={p.url}
              disabled={pending}
              onClick={() => choose(p)}
              className={cn("group relative aspect-[16/10] overflow-hidden rounded-xl border border-border", current === p.url && "ring-2 ring-accent")}
              style={{ background: p.color }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumb} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-105" onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0")} />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] text-white/90">{p.author}</span>
              {current === p.url && <Check className="absolute right-2 top-2 size-4 rounded-full bg-accent p-0.5 text-accent-fg" />}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) choose({ url: custom.trim() });
          }}
          className="mt-4 flex gap-2"
        >
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="https://… (URL de imagem própria)" type="url" />
          <Button disabled={pending || !custom}>Usar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
