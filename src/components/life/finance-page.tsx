"use client";

import { ChevronLeft, ChevronRight, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { deleteTransaction, saveTransaction } from "@/app/actions/life";
import { TX_CATEGORIES } from "@/components/shell/quick-add";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { StatTile } from "@/components/ui/stat";
import type { Transaction } from "@/db/schema";
import { today } from "@/lib/dates";
import { capitalizeFirst } from "@/lib/text";
import { cn, formatBRL } from "@/lib/utils";

const COLORS = ["#22d3ee", "#a78bfa", "#f59e0b", "#fb7185", "#22c55e", "#3b82f6", "#f472b6", "#84cc16", "#94a3b8", "#eab308", "#14b8a6", "#c084fc"];

function shiftMonth(ym: string, d: number) {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + d, 1));
  return date.toISOString().slice(0, 7);
}

export function FinancePage({ ym, rows, income, expense, categories, history }: { ym: string; rows: Transaction[]; income: number; expense: number; categories: { name: string; value: number }[]; history: { ym: string; receita: number; despesa: number }[] }) {
  const [f, setF] = React.useState({ kind: "despesa" as "despesa" | "receita", description: "", amount: "", category: "Alimentação", date: ym === today().slice(0, 7) ? today() : `${ym}-01` });
  const [pending, start] = React.useTransition();
  const label = new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const balance = income - expense;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="secondary" asChild><Link href={`/financas?mes=${shiftMonth(ym, -1)}`} aria-label="Mês anterior"><ChevronLeft /></Link></Button>
        <Button size="icon-sm" variant="secondary" asChild><Link href={`/financas?mes=${shiftMonth(ym, 1)}`} aria-label="Próximo mês"><ChevronRight /></Link></Button>
        <h2 className="ml-1 text-lg font-semibold tracking-tight">{capitalizeFirst(label)}</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile icon={TrendingUp} label="Entradas" value={formatBRL(income)} tone="success" />
        <StatTile icon={TrendingDown} label="Saídas" value={formatBRL(expense)} tone="danger" />
        <StatTile icon={Wallet} label="Saldo do mês" value={formatBRL(balance)} tone={balance < 0 ? "danger" : "accent"} colorValue={balance < 0} />
      </div>

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const amount = Number(f.amount.replace(/\./g, "").replace(",", "."));
            if (!amount || amount <= 0) return void toast.error("Valor inválido");
            start(async () => {
              await saveTransaction(null, { ...f, amount });
              toast.success("Lançamento registrado");
              setF((x) => ({ ...x, description: "", amount: "" }));
            });
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <Segmented value={f.kind} onChange={(kind) => setF({ ...f, kind, category: TX_CATEGORIES[kind][0] })} options={[{ value: "despesa", label: "Despesa" }, { value: "receita", label: "Receita" }]} />
          <Input required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Descrição" className="min-w-[160px] flex-1" />
          <Input required inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="R$ 0,00" className="w-28" />
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="w-40">{TX_CATEGORIES[f.kind].map((c) => <option key={c}>{c}</option>)}</Select>
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className="w-40" />
          <Button variant="primary" disabled={pending}><Plus /> Lançar</Button>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader title="Lançamentos" meta={`${rows.length} no mês`} />
          {rows.length === 0 ? (
            <EmptyState icon={<Wallet />} title="Sem lançamentos neste mês" />
          ) : (
            <div className="divide-y divide-border px-2 pb-2">
              {rows.map((r) => (
                <div key={r.id} className="group flex items-center gap-3 px-3 py-2.5 text-[13.5px]">
                  <span className="w-12 shrink-0 text-[12px] tabular-nums text-faint">{r.date.slice(8)}/{r.date.slice(5, 7)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate">{r.description}</span><span className="text-[11.5px] text-faint">{r.category}</span></span>
                  <span className={cn("shrink-0 font-medium tabular-nums", r.kind === "receita" ? "text-success" : "text-fg")}>{r.kind === "receita" ? "+" : "−"} {formatBRL(Number(r.amount))}</span>
                  <button onClick={() => start(async () => { await deleteTransaction(r.id); toast.success("Removido"); })} className="rounded-md p-1 transition text-faint opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Remover"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Gastos por categoria" />
            {categories.length === 0 ? <p className="px-5 pb-5 text-[13px] text-muted">Sem despesas.</p> : (
              <div className="px-3 pb-4">
                <div className="h-48">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categories} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} stroke="none">
                        {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <RTooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 px-2">
                  {categories.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-[12.5px]"><span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="flex-1">{c.name}</span><span className="tabular-nums text-muted">{formatBRL(c.value)}</span><span className="w-10 text-right text-[11px] text-faint">{Math.round((c.value / expense) * 100)}%</span></div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Últimos meses" />
            <div className="h-48 px-2 pb-4">
              <ResponsiveContainer>
                <BarChart data={history.map((h) => ({ ...h, label: h.ym.slice(5) + "/" + h.ym.slice(2, 4) }))}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <RTooltip formatter={(v) => formatBRL(Number(v))} contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 10, fontSize: 12 }} cursor={{ fill: "var(--surface-2)" }} />
                  <Bar dataKey="receita" name="Entradas" fill="var(--success)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Saídas" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
      <p className="text-[12px] text-faint">Finanças pessoais. Caixa, clientes e cobranças da AG LABS ficam no CRM.</p>
    </div>
  );
}
