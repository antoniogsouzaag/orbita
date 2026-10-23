"use client";

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { updateSettings } from "@/app/actions/core";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-[12px] font-medium text-muted">{children}</div>;
}

export function AppearanceCard({ accent }: { accent: string }) {
  const { theme: mode, setTheme } = useTheme();
  const [a, setA] = React.useState(accent);
  const [, start] = React.useTransition();
  const mounted = React.useSyncExternalStore(noop, () => true, () => false);

  const pickAccent = (id: string) => {
    document.documentElement.setAttribute("data-accent", id);
    setA(id);
    start(() => updateSettings({ accent: id }));
  };

  return (
    <Card>
      <CardHeader icon={<Palette />} title="Aparência" />
      <div className="space-y-5 px-5 pb-5">
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
          <Label>Cor de destaque</Label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button key={c.id} onClick={() => pickAccent(c.id)} className={cn("grid size-8 place-items-center rounded-full transition hover:scale-110", a === c.id && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: c.color }} aria-label={c.id} aria-pressed={a === c.id}>
                {a === c.id && <Check className="size-4 text-black/70" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
