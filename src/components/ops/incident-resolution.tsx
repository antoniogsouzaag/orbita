"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveIncidentAction } from "@/app/actions/incidents";
import { Button } from "@/components/ui/button";

export function IncidentResolution({ id }: { id: string }) {
  const [evidence, setEvidence] = useState("");
  const [pending, start] = useTransition();
  return <details className="mt-1 text-xs">
    <summary className="cursor-pointer text-accent">Registrar resolução</summary>
    <form className="mt-2 space-y-2" onSubmit={event => {
      event.preventDefault();
      start(async () => {
        try { await resolveIncidentAction({ id, evidence }); toast.success("Resolução registrada"); }
        catch { toast.error("Não foi possível registrar a resolução"); }
      });
    }}>
      <label className="block text-muted">Correção verificada e evidência<textarea className="mt-1 block w-full rounded-lg border border-border bg-surface p-2 text-fg" value={evidence} onChange={event => setEvidence(event.target.value)} required minLength={10} maxLength={1000} rows={2} placeholder="O que foi corrigido e onde foi verificado" /></label>
      <Button size="sm" disabled={pending || evidence.trim().length < 10}>{pending ? "Registrando…" : "Encerrar incidente"}</Button>
    </form>
  </details>;
}
