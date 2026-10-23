import { Sparkles } from "lucide-react";
import { AiChat } from "@/components/life/ai-chat";
import { PageHeader } from "@/components/ui/card";
import { AI_MODEL, aiClient } from "@/server/ai";

export const metadata = { title: "IA" };

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHeader icon={<Sparkles />} title="IA" description={`Assistente com o contexto do seu dia e do vault · ${AI_MODEL}`} />
      <AiChat enabled={Boolean(aiClient())} />
    </div>
  );
}
