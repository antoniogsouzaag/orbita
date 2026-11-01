"use client";

import { AlertDialog } from "radix-ui";
import { useSyncExternalStore } from "react";
import { Button } from "./button";

type Request = { message: string; resolve: (accepted: boolean) => void };
const queue: Request[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const snapshot = () => queue[0] ?? null;

/** Await before mutating; cancellation, Escape and dismiss never authorize an action. */
export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => { queue.push({ message, resolve }); notify(); });
}

export function ConfirmationHost() {
  const request = useSyncExternalStore(subscribe, snapshot, () => null);
  const finish = (accepted: boolean) => {
    if (queue[0] !== request) return;
    queue.shift()?.resolve(accepted);
    notify();
  };
  return <AlertDialog.Root open={!!request} onOpenChange={open => { if (!open) finish(false); }}>
    <AlertDialog.Portal>
      <AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" />
      <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-strong bg-surface p-6 shadow-soft">
        <AlertDialog.Title className="text-base font-semibold">Confirmar ação</AlertDialog.Title>
        <AlertDialog.Description className="mt-3 break-words text-sm text-muted">{request?.message}</AlertDialog.Description>
        <div className="mt-6 flex justify-end gap-2">
          <AlertDialog.Cancel asChild><Button onClick={() => finish(false)}>Cancelar</Button></AlertDialog.Cancel>
          <AlertDialog.Action asChild><Button variant="danger" onClick={() => finish(true)}>Confirmar</Button></AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
