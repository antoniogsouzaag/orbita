import { Plug, Workflow } from "lucide-react";
import { headers } from "next/headers";
import { IntegrationHealth } from "@/components/agents/integration-health";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, PageHeader } from "@/components/ui/card";
import { integrationConfiguration } from "@/server/integrations";

export const metadata = { title: "Integrações" };

export default async function Page() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const integrations = integrationConfiguration();

  const ingestExample = `{
  "source": "n8n-vps03-ping",
  "label": "ping my links (VPS-03)",
  "everyMinutes": 15,
  "links": {{ JSON.stringify($('Lista de links').all().map((l, i) => ({ ...l.json, status: $('Verificar URL').all()[i]?.json.statusCode ?? 0, erro: $('Verificar URL').all()[i]?.json.error?.message ?? null }))) }}
}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Plug />} title="Integrações" description="Conexões, diagnóstico e próximos passos para manter o ecossistema em sincronia." />
      <IntegrationHealth initial={integrations} />

      <Card className="space-y-4 p-5 text-[13px] text-muted">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg"><Workflow className="size-4" /> Como ligar os monitores do n8n</div>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b className="text-fg">Lista única no vault.</b> No “ping my links”, troque o nó <i>Cadastro lista de links</i> por um <i>HTTP Request</i> GET em <code>{base}/api/ops/alvos</code> (cabeçalho <code>Authorization: Bearer OPS_TOKEN</code>), mantendo a lista atual como reserva caso a Órbita não responda. Assim, editar a nota “Monitoramento de Disponibilidade” muda o que é monitorado.</li>
          <li><b className="text-fg">Enviar resultados.</b> Ao final de cada execução (não só quando há alerta), um <i>HTTP Request</i> POST em <code>{base}/api/ops/ingest</code> com o corpo abaixo. Faça o mesmo no monitor cruzado do VPS-01 com <code>source</code> próprio.</li>
          <li><b className="text-fg">Domínios.</b> No “vencimento de domínios”, envie <code>{`{ source, everyMinutes: 4320, domains: [{ dominio, depende, expiracao, erro }] }`}</code> com todos os domínios consultados.</li>
          <li><b className="text-fg">Falhas de workflow.</b> Nos fluxos “alerta de falhas” de cada n8n, envie <code>{`{ source, workflowError: { workflow, node, message, executionUrl } }`}</code>.</li>
        </ol>
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-[11.5px] leading-relaxed text-fg">{ingestExample}</pre>
          <CopyButton text={ingestExample} className="absolute right-2 top-2" />
        </div>
        <p className="text-[12px] text-faint">Se um monitor parar de enviar por mais de 2,5× o intervalo esperado, a Operação mostra “monitor em silêncio”.</p>
      </Card>
    </div>
  );
}
