import { AppShell } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/auth";
import { listProjects } from "@/server/projects";
import { avatarVersion, getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Versão pequena da capa: no fundo ela vai desfocada, não precisa de resolução. */
const small = (url: string) => (url.includes("images.unsplash.com") ? url.replace(/([?&])w=\d+/, "$1w=640").replace(/([?&])q=\d+/, "$1q=50") : url);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const [settings, projects, avatarV] = await Promise.all([
    getSettings(),
    listProjects(),
    avatarVersion(),
  ]);
  return (
    <AppShell wallpapers={{ pessoal: small(settings.cover.url), empresa: small(settings.empresaCover.url) }} name={settings.name} avatar={avatarV ? `/api/avatar?v=${avatarV}` : null} notifications={[]} projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}>
      {children}
    </AppShell>
  );
}
