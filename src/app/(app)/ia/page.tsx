import { Sparkles } from "lucide-react";
import { AiChat } from "@/components/life/ai-chat";
import { PageHeader } from "@/components/ui/card";
import { aiEnabled, aiModel } from "@/server/ai";

export const metadata = { title: "IA" };

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHeader icon={<Sparkles />} title="IA" description={`Assistente com o contexto do seu dia e do vault · ${aiModel()}`} />
      <AiChat enabled={aiEnabled()} />
    </div>
  );
}
