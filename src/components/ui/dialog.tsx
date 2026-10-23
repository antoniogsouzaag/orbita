"use client";
import { X } from "lucide-react";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({
  title,
  description,
  children,
  className,
  wide,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] animate-in" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-[8vh] z-[61] max-h-[84vh] w-[calc(100vw-24px)] -translate-x-1/2 overflow-y-auto rounded-2xl border border-border-strong bg-surface p-5 shadow-soft animate-in focus:outline-none",
          wide ? "max-w-2xl" : "max-w-md",
          className,
        )}
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold tracking-tight">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-[13px] text-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{title}</D.Description>
            )}
          </div>
          <D.Close className="ml-auto rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
