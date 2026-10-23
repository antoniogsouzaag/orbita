"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AgentAccessLink({ label = "Conectar agente" }: { label?: string }) {
  return <Button size="sm" variant="primary" onClick={() => {
    const panel = document.getElementById("conectar-agente");
    if (!(panel instanceof HTMLDetailsElement)) return;
    panel.open = true;
    panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    panel.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
  }}><Plus />{label}</Button>;
}
