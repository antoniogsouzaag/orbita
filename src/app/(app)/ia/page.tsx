import { Sparkles } from "lucide-react";
import { AiChat } from "@/components/life/ai-chat";
import { PageHeader } from "@/components/ui/card";
import { aiEnabled, aiModel } from "@/server/ai";

export const metadata = { title: "IA" };

export default async function Page({ searchParams }: { searchParams: Promise<{ escopo?: string }> }) {
  const scope = (await searchParams).escopo === "empresa" ? "empresa" : "pessoal";
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHeader icon={<Sparkles />} title="IA" description={`Assistente com o contexto ${scope === "empresa" ? "da empresa" : "pessoal"} e do vault · ${aiModel()}`} />
      <AiChat key={scope} scope={scope} enabled={aiEnabled()} />
    </div>
  );
}
