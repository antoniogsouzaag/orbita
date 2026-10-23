import {
  BarChart3, BookOpen, Bot, CalendarDays, CheckSquare, Dumbbell, FolderKanban, Gauge, Goal, Home,
  KanbanSquare, LibraryBig, NotebookPen, Plug, Repeat, Server, Settings, Sparkles, Timer, Wallet, Workflow, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; dock?: boolean; keywords?: string };
export type NavSection = { label: string; items: NavItem[] };

export const NAV: NavSection[] = [
  {
    label: "Núcleo",
    items: [
      { href: "/", label: "Início", icon: Home, dock: true },
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare, dock: true, keywords: "todo afazeres" },
      { href: "/projetos", label: "Projetos", icon: FolderKanban },
      { href: "/kanban", label: "Kanban", icon: KanbanSquare },
      { href: "/agenda", label: "Agenda", icon: CalendarDays, dock: true, keywords: "calendário eventos" },
      { href: "/notas", label: "Notas", icon: NotebookPen, dock: true },
    ],
  },
  {
    label: "Vida",
    items: [
      { href: "/metas", label: "Metas", icon: Goal },
      { href: "/habitos", label: "Hábitos", icon: Repeat, dock: true },
      { href: "/academia", label: "Academia", icon: Dumbbell, keywords: "treino saúde" },
      { href: "/financas", label: "Finanças", icon: Wallet, keywords: "dinheiro gastos" },
      { href: "/leitura", label: "Leitura", icon: BookOpen, keywords: "livros" },
      { href: "/foco", label: "Foco", icon: Timer, keywords: "pomodoro" },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/vault", label: "Vault", icon: LibraryBig, dock: true, keywords: "obsidian conhecimento manual" },
      { href: "/operacao", label: "Visão geral", icon: Gauge, dock: true, keywords: "status infra" },
      { href: "/operacao/automacoes", label: "Automações", icon: Workflow, keywords: "n8n workflows" },
      { href: "/operacao/infra", label: "Infra & agentes", icon: Server, keywords: "vps servidores agentes apps" },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/revisao", label: "Revisão", icon: BarChart3, keywords: "semana humor energia" },
      { href: "/ia", label: "IA", icon: Sparkles, dock: true, keywords: "claude assistente" },
      { href: "/integracoes", label: "Integrações", icon: Plug, keywords: "conexões configurar" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/config", label: "Configurações", icon: Settings };
export const AI_ICON = Bot;

export const ALL_NAV: NavItem[] = [...NAV.flatMap((s) => s.items), SETTINGS_ITEM];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/operacao") return pathname === "/operacao";
  return pathname === href || pathname.startsWith(`${href}/`);
}
