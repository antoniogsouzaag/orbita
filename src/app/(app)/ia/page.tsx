import { z } from "zod";
import { AiChat } from "@/components/life/ai-chat";
import { aiEnabled, aiModel } from "@/server/ai";
import { crmUrl } from "@/server/crm";
import { actionOrigins } from "@/lib/ai-stream";

export const metadata = { title: "ORBE" };

export default async function Page({ searchParams }: { searchParams: Promise<{ escopo?: string; c?: string; memoria?: string }> }) {
  const params = await searchParams;
  const scope = params.escopo === "empresa" ? "empresa" : "pessoal";
  const conversationId = z.uuid().safeParse(params.c).success ? params.c : undefined;
  return <AiChat key={scope} scope={scope} enabled={aiEnabled()} model={aiModel()} trustedActionOrigins={actionOrigins(crmUrl())} conversationId={conversationId} openMemory={params.memoria === "1"} />;
}
