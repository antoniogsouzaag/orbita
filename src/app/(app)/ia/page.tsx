import { Sparkles } from "lucide-react";
import { AiChat } from "@/components/life/ai-chat";
import { PageHeader } from "@/components/ui/card";
import { aiEnabled, aiModel } from "@/server/ai";
import { crmUrl } from "@/server/crm";
import { actionOrigins } from "@/lib/ai-stream";

export const metadata = { title: "ORBE" };

export default async function Page({ searchParams }: { searchParams: Promise<{ escopo?: string }> }) {
  const scope = (await searchParams).escopo === "empresa" ? "empresa" : "pessoal";
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHeader icon={<Sparkles />} title="ORBE" description={`Sua assistente com o contexto ${scope === "empresa" ? "da empresa" : "pessoal"} e do vault · ${aiModel()}`} />
      <AiChat key={scope} scope={scope} enabled={aiEnabled()} trustedActionOrigins={actionOrigins(crmUrl())} />
    </div>
  );
}
