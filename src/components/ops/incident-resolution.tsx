"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resolveIncidentAction } from "@/app/actions/incidents";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

export function IncidentResolution({ id }: { id: string }) {
  const [evidence, setEvidence] = useState("");
  const [pending, start] = useTransition();
  return <details className="mt-1 text-xs">
    <summary className="cursor-pointer font-medium text-accent transition-opacity hover:opacity-80">Registrar resolução</summary>
    <form className="mt-2 space-y-2" onSubmit={event => {
      event.preventDefault();
      start(async () => {
        try { const result = await resolveIncidentAction({ id, evidence }); if (result.resolved) toast.success("Resolução registrada"); else toast.info("Incidente já encerrado ou indisponível"); }
        catch { toast.error("Não foi possível registrar a resolução"); }
      });
    }}>
      <label className="block text-muted">Correção verificada e evidência<Textarea className="mt-1.5 min-h-16 py-2 text-[13px]" value={evidence} onChange={event => setEvidence(event.target.value)} required minLength={10} maxLength={1000} rows={2} placeholder="O que foi corrigido e onde foi verificado" /></label>
      <Button size="sm" disabled={pending || evidence.trim().length < 10}>{pending ? "Registrando…" : "Encerrar incidente"}</Button>
    </form>
  </details>;
}
