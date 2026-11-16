import type { ProductFunnel } from "@/lib/product-funnel";
import { Card } from "@/components/ui/card";
const stages = {
  acquisition_sessions: ["Visita", "Clique", "Login", "Checkout criado"],
  trip_creation_users: ["Iniciaram", "Criaram viagem", "Viram o roteiro"],
  credit_journey_users: ["Geração concluída", "Visitaram créditos", "Iniciaram checkout", "Compra registrada"],
};
const keys = { all: "Total", manual: "Manual", ai: "Com IA" };
const sourceNames: Record<string, string> = { direct: "Direto / não identificado", instagram: "Instagram", facebook: "Facebook", linkedin: "LinkedIn", google: "Google", youtube: "YouTube", mecard_card: "Selo MeCard", other: "Outros" };
const num = (v: number | null) => v === null ? "—" : v.toLocaleString("pt-BR");
export function ProductFunnelCard({ funnel }: { funnel?: ProductFunnel | null }) {
  if (!funnel) return <Card className="p-4"><h2 className="text-sm font-semibold">Jornada no aplicativo</h2><p className="mt-2 text-xs text-muted">Funil ainda não informado pela origem. Nenhum zero foi presumido.</p></Card>;
  const labels = stages[funnel.kind];
  return <Card className="overflow-hidden p-4">
    <h2 className="text-sm font-semibold">Jornada no aplicativo</h2>
    <p className="mt-1 text-xs text-muted">{new Date(funnel.from).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} a {new Date(Date.parse(funnel.to) - 1).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {funnel.unit === "sessions" ? "sessões" : "usuários distintos"}</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th className="p-2 font-medium">Jornada</th>{labels.map(label => <th key={label} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>
      {funnel.series.map(row => <tr key={row.key} className="border-t border-border"><th className="p-2 font-medium">{keys[row.key]}</th>{row.values.map((v, i) => <td key={i} className="p-2 tabular-nums">{num(v)}{funnel.ordered && i > 0 && v !== null && row.values[i - 1] ? <span className="ml-1 text-faint">· {Math.round(v / row.values[i - 1]! * 100)}%</span> : null}</td>)}</tr>)}
      {funnel.sources?.map(row => <tr key={row.key} className="border-t border-border text-muted"><th className="p-2 font-normal">{sourceNames[row.key]}</th>{row.values.map((v, i) => <td key={i} className="p-2 tabular-nums">{num(v)}</td>)}</tr>)}
    </tbody></table></div>
    <p className="mt-3 text-[11px] leading-relaxed text-faint">{funnel.kind === "acquisition_sessions" ? "Etapas em ordem na mesma sessão, iniciada no período; não são pessoas únicas. Coleta existente, sujeita a bloqueadores e preferências de privacidade; retenção de 90 dias." : funnel.kind === "trip_creation_users" ? "Etapas em ordem na mesma criação, iniciada no período. Uma pessoa pode aparecer em Manual e Com IA; o total remove repetidos. Só eventos de contas preservadas; exclusões reduzem o histórico." : "Etapas independentes na mesma janela, sem coorte ou taxa de abandono. Geração concluída não comprova visualização do resultado. Visita e checkout usam telemetria existente; — indica ausência de cobertura. Compra registrada não comprova liquidação."}</p>
  </Card>;
}
