"use server";
import { requireAuth } from "@/lib/auth";
import { dispatchMaintenance, type MaintenanceInput } from "@/server/hermes-maintenance";
import { dispatchHermes, readHermesResult } from "@/server/hermes";
export async function sendHermes(input: Parameters<typeof dispatchHermes>[0]) { await requireAuth(); if(input.action === "maintenance.execute") throw new Error("Use o fluxo de manutenção com UUID persistente."); return dispatchHermes(input); }
export async function executeMaintenance(input: MaintenanceInput) { await requireAuth(); return dispatchMaintenance(input); }
export async function checkHermes(id: string) { await requireAuth(); return readHermesResult(id); }
