import { AiChat } from "@/components/life/ai-chat";
import { aiEnabled, aiModel } from "@/server/ai";
import { crmUrl } from "@/server/crm";
import { actionOrigins } from "@/lib/ai-stream";

export const metadata = { title: "ORBE" };

export default async function Page({ searchParams }: { searchParams: Promise<{ escopo?: string }> }) {
  const scope = (await searchParams).escopo === "empresa" ? "empresa" : "pessoal";
  return <AiChat key={scope} scope={scope} enabled={aiEnabled()} model={aiModel()} trustedActionOrigins={actionOrigins(crmUrl())} />;
}
