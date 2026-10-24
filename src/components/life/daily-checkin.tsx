"use client";
import * as React from "react";
import { Smile } from "lucide-react";
import { toast } from "sonner";
import { saveCheckin } from "@/app/actions/core";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Checkin } from "@/db/schema";
import { today } from "@/lib/dates";
import { cn } from "@/lib/utils";

const MOODS = ["😞", "😕", "😐", "🙂", "😄"];
export function DailyCheckin({ checkin, date }: { checkin: Checkin | null; date: string }) {
  const [mood, setMood] = React.useState(checkin?.mood ?? null);
  const [energy, setEnergy] = React.useState(checkin?.energy ?? null);
  const [note, setNote] = React.useState(checkin?.note ?? "");
  const savedNote = React.useRef(checkin?.note ?? "");
  const [pending, start] = React.useTransition();
  const [status, setStatus] = React.useState(checkin ? "Registro salvo deste dia" : "Ainda sem registro neste dia");
  function save(patch: Parameters<typeof saveCheckin>[0]) {
    start(async () => {
      try {
        await saveCheckin({ ...patch, date });
        if ("note" in patch) savedNote.current = patch.note ?? "";
        setStatus("Salvo em " + date.split("-").reverse().join("/"));
      } catch { if ("mood" in patch) setMood(checkin?.mood ?? null); if ("energy" in patch) setEnergy(checkin?.energy ?? null); setStatus("Não foi salvo. Tente novamente."); toast.error("Não foi possível salvar seu registro."); }
    });
  }
  function saveReflection() { if (!pending && note !== savedNote.current) save({ note }); }
  return <Card className="h-full"><CardHeader icon={<Smile />} title={date === today() ? "Como foi hoje?" : "Como foi o dia?"} href="/revisao" hrefLabel="Histórico" /><div className="space-y-3 px-5 pb-5">
    <p className="text-xs text-muted">{date.split("-").reverse().join("/")} · um registro por dia, editável</p>
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-70">
      <div className="flex items-center gap-3"><span className="w-14 text-xs text-muted">Humor</span><div className="flex flex-1 justify-between gap-1">{MOODS.map((face, index) => <button type="button" key={face} aria-label={`Humor ${index + 1}`} aria-pressed={mood === index + 1} onClick={() => { const value = mood === index + 1 ? null : index + 1; setMood(value); save({ mood: value }); }} className={cn("grid size-9 place-items-center rounded-xl border text-lg", mood === index + 1 ? "border-accent bg-accent/15" : "border-border bg-surface-2")}>{face}</button>)}</div></div>
      <div className="flex items-center gap-3"><span className="w-14 text-xs text-muted">Energia</span><div className="flex flex-1 justify-between gap-1">{[1,2,3,4,5].map((value) => <button type="button" key={value} aria-label={`Energia ${value}`} aria-pressed={energy === value} onClick={() => { const next = energy === value ? null : value; setEnergy(next); save({ energy: next }); }} className={cn("grid size-9 place-items-center rounded-xl border text-xs font-medium", energy === value ? "border-accent bg-accent/15 text-accent" : "border-border bg-surface-2 text-muted")}>{value}</button>)}</div></div>
    </fieldset>
    <form onSubmit={(event) => { event.preventDefault(); saveReflection(); }} className="flex gap-2"><Input aria-label="Reflexão do dia" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} onBlur={saveReflection} placeholder="Uma reflexão sobre este dia…" className="h-9 min-w-0" /><Button type="submit" size="sm" disabled={pending}>Salvar</Button></form>
    <p role="status" className="text-[11px] text-faint">{pending ? "Salvando…" : status} · Enter salva a reflexão</p>
  </div></Card>;
}
