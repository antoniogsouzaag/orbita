"use client";

import { PALETTE, cn } from "@/lib/utils";

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} className={cn("size-7 rounded-full transition", value === c ? "ring-2 ring-fg ring-offset-2 ring-offset-surface" : "hover:scale-110")} style={{ background: c }} aria-label={c} />
      ))}
    </div>
  );
}
