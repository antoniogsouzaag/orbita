import { ChartNoAxesCombined } from "lucide-react";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { PageHeader } from "@/components/ui/card";
import { socialOverview, socialPanelUrl } from "@/server/social";
export const metadata = { title: "Redes sociais" };
export default async function Page({ searchParams }: { searchParams: Promise<{ canal?: string; dias?: string; entidade?: string }> }) {
  const { canal, dias, entidade } = await searchParams;
  const result = await socialOverview(canal, dias === "30" ? 30 : 7, false, entidade);
  return <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6"><PageHeader icon={<ChartNoAxesCombined />} title="Redes sociais" description="Entidades, canais e evolução de cada perfil." /><SocialDashboard key={`${canal ?? ""}:${entidade ?? ""}:${dias ?? ""}`} initial={result} panelUrl={socialPanelUrl()} /></div>;
}
