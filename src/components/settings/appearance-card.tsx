"use client";

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { updateSettings } from "@/app/actions/core";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const THEMES = [
  { id: "grafite", label: "Grafite", bg: "#08080a", surface: "#16161a", line: "#2c2c33", glow: "#6d5bd0" },
  { id: "meia-noite", label: "Meia-noite", bg: "#060912", surface: "#111a2c", line: "#26344f", glow: "#2563eb" },
  { id: "ameixa", label: "Ameixa", bg: "#0a070f", surface: "#191322", line: "#332947", glow: "#a21caf" },
  { id: "floresta", label: "Floresta", bg: "#060a08", surface: "#121a16", line: "#27362e", glow: "#059669" },
  { id: "areia", label: "Areia", bg: "#0b0907", surface: "#1b1713", line: "#372f26", glow: "#d97706" },
] as const;

const ACCENTS = [
  { id: "cyan", color: "#22d3ee" },
  { id: "orange", color: "#f59e0b" },
  { id: "blue", color: "#3b82f6" },
  { id: "violet", color: "#a78bfa" },
  { id: "green", color: "#22c55e" },
  { id: "rose", color: "#fb7185" },
  { id: "white", color: "#f4f4f5" },
] as const;

const noop = () => () => {};

/** Aplica tema/estilo/destaque na hora, sem esperar o servidor. */
function setRootData(key: string, value: string) {
  document.documentElement.setAttribute(`data-${key}`, value);
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[12px] font-medium text-muted">{children}</div>;
}

export function AppearanceCard({ theme, surface, accent }: { theme: string; surface: string; accent: string }) {
  const { theme: mode, setTheme } = useTheme();
  const [t, setT] = React.useState(theme);
  const [s, setS] = React.useState(surface);
  const [a, setA] = React.useState(accent);
  const [, start] = React.useTransition();
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);

  const apply = (patch: { theme?: string; surface?: string; accent?: string }) => {
    for (const [k, v] of Object.entries(patch)) setRootData(k, v);
    if (patch.theme) setT(patch.theme);
    if (patch.surface) setS(patch.surface);
    if (patch.accent) setA(patch.accent);
    start(() => updateSettings(patch as Parameters<typeof updateSettings>[0]));
  };

  return (
    <Card>
      <CardHeader icon={<Palette />} title="Aparência" meta="vale para todas as telas" />
      <div className="space-y-6 px-5 pb-5">
        <div>
          <Label>Modo</Label>
          <div className="inline-grid grid-cols-3 gap-0.5 rounded-xl border border-border bg-surface-2 p-0.5">
            {[
              { id: "dark", label: "Escuro", icon: Moon },
              { id: "light", label: "Claro", icon: Sun },
              { id: "system", label: "Sistema", icon: Monitor },
            ].map((m) => (
              <button key={m.id} onClick={() => setTheme(m.id)} className={cn("flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[12.5px] transition", mounted && mode === m.id ? "bg-surface font-medium text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg")}>
                <m.icon className="size-3.5" /> {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Tema</Label>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
            {THEMES.map((x) => (
              <button key={x.id} onClick={() => apply({ theme: x.id })} className={cn("group rounded-2xl border p-1.5 text-left transition", t === x.id ? "border-accent/70 ring-2 ring-accent/25" : "border-border hover:border-border-strong")} aria-pressed={t === x.id}>
                <div className="relative h-16 overflow-hidden rounded-xl" style={{ background: `radial-gradient(120% 90% at 100% 0%, ${x.glow}55, transparent 60%), ${x.bg}` }}>
                  <div className="absolute inset-x-2 bottom-2 top-5 rounded-lg border" style={{ background: x.surface, borderColor: x.line }}>
                    <div className="m-1.5 h-1.5 w-8 rounded-full" style={{ background: ACCENTS.find((c) => c.id === a)?.color }} />
                    <div className="mx-1.5 h-1 w-12 rounded-full opacity-40" style={{ background: "#fff" }} />
                  </div>
                  {t === x.id && <Check className="absolute right-1.5 top-1.5 size-3.5 text-white" />}
                </div>
                <div className="px-1 pb-0.5 pt-1.5 text-[12.5px] font-medium">{x.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Estilo das superfícies</Label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              { id: "solido", label: "Sólido", desc: "Cartões opacos com profundidade sutil. Mais legível." },
              { id: "vidro", label: "Vidro", desc: "Liquid glass: cartões, barras e botões translúcidos com brilho nas bordas." },
            ].map((x) => (
              <button key={x.id} onClick={() => apply({ surface: x.id })} className={cn("flex items-start gap-3 rounded-2xl border p-3 text-left transition", s === x.id ? "border-accent/70 ring-2 ring-accent/25" : "border-border hover:border-border-strong")} aria-pressed={s === x.id}>
                <span
                  className={cn("mt-0.5 size-10 shrink-0 rounded-xl", x.id === "vidro" ? "liquid" : "card")}
                  style={x.id === "vidro" ? { background: "linear-gradient(135deg, color-mix(in oklab, var(--accent) 35%, transparent), color-mix(in oklab, var(--ambient) 30%, transparent))" } : undefined}
                />
                <span>
                  <span className="block text-[13.5px] font-medium">{x.label}</span>
                  <span className="block text-[12px] text-muted">{x.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Cor de destaque</Label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c.id} onClick={() => apply({ accent: c.id })} className={cn("grid size-8 place-items-center rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] transition hover:scale-110", a === c.id && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c.color }} aria-label={c.id} aria-pressed={a === c.id}>
                {a === c.id && <Check className="size-4 text-black/70" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
