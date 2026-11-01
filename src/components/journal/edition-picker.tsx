"use client";

import { useRouter } from "next/navigation";

export function EditionPicker({ date, min, max }: { date: string; min: string; max: string }) {
  const router = useRouter();
  return <><label htmlFor="journal-date" className="sr-only">Data da edição</label><input id="journal-date" aria-label="Data da edição" type="date" value={date} min={min} max={max} className="w-[116px] bg-transparent text-xs text-muted" onChange={event => {
    const next = event.currentTarget.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(next) && next >= min && next <= max && next !== date) router.push(`/jornal?data=${next}`);
  }} /></>;
}
