import {
  BarChart3, BookOpen, Bot, Briefcase, Building2, CalendarDays, CheckSquare, Dumbbell, FolderKanban, Gauge, Goal, Home,
  KanbanSquare, LibraryBig, NotebookPen, Plug, Repeat, Settings, Sparkles, Timer, User, Wallet, Workflow, type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; dock?: boolean; keywords?: string };
export type NavSection = { label: string; items: NavItem[] };
export type Space = "pessoal" | "empresa";

/** Dois espaços: a vida pessoal e o trabalho da AG LABS. IA, integrações e ajustes são comuns aos dois. */
export const SPACES: Record<Space, { label: string; icon: LucideIcon; home: string; sections: NavSection[] }> = {
  pessoal: {
    label: "Pessoal",
    icon: User,
    home: "/",
    sections: [
      {
        label: "Dia a dia",
        items: [
          { href: "/", label: "Início", icon: Home, dock: true },
          { href: "/tarefas", label: "Tarefas", icon: CheckSquare, dock: true, keywords: "todo afazeres pessoais" },
          { href: "/agenda", label: "Agenda", icon: CalendarDays, dock: true, keywords: "calendário eventos" },
          { href: "/notas", label: "Notas", icon: NotebookPen, dock: true },
        ],
      },
      {
        label: "Vida",
        items: [
          { href: "/habitos", label: "Hábitos", icon: Repeat, dock: true },
          { href: "/metas", label: "Metas", icon: Goal },
          { href: "/financas", label: "Finanças", icon: Wallet, keywords: "dinheiro gastos" },
          { href: "/academia", label: "Academia", icon: Dumbbell, keywords: "treino saúde" },
          { href: "/leitura", label: "Leitura", icon: BookOpen, keywords: "livros" },
          { href: "/foco", label: "Foco", icon: Timer, keywords: "pomodoro" },
          { href: "/revisao", label: "Revisão", icon: BarChart3, keywords: "semana humor energia" },
        ],
      },
    ],
  },
  empresa: {
    label: "Empresa",
    icon: Briefcase,
    home: "/empresa",
    sections: [
      {
        label: "AG LABS",
        items: [
          { href: "/empresa", label: "Visão geral", icon: Building2, dock: true, keywords: "empresa aguardando aprovação" },
          { href: "/tarefas?escopo=empresa", label: "Tarefas", icon: CheckSquare, dock: true, keywords: "tarefas da empresa" },
          { href: "/projetos", label: "Projetos", icon: FolderKanban },
          { href: "/kanban", label: "Kanban", icon: KanbanSquare },
        ],
      },
      {
        label: "Operação",
        items: [
          { href: "/operacao", label: "Operação", icon: Gauge, dock: true, keywords: "status sites domínios monitor incidentes" },
          { href: "/operacao/automacoes", label: "Automações", icon: Workflow, keywords: "n8n workflows falhas" },
          { href: "/agentes", label: "Agentes", icon: Bot, dock: true, keywords: "mcp claude codex tokens equipe" },
          { href: "/vault", label: "Vault", icon: LibraryBig, dock: true, keywords: "obsidian conhecimento manual" },
        ],
      },
    ],
  },
};

export const SHARED: NavItem[] = [
  { href: "/ia", label: "IA", icon: Sparkles, dock: true, keywords: "assistente chat" },
  { href: "/integracoes", label: "Integrações", icon: Plug, keywords: "conexões configurar" },
];

export const SETTINGS_ITEM: NavItem = { href: "/config", label: "Configurações", icon: Settings };
export const AI_ICON = Bot;

/** Compatibilidade: todas as seções, na ordem Pessoal → Empresa → Geral. */
export const NAV: NavSection[] = [
  ...SPACES.pessoal.sections.map((s) => ({ ...s, label: `${s.label}` })),
  ...SPACES.empresa.sections,
  { label: "Geral", items: SHARED },
];

export const ALL_NAV: NavItem[] = [...NAV.flatMap((s) => s.items), SETTINGS_ITEM];

const EMPRESA_PATHS = ["/empresa", "/operacao", "/agentes", "/vault", "/projetos", "/kanban"];
const PESSOAL_PATHS = ["/tarefas", "/agenda", "/notas", "/habitos", "/metas", "/financas", "/academia", "/leitura", "/foco", "/revisao"];

/** Espaço da rota atual; null = tela comum aos dois (IA, Integrações, Configurações). */
export function spaceOf(pathname: string, escopo?: string | null): Space | null {
  if (pathname === "/tarefas" && escopo === "empresa") return "empresa";
  if (EMPRESA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "empresa";
  if (pathname === "/" || PESSOAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "pessoal";
  return null;
}

export function isActive(pathname: string, href: string, escopo?: string | null) {
  const [path, query] = href.split("?");
  if (path === "/tarefas") return pathname === "/tarefas" && (query?.includes("escopo=empresa") ? escopo === "empresa" : escopo !== "empresa");
  if (path === "/") return pathname === "/";
  if (path === "/operacao") return pathname === "/operacao";
  return pathname === path || pathname.startsWith(`${path}/`);
}
