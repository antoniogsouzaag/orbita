import { HermesIntegration } from "@/components/agents/hermes-integration";
import { hermesConfiguration, hermesHistory } from "@/server/hermes";
import { Plug } from "lucide-react";
import { IntegrationHealth } from "@/components/agents/integration-health";
import { PageHeader } from "@/components/ui/card";
import { integrationConfiguration } from "@/server/integrations";

export const metadata = { title: "Integrações" };
export default async function Page() {
  const history = await hermesHistory();
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<Plug />} title="Integrações" description="Conexões e diagnóstico do ecossistema. Workflows e batidas estão em Automações e Operação." />
    <HermesIntegration config={hermesConfiguration()} initial={history} /><details className="rounded-xl border border-border p-4"><summary className="cursor-pointer text-sm font-medium">Diagnóstico das conexões existentes</summary><div className="mt-4"><IntegrationHealth initial={integrationConfiguration()} /></div></details>
  </div>;
}
