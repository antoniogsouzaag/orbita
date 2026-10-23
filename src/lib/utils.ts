import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(value);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function pluralize(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export const PRIORITY_LABEL = ["Nenhuma", "Baixa", "Média", "Alta"] as const;

export const AREA_LABEL: Record<string, string> = {
  pessoal: "Pessoal",
  empresa: "Empresa",
  estudos: "Estudos",
  saude: "Saúde",
  financas: "Finanças",
};

export const PALETTE = ["#22d3ee", "#3b82f6", "#a78bfa", "#f472b6", "#fb7185", "#f59e0b", "#22c55e", "#84cc16", "#94a3b8"];
