"use client";

import { Check, Settings2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { updateSettings } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
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

export function PreferencesCard({ name, accent, focusMinutes }: { name: string; accent: string; focusMinutes: number }) {
  const [n, setN] = React.useState(name);
  const [f, setF] = React.useState(String(focusMinutes));
  const [pending, start] = React.useTransition();
  return (
    <Card>
      <CardHeader icon={<Settings2 />} title="Preferências" />
      <div className="space-y-4 px-5 pb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Seu nome (saudação)"><Input value={n} onChange={(e) => setN(e.target.value)} /></Field>
          <Field label="Minutos padrão do foco"><Input inputMode="numeric" value={f} onChange={(e) => setF(e.target.value)} /></Field>
        </div>
        <Field label="Cor de destaque">
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => start(async () => { await updateSettings({ accent: a.id }); document.documentElement.dataset.accent = a.id; })} className={cn("grid size-8 place-items-center rounded-full transition hover:scale-110", accent === a.id && "ring-2 ring-fg ring-offset-2 ring-offset-surface")} style={{ background: a.color }} aria-label={a.id}>
                {accent === a.id && <Check className="size-4 text-black/70" />}
              </button>
            ))}
          </div>
        </Field>
        <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => { await updateSettings({ name: n, focusMinutes: Number(f) || 25 }); toast.success("Preferências salvas"); })}>Salvar</Button>
      </div>
    </Card>
  );
}
