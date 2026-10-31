import { ChartNoAxesCombined } from "lucide-react";
import { SocialDashboard } from "@/components/social/social-dashboard";
import { SocialStudio } from "@/components/social/social-studio";
import { PageHeader } from "@/components/ui/card";
import type { SocialPost } from "@/db/schema";
import { socialOverview, socialPanelUrl } from "@/server/social";
import { listSocialPosts } from "@/server/social-posts";
export const metadata = { title: "Redes sociais" };
const TABS = ["hoje", "producao", "calendario", "metricas"] as const;
export default async function Page({ searchParams }: { searchParams: Promise<{ canal?: string; dias?: string; entidade?: string; aba?: string }> }) {
  const { canal, dias, entidade, aba } = await searchParams;
  // Links antigos com canal/entidade continuam abrindo direto nas métricas.
  const tab = TABS.find(t => t === aba) ?? (canal || entidade ? "metricas" : "hoje");
  const [result, posts] = await Promise.all([
    socialOverview(canal, dias === "30" ? 30 : 7, false, entidade),
    listSocialPosts().then(rows => ({ rows, error: null as string | null })).catch((): { rows: SocialPost[]; error: string } => ({ rows: [], error: "Não foi possível ler o pipeline de posts. Confira se a migração 0009_social_posts foi aplicada." })),
  ]);
  return <div className="mx-auto max-w-6xl space-y-5 px-4 sm:px-6">
    <PageHeader icon={<ChartNoAxesCombined />} title="Redes sociais" description="Produção, calendário, qualidade e métricas das marcas." />
    <SocialStudio posts={posts.rows} dbError={posts.error} initialTab={tab} metrics={<SocialDashboard key={`${canal ?? ""}:${entidade ?? ""}:${dias ?? ""}`} initial={result} panelUrl={socialPanelUrl()} />} />
  </div>;
}
