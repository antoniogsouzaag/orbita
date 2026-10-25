"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";

type Row = { key: string; title: string; meta: string; href: string };
const normalized = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ProposalList({ rows, selectedKey }: { rows: Row[]; selectedKey?: string }) {
  const [query, setQuery] = useState("");
  const search = normalized(query.trim());
  const visible = search ? rows.filter(row => normalized(`${row.title} ${row.meta}`).includes(search)) : rows;
  return <Card className="min-w-0 overflow-hidden">
    <div className="space-y-2 border-b border-border p-3">
      <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2"><Search aria-hidden className="size-3.5 shrink-0 text-muted" /><span className="sr-only">Buscar proposta, produto ou agente</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar proposta, produto ou agente" className="min-w-0 flex-1 bg-transparent text-xs outline-none" /></label>
      <p role="status" className="text-[11px] text-muted">{visible.length} de {rows.length} itens nesta fila</p>
    </div>
    <div className="max-h-[42vh] divide-y divide-border overflow-y-auto lg:max-h-[65vh]">
      {visible.map(row => <Link key={row.key} href={row.href} aria-current={selectedKey === row.key ? "page" : undefined} className={`block px-4 py-3 hover:bg-surface-2 ${selectedKey === row.key ? "bg-accent/5" : ""}`}><p className="line-clamp-2 text-[13px] font-medium">{row.title}</p><p className="mt-1 text-[11px] text-muted">{row.meta}</p></Link>)}
      {!visible.length && <p className="p-5 text-sm text-muted">{query ? "Nenhuma proposta corresponde à busca." : "Nenhum item nesta fila."}</p>}
    </div>
  </Card>;
}
