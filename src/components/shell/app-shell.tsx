"use client";

import { Bell, CheckCheck, LayoutGrid, LogOut, Monitor, Moon, PanelLeft, Plus, RefreshCw, Search, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { Popover } from "radix-ui";
import * as React from "react";
import { logout } from "@/app/actions/auth";
import { GlassFilter } from "@/components/ui/liquid-glass-button";
import { Kbd } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { acknowledgeNotifications, type ShellNotification } from "@/lib/notifications";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { SETTINGS_ITEM, SHARED, SPACES, isActive, spaceOf, type NavItem, type Space } from "./nav";
import { QuickAdd } from "./quick-add";
import { SpeedDial } from "./speed-dial";
import { storePreference, useScrolled, useStoredPreference } from "./browser-state";

export type { ShellNotification } from "@/lib/notifications";

type Ctx = { openPalette: () => void; openQuickAdd: (tab?: string) => void };
const ShellContext = React.createContext<Ctx>({ openPalette: () => {}, openQuickAdd: () => {} });
export const useShell = () => React.useContext(ShellContext);

/** Espaço atual (Pessoal/Empresa): vem da rota; nas telas comuns, fica o último usado. */
function useSpace(): { space: Space; escopo: string | null } {
  const pathname = usePathname();
  const escopo = useSearchParams().get("escopo");
  const fromRoute = spaceOf(pathname, escopo);
  const last = useStoredPreference("orbita:space", "pessoal");
  React.useEffect(() => {
    if (fromRoute) storePreference("orbita:space", fromRoute);
  }, [fromRoute]);
  return { space: fromRoute ?? (last === "empresa" ? "empresa" : "pessoal"), escopo };
}

function SpaceSwitch({ space, className }: { space: Space; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-0.5 rounded-xl border border-border bg-surface-2/70 p-0.5", className)}>
      {(Object.keys(SPACES) as Space[]).map((k) => {
        const S = SPACES[k];
        const on = k === space;
        return (
          <Link key={k} href={S.home} prefetch={true} className={cn("flex h-8 items-center justify-center gap-1.5 rounded-[10px] text-[12.5px] font-medium transition", on ? "bg-surface text-fg shadow-sm ring-1 ring-border" : "text-muted hover:text-fg")} aria-current={on ? "true" : undefined}>
            <S.icon className="size-3.5" /> {S.label}
          </Link>
        );
      })}
    </div>
  );
}

function NavLink({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 text-[13px] transition",
        compact ? "h-8" : "h-8",
        active ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-accent" />}
      <item.icon className={cn("size-4", active ? "text-accent" : "text-faint group-hover:text-fg")} /> {item.label}
    </Link>
  );
}

/** Capa do espaço atual atrás de tudo, desfocada (veja .app-wallpaper em globals.css). */
function Wallpaper({ urls }: { urls: Record<Space, string> }) {
  const { space } = useSpace();
  const [failed, setFailed] = React.useState<string | null>(null);
  const url = urls[space];
  return (
    <div aria-hidden className="app-wallpaper">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && failed !== url && <img key={url} src={url} alt="" decoding="async" onError={() => setFailed(url)} />}
    </div>
  );
}

