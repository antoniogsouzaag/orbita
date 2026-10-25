import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Base visual de todo campo de formulário. Altura padrão (h-9) igual ao Button `md`,
 * para que campos e botões lado a lado fiquem alinhados.
 */
export const inputClass =
  "w-full rounded-xl border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:border-border-strong focus:border-accent/60 focus:ring-2 focus:ring-accent/15 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";

/** Select nativo com chevron desenhado pelo tema (`.ui-select` em globals.css). */
export const selectClass = cn(inputClass, "ui-select h-9 cursor-pointer truncate pr-9");

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClass, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(selectClass, className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-muted", className)} {...props} />;
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
