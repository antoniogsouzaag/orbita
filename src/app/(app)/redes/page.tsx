import Link from "next/link";
import { ChartNoAxesCombined } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { socialOverview } from "@/server/social";

export const metadata = { title: "Redes sociais" };
export default async function Page({ searchParams }: { searchParams: Promise<{ canal?: string }> }) {
  const { canal } = await searchParams;
  const result = await socialOverview(canal);
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<ChartNoAxesCombined />} title="Redes sociais" description="Canais e métricas do Postiz, reunidos para acompanhar a distribuição do ecossistema." />
    <p className="text-xs text-muted">Fonte: Postiz · janela solicitada: 7 dias · consulta em {new Date(result.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · cache de até 1 hora. As redes têm definições e coberturas diferentes; não somamos métricas entre canais.</p>
    {!result.configured && <Card className="p-5 text-sm text-muted">Configure POSTIZ_API_URL com a base HTTPS da API (terminando em /public/v1) e POSTIZ_API_KEY na Vercel. A conexão do Postiz deste chat não fornece credenciais à Órbita.</Card>}
    {result.error && <Card className="p-5 text-sm text-warning">{result.error}</Card>}
    {result.available && <nav aria-label="Canais do Postiz" className="flex flex-wrap gap-2">{result.available.map((channel) => <Link key={channel.id} href={`/redes?canal=${encodeURIComponent(channel.id)}`} prefetch={false} aria-current={result.channels[0]?.id === channel.id ? "page" : undefined} className={`rounded-full border px-3 py-2 text-xs transition hover:bg-surface-2 ${result.channels[0]?.id === channel.id ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted"}`}>{channel.name} · {channel.identifier}</Link>)}</nav>}
    <a href="https://postiz.aglabs.ia.br/analytics" target="_blank" rel="noopener noreferrer" className="inline-flex text-xs text-accent hover:underline">Abrir painel completo no Postiz ↗</a>
    <div className="grid items-start gap-4">{result.channels.map((channel) => <Card key={channel.id} className="min-w-0 p-5">
      <h2 className="text-sm font-semibold">{channel.name}</h2><p className="mt-1 text-xs text-faint">{channel.identifier} · {channel.disabled ? "desativado" : "conectado no Postiz"}</p>
      {channel.error && <p className="mt-4 text-xs text-warning">{channel.error}</p>}
      {!channel.error && !channel.metrics.length && <p className="mt-4 text-xs text-muted">Nenhuma série retornada. Isso não confirma atividade zero.</p>}
      {channel.metrics.map((metric) => <details key={metric.label} className="mt-4 rounded-xl border border-border p-3"><summary className="cursor-pointer text-xs font-medium">{metric.label} · {metric.data.length} pontos retornados</summary>
        <div className="mt-3 max-h-48 overflow-y-auto"><table className="w-full text-xs"><thead><tr className="text-left text-faint"><th>Data</th><th className="text-right">Valor informado pela rede</th></tr></thead><tbody>{metric.data.map((point, i) => <tr key={`${point.date}-${i}`}><td className="py-1 text-muted">{point.date}</td><td className="text-right tabular-nums">{point.total}</td></tr>)}</tbody></table></div>
      </details>)}
    </Card>)}</div>
    {result.configured && !result.error && !result.channels.length && <Card className="p-5 text-sm text-muted">Nenhum canal retornado pelo Postiz.</Card>}
    {result.total && result.total > result.channels.length ? <p className="text-xs text-faint">{result.total} canais disponíveis. Selecione um canal para consultar as séries sem fazer chamadas desnecessárias.</p> : null}
  </div>;
}