export function AppShell({
  children,
  avatar,
  name,
  notifications,
  projects,
  wallpapers,
}: {
  children: React.ReactNode;
  wallpapers: Record<Space, string>;
  avatar?: string | null;
  name: string;
  notifications: ShellNotification[];
  projects: { id: string; name: string; color: string }[];
}) {
  const pathname = usePathname();
  const { space } = useSpace();
  const sidebar = useStoredPreference("orbita:sidebar", "0") === "1";
  const setSidebar = (value: boolean) => storePreference("orbita:sidebar", value ? "1" : "0");
  const [palette, setPalette] = React.useState(false);
  const [quick, setQuick] = React.useState<{ open: boolean; tab?: string }>({ open: false });
  const scrolled = useScrolled();
  const [items, setItems] = React.useState(notifications);
  const readRaw = useStoredPreference("orbita:notifications:read", "[]");
  const read = React.useMemo<string[]>(() => {
    try { const value = JSON.parse(readRaw); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-300) : []; } catch { return []; }
  }, [readRaw]);
  const [noticesOpen, setNoticesOpen] = React.useState(false);
  const [noticeError, setNoticeError] = React.useState(false);
  const [checkedAt, setCheckedAt] = React.useState<string | null>(null);
  const refreshingNotices = React.useRef(false);
  const unread = items.filter((n) => !read.includes(n.id)).length;
  const refreshNotices = React.useCallback((): Promise<void> => {
    if (refreshingNotices.current) return Promise.resolve();
    refreshingNotices.current = true;
    return fetch("/api/notifications", { cache: "no-store", signal: AbortSignal.timeout(15_000) }).then(async (response) => {
      if (!response.ok) throw new Error("notifications");
      const data = await response.json();
      setItems(data.items);
      setCheckedAt(data.checkedAt);
      setNoticeError(false);
    }).catch(() => { setNoticeError(true); }).finally(() => { refreshingNotices.current = false; });
  }, []);
  const markRead = (ids: string[]) => storePreference("orbita:notifications:read", JSON.stringify(acknowledgeNotifications(read, ids)));

  React.useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void refreshNotices(); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [refreshNotices]);

  React.useEffect(() => { void refreshNotices(); }, [pathname, refreshNotices]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") storePreference("orbita:sidebar", "0");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(target.tagName) || target.closest(".cm-editor");
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setQuick({ open: true, tab: "tarefa" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleSidebar = () => {
    setSidebar(!sidebar);
  };

  const ctx = React.useMemo<Ctx>(() => ({ openPalette: () => setPalette(true), openQuickAdd: (tab) => setQuick({ open: true, tab }) }), []);
  // Início e Empresa têm capa: o topo fica transparente sobre a foto.
  const isHome = pathname === "/" || pathname === "/empresa";

  return (
    <ShellContext.Provider value={ctx}>
      <div className={cn("app-frame min-h-dvh", sidebar && "sidebar-open")}>
        <GlassFilter />
        <Wallpaper urls={wallpapers} />
        {sidebar && <button className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] lg:hidden" aria-label="Fechar navegação" onClick={toggleSidebar} />}
        <Sidebar open={sidebar} pathname={pathname} name={name} avatar={avatar} onCollapse={toggleSidebar} onNavigate={() => { if (window.matchMedia("(max-width: 1023px)").matches) setSidebar(false); }} onSearch={ctx.openPalette} onQuick={() => ctx.openQuickAdd("tarefa")} />

        <header
          className={cn(
            "fixed inset-x-0 top-0 z-40 transition-[background,border,backdrop-filter] duration-300",
            "pointer-events-none border-0 bg-transparent",
          )}
        >
          <div className="pointer-events-auto mx-auto flex h-14 max-w-[1500px] items-center gap-2 px-4 sm:px-6">
              <Link href="/" className={cn("brand-lockup flex items-center gap-2", sidebar && "lg:opacity-0 lg:pointer-events-none", isHome && !scrolled ? "text-white" : "text-fg")} aria-label="Início">
                <Logo className="size-7" />
                <span className="hidden text-[13px] font-semibold uppercase tracking-[0.22em] sm:inline">Órbita</span>
              </Link>
            <button onClick={toggleSidebar} className={cn("rounded-lg p-1.5 transition hover:bg-white/10", sidebar && "hidden", isHome && !scrolled ? "text-white/70 hover:text-white" : "text-muted hover:text-fg")} aria-label="Alternar barra lateral" aria-expanded={sidebar} aria-controls="workspace-sidebar">
              <PanelLeft className="size-[18px]" />
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={ctx.openPalette}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] transition",
                  isHome && !scrolled ? "glass border-white/10 text-white/85 hover:text-white" : "border-border bg-surface-2 text-muted hover:text-fg",
                )}
              >
                <Search className="size-4" />
                <span className="hidden sm:inline">Buscar</span>
                <span className="hidden items-center gap-0.5 sm:flex">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                </span>
              </button>
              <Notifications items={items} read={read} unread={unread} open={noticesOpen} onOpenChange={setNoticesOpen} onRead={markRead} onRefresh={refreshNotices} error={noticeError} checkedAt={checkedAt} light={isHome && !scrolled} />
              <UserMenu name={name} avatar={avatar} light={isHome && !scrolled} />
            </div>
          </div>
        </header>

        <main className={cn("pb-32", !isHome && "pt-20")}>{children}</main>

        <Dock key={`${pathname}:${space}`} pathname={pathname} hidden={sidebar} onQuick={(tab) => ctx.openQuickAdd(tab)} />
        <CommandPalette open={palette} onOpenChange={setPalette} onQuickAdd={ctx.openQuickAdd} />
        <div id="shell-overlays" />
        <QuickAdd scope={space} key={`${quick.open}:${quick.tab}`} open={quick.open} tab={quick.tab} projects={projects} onOpenChange={(open) => setQuick((q) => ({ ...q, open }))} />
      </div>
    </ShellContext.Provider>
  );
}

