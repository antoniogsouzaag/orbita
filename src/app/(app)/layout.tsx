import { AppShell, type ShellNotification } from "@/components/shell/app-shell";
import { requireAuth } from "@/lib/auth";
import { localTime, today } from "@/lib/dates";
import { eventsBetween } from "@/server/calendar";
import { listProjects } from "@/server/projects";
import { avatarVersion, getSettings } from "@/server/settings";
import { listTasks } from "@/server/tasks";

export const dynamic = "force-dynamic";

/** Versão pequena da capa: no fundo ela vai desfocada, não precisa de resolução. */
const small = (url: string) => (url.includes("images.unsplash.com") ? url.replace(/([?&])w=\d+/, "$1w=640").replace(/([?&])q=\d+/, "$1q=50") : url);

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const now = new Date();
  const [settings, projects, overdue, upcoming, avatarV] = await Promise.all([
    getSettings(),
    listProjects(),
    listTasks({ view: "atrasadas", limit: 20 }),
    eventsBetween(now, new Date(now.getTime() + 3 * 3_600_000)),
    avatarVersion(),
  ]);
  const t = today();
  const notifications: ShellNotification[] = [
    ...upcoming
      .filter((e) => !e.allDay)
      .map((e) => ({ id: `e-${e.id}`, title: e.title, detail: `Começa às ${localTime(e.startAt)}`, href: "/agenda", tone: "info" as const })),
    ...overdue.map((tk) => ({ id: `t-${tk.id}`, title: tk.title, detail: `Atrasada · venceu ${tk.dueDate === t ? "hoje" : tk.dueDate?.split("-").reverse().slice(0, 2).join("/")}`, href: `/tarefas?task=${tk.id}`, tone: "danger" as const })),
  ];
  return (
    <AppShell wallpapers={{ pessoal: small(settings.cover.url), empresa: small(settings.empresaCover.url) }} name={settings.name} avatar={avatarV ? `/api/avatar?v=${avatarV}` : null} notifications={notifications} projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))}>
      {children}
    </AppShell>
  );
}
