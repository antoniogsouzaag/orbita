"use client";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshBusiness } from "@/app/actions/business";
import { Button } from "@/components/ui/button";

export function RefreshBusiness() {
  const [pending, start] = useTransition();
  return <Button size="sm" disabled={pending} onClick={() => start(async () => {
    try { await refreshBusiness(); } catch { toast.error("Não foi possível atualizar os indicadores."); }
  })}><RefreshCw className={pending ? "animate-spin" : undefined} />{pending ? "Atualizando…" : "Atualizar"}</Button>;
}
