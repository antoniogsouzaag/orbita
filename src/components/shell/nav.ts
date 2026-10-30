import {
  BarChart3, BookOpen, Bot, Briefcase, Building2, CalendarDays, CheckSquare, Dumbbell, FolderKanban, Gauge, Goal, Home, GitFork,
  LibraryBig, MessageSquareHeart, MessageSquareText, NotebookPen, Plug, Repeat, Settings, Sparkles, Timer, User, Wallet, Workflow, type LucideIcon,
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
          { href: "/projetos", label: "Projetos", icon: FolderKanban },
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
          { href: "/propostas", label: "Propostas", icon: MessageSquareText, keywords: "decisões respostas aguardando agentes continuidade" },
          { href: "/empresa/negocios", label: "Negócios", icon: Building2, keywords: "produtos barberias members mecard viajeki" },
          { href: "/empresa/feedback", label: "Feedback", icon: MessageSquareHeart, keywords: "feedback usuários apps reclamações sugestões members mecard barberias viajeki" },
          { href: "/projetos?escopo=empresa", label: "Projetos", icon: FolderKanban },
          { href: "/notas?escopo=empresa", label: "Notas", icon: NotebookPen, keywords: "rascunhos ideias anotações da empresa" },
          { href: "/foco?escopo=empresa", label: "Foco", icon: Timer },
        ],
      },
      {
        label: "Operação",
        items: [
          { href: "/operacao", label: "Operação", icon: Gauge, dock: true, keywords: "status sites domínios monitor incidentes" },
          { href: "/operacao/automacoes", label: "Automações", icon: Workflow, keywords: "n8n workflows falhas" },
          { href: "/redes", label: "Redes sociais", icon: BarChart3, keywords: "postiz analytics canais distribuição" },
          { href: "/agentes", label: "Agentes", icon: Bot, dock: true, keywords: "mcp claude codex tokens equipe" },
        ],
      },
    ],
  },
};

export const SHARED: NavItem[] = [
  { href: "/github", label: "GitHub", icon: GitFork, keywords: "git commits contribuições prs propostas repositórios" },
  { href: "/vault", label: "Vault", icon: LibraryBig, dock: true, keywords: "obsidian manual inventário conhecimento empresa grafo" },
  { href: "/ia", label: "ORBE", icon: Sparkles, dock: true, keywords: "ia assistente chat orbe" },
  { href: "/documentacao", label: "Manual da Órbita", icon: BookOpen, keywords: "documentação canônica mcp agentes fontes responsabilidades" },
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

const EMPRESA_PATHS = ["/empresa", "/redes", "/operacao", "/agentes", "/propostas"];
const SCOPED_PATHS = ["/tarefas", "/projetos", "/kanban", "/foco", "/metas", "/ia", "/notas"];
const PESSOAL_PATHS = ["/agenda", "/notas", "/habitos", "/metas", "/financas", "/academia", "/leitura", "/revisao"];

/** Espaço da rota atual; null = tela comum aos dois (IA, Integrações, Configurações). */
export function spaceOf(pathname: string, escopo?: string | null): Space | null {
  if (SCOPED_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))) return escopo === "empresa" ? "empresa" : "pessoal";
  if (EMPRESA_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "empresa";
  if (pathname === "/" || PESSOAL_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "pessoal";
  return null;
}

export function isActive(pathname: string, href: string, escopo?: string | null) {
  const [path, query] = href.split("?");
  if (SCOPED_PATHS.includes(path)) return pathname === path && (query?.includes("escopo=empresa") ? escopo === "empresa" : escopo !== "empresa");
  if (path === "/") return pathname === "/";
  if (path === "/empresa") return pathname === "/empresa";
  if (path === "/operacao") return pathname === "/operacao";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function navigationHref(href: string, space: Space) { return href === "/ia" && space === "empresa" ? "/ia?escopo=empresa" : href; }
