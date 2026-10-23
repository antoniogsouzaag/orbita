import { Plug } from "lucide-react";
import { IntegrationHealth } from "@/components/agents/integration-health";
import { PageHeader } from "@/components/ui/card";
import { integrationConfiguration } from "@/server/integrations";

export const metadata = { title: "Integrações" };
export default function Page() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<Plug />} title="Integrações" description="Conexões e diagnóstico do ecossistema. Workflows e batidas estão em Automações e Operação." />
    <IntegrationHealth initial={integrationConfiguration()} />
  </div>;
}
