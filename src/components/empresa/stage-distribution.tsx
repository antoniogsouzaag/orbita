/** Current-stage stocks have different populations: their ratio is not a conversion rate. */
export function StageDistribution({ rows }: { rows: { label: string; value: number | null }[] }) {
  const complete = rows.every(row => row.value !== null);
  const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return <ol aria-label="Distribuição atual das oportunidades" className="space-y-2">
    {rows.map((row, i) => {
      const share = complete && total > 0 && row.value !== null ? row.value / total * 100 : null;
      return <li key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-[12px]">
        <span className="truncate text-muted">{row.label}</span>
        <span className="h-6 overflow-hidden rounded-md bg-surface-2"><span className="block h-full rounded-md" style={{ width: `${share ?? 0}%`, background: `var(--chart-${(i % 5) + 1})` }} /></span>
        <span className="w-24 text-right tabular-nums"><span className="font-semibold">{row.value === null ? "—" : row.value.toLocaleString("pt-BR")}</span>{share !== null && <span className="block text-[10px] text-faint">{share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do total</span>}</span>
      </li>;
    })}
  </ol>;
}