function Sidebar({ open, pathname, name, avatar, onCollapse, onNavigate, onSearch, onQuick }: { open: boolean; pathname: string; name: string; avatar?: string | null; onCollapse: () => void; onNavigate: () => void; onSearch: () => void; onQuick: () => void }) {
  const { space, escopo } = useSpace();
  return (
    <aside id="workspace-sidebar" aria-label="Navegação principal" aria-hidden={!open} inert={!open} onClick={(event) => { if ((event.target as HTMLElement).closest("a[href]")) onNavigate(); }} className={cn("workspace-sidebar glass fixed inset-y-2 left-2 z-50 flex w-[256px] flex-col overflow-hidden rounded-[22px] border border-border shadow-soft", open && "is-open")}>
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Logo className="size-7" />
        <span className="text-[13px] font-semibold uppercase tracking-[0.22em]">Órbita</span>
        <button onClick={onCollapse} className="ml-auto rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Recolher">
          <PanelLeft className="size-4" />
        </button>
      </div>
      <div className="space-y-1 px-3 pb-2">
        <button onClick={onSearch} className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-surface-2/70 px-3 text-[13px] text-muted hover:text-fg">
          <Search className="size-4" /> Buscar…
          <span className="ml-auto flex gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
        </button>
        <button onClick={onQuick} className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
          <Plus className="size-4" /> Captura rápida <Kbd className="ml-auto">C</Kbd>
        </button>

      </div>
      <SpaceSwitch space={space} className="mx-3 mb-1" />
      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {SPACES[space].sections.map((s) => (
          <div key={s.label}>
            <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{s.label}</div>
            {s.items.map((i) => <NavLink key={i.href} item={i} active={isActive(pathname, i.href, escopo)} />)}
          </div>
        ))}
        <div>
          <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">Geral</div>
          {SHARED.map((i) => <NavLink key={i.href} item={i} active={isActive(pathname, i.href, escopo)} />)}
        </div>
      </nav>
      <div className="border-t border-border p-3">
        <Link href={SETTINGS_ITEM.href} className={cn("flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px]", isActive(pathname, "/config") ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
          <Settings className="size-4" /> Configurações
        </Link>
        <div className="mt-2 flex items-center gap-2.5 px-2">
          <Avatar name={name} src={avatar} />
          <div className="min-w-0 text-[12.5px] font-medium">{name}</div>
        </div>
      </div>
    </aside>
  );
}

function Dock({ pathname, hidden, onQuick }: { pathname: string; hidden: boolean; onQuick: (tab: string) => void }) {
  const { space, escopo } = useSpace();
  const [dialOpen, setDialOpen] = React.useState(false);
  const items = [...SPACES[space].sections.flatMap((s) => s.items).filter((i) => i.dock), ...SHARED.filter((i) => i.dock)];
  const other: Space = space === "pessoal" ? "empresa" : "pessoal";
  const Other = SPACES[other];
  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-4 flex justify-center px-3", dialOpen ? "z-[60]" : "z-40", hidden && "lg:hidden")}>
      <nav className="glass pointer-events-auto flex items-center gap-1 rounded-[22px] border border-border p-1.5 shadow-soft">
        <Link href={Other.home} prefetch={true} title={`Ir para ${Other.label}`} aria-label={`Ir para ${Other.label}`} className="grid size-10 shrink-0 place-items-center rounded-2xl text-muted transition hover:bg-surface-2 hover:text-fg">
          <Other.icon className="size-[18px]" />
        </Link>
        <div className="mx-0.5 h-6 w-px bg-border" />
        <div className="no-scrollbar flex max-w-[calc(100vw-190px)] items-center gap-0.5 overflow-x-auto">
          {items.map((i) => {
            const active = isActive(pathname, i.href, escopo);
            return (
              <Link
                key={i.href}
                href={i.href}
                aria-label={i.label}
                title={i.label}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-2xl px-3 text-[13px] font-medium transition",
                  active ? "border border-border-strong bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <i.icon className="size-[18px]" />
                {active && <span className="hidden sm:inline">{i.label}</span>}
              </Link>
            );
          })}
        </div>
        <div className="mx-1 h-6 w-px bg-border" />
        <AllApps pathname={pathname} onOpen={() => setDialOpen(false)} />
        <SpeedDial open={dialOpen} onQuickAdd={onQuick} onOpenChange={setDialOpen} scope={space} />
      </nav>
    </div>
  );
}

function AllApps({ pathname, onOpen }: { pathname: string; onOpen: () => void }) {
  const [open, setOpen] = React.useState(false);
  const { escopo } = useSpace();
  return (
    <Popover.Root open={open} onOpenChange={(value) => { setOpen(value); if (value) onOpen(); }}>
      <Popover.Trigger className="grid size-10 place-items-center rounded-2xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Todos os módulos">
        <LayoutGrid className="size-[18px]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={14} className="z-50 max-h-[70vh] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-3 shadow-soft animate-in">
          {[...SPACES.pessoal.sections.map((s) => ({ ...s, label: `Pessoal · ${s.label}` })), ...SPACES.empresa.sections.map((s) => ({ ...s, label: `Empresa · ${s.label}` })), { label: "Geral", items: SHARED }].map((s) => (
            <div key={s.label} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{s.label}</div>
              <div className="grid grid-cols-3 gap-1">
                {s.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-[12px] transition", isActive(pathname, i.href, escopo) ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
                  >
                    <i.icon className="size-5" />
                    {i.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link href="/config" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-xl px-2 py-2 text-[12.5px] text-muted hover:bg-surface-2 hover:text-fg">
            <Settings className="size-4" /> Configurações
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Notifications({ items, read, unread, open, onOpenChange, onRead, onRefresh, error, checkedAt, light }: { items: ShellNotification[]; read: string[]; unread: number; open: boolean; onOpenChange: (value: boolean) => void; onRead: (ids: string[]) => void; onRefresh: () => Promise<void>; error: boolean; checkedAt: string | null; light: boolean }) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className={cn("relative grid size-9 place-items-center rounded-xl border transition", light ? "glass border-white/10 text-white/85 hover:text-white" : "border-border bg-surface-2 text-muted hover:text-fg")}
        aria-label={`Notificações${unread ? `, ${unread} não lidas` : ""}`}
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-warning px-1 text-[10.5px] font-bold text-black">{unread > 99 ? "99+" : unread}</span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(92vw,360px)] rounded-2xl border border-border-strong bg-surface p-2 shadow-soft animate-in">
          <div className="flex items-center gap-2 px-2 pb-2 pt-1 text-[13px] font-semibold">Notificações
            <button onClick={() => void onRefresh()} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Atualizar notificações"><RefreshCw className="size-3.5" /></button>
            {unread > 0 && <button onClick={() => onRead(items.map((n) => n.id))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Marcar todas como lidas"><CheckCheck className="size-4" /></button>}
          </div>
          {error && <p role="status" className="px-2 pb-2 text-xs text-warning">Não foi possível atualizar. Tente novamente.</p>}
          {items.length === 0 ? (
            <p className="px-2 pb-3 text-[13px] text-muted">{error ? "Avisos indisponíveis no momento." : checkedAt ? "Tudo em dia. 🎉" : "Consultando seus avisos…"}</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <Link key={n.id} href={n.href} onClick={() => { onRead([n.id]); onOpenChange(false); }} className={cn("flex gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-2", read.includes(n.id) && "opacity-60")}>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.tone === "danger" ? "bg-danger" : n.tone === "warning" ? "bg-warning" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{n.title}</span>
                    {n.detail && <span className="block truncate text-[12px] text-muted">{n.detail}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <p className="border-t border-border px-2 pt-2 text-[10.5px] text-faint">{checkedAt ? `Atualizado às ${new Date(checkedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · atualização automática` : "Verificando avisos…"}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function UserMenu({ name, avatar, light }: { name: string; avatar?: string | null; light: boolean }) {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  return (
    <Menu>
      <MenuTrigger className={cn("rounded-full ring-1 transition", light ? "ring-white/20" : "ring-border")} aria-label="Conta">
        <Avatar name={name} src={avatar} />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{name}</MenuLabel>
        <MenuItem onSelect={() => router.push("/config")}><Settings /> Configurações</MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => setTheme("dark")}><Moon /> Escuro {theme === "dark" && "✓"}</MenuItem>
        <MenuItem onSelect={() => setTheme("light")}><Sun /> Claro {theme === "light" && "✓"}</MenuItem>
        <MenuItem onSelect={() => setTheme("system")}><Monitor /> Sistema {theme === "system" && "✓"}</MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => logout()} danger><LogOut /> Sair</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name} className={cn("size-8 shrink-0 rounded-full object-cover", className)} />;
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-[12px] font-bold text-white", className)}>
      {initials}
    </span>
  );
}
