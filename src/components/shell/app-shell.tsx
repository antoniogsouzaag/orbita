"use client";

import { Bell, LayoutGrid, LogOut, Monitor, Moon, PanelLeft, Plus, Search, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { Popover } from "radix-ui";
import * as React from "react";
import { logout } from "@/app/actions/auth";
import { Kbd } from "@/components/ui/misc";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { ALL_NAV, NAV, SETTINGS_ITEM, isActive } from "./nav";
import { QuickAdd } from "./quick-add";
import { SpeedDial } from "./speed-dial";

export type ShellNotification = { id: string; title: string; detail?: string; href: string; tone?: "danger" | "warning" | "info" };

type Ctx = { openPalette: () => void; openQuickAdd: (tab?: string) => void };
const ShellContext = React.createContext<Ctx>({ openPalette: () => {}, openQuickAdd: () => {} });
export const useShell = () => React.useContext(ShellContext);

export function AppShell({
  children,
  name,
  notifications,
  projects,
}: {
  children: React.ReactNode;
  name: string;
  notifications: ShellNotification[];
  projects: { id: string; name: string; color: string }[];
}) {
  const pathname = usePathname();
  const [sidebar, setSidebar] = React.useState(false);
  const [palette, setPalette] = React.useState(false);
  const [quick, setQuick] = React.useState<{ open: boolean; tab?: string }>({ open: false });
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    try {
      setSidebar(localStorage.getItem("orbita:sidebar") === "1");
    } catch {}
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
    setSidebar((v) => {
      try {
        localStorage.setItem("orbita:sidebar", v ? "0" : "1");
      } catch {}
      return !v;
    });
  };

  const ctx = React.useMemo<Ctx>(() => ({ openPalette: () => setPalette(true), openQuickAdd: (tab) => setQuick({ open: true, tab }) }), []);
  const isHome = pathname === "/";

  return (
    <ShellContext.Provider value={ctx}>
      <div className={cn("min-h-dvh", sidebar && "lg:pl-[268px]")}>
        {sidebar && <Sidebar pathname={pathname} name={name} onCollapse={toggleSidebar} notifications={notifications.length} onSearch={ctx.openPalette} onQuick={() => ctx.openQuickAdd("tarefa")} />}

        <header
          className={cn(
            "fixed inset-x-0 top-0 z-40 transition-[background,border,backdrop-filter] duration-300",
            sidebar && "lg:left-[268px]",
            scrolled || !isHome ? "glass border-b border-border/60" : "border-b border-transparent",
          )}
        >
          <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-2 px-4 sm:px-6">
            {!sidebar && (
              <Link href="/" className={cn("flex items-center gap-2", isHome && !scrolled ? "text-white" : "text-fg")} aria-label="Início">
                <Logo className="size-7" />
                <span className="hidden text-[15px] font-semibold tracking-tight sm:inline">Órbita</span>
              </Link>
            )}
            <button onClick={toggleSidebar} className={cn("hidden rounded-lg p-1.5 transition hover:bg-white/10 lg:block", isHome && !scrolled ? "text-white/70 hover:text-white" : "text-muted hover:text-fg")} aria-label="Alternar barra lateral">
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
              <Notifications items={notifications} light={isHome && !scrolled} />
              <UserMenu name={name} light={isHome && !scrolled} />
            </div>
          </div>
        </header>

        <main className={cn("pb-32", !isHome && "pt-20")}>{children}</main>

        <Dock pathname={pathname} hidden={sidebar} onQuick={(tab) => ctx.openQuickAdd(tab)} />
        <CommandPalette open={palette} onOpenChange={setPalette} onQuickAdd={ctx.openQuickAdd} />
        <QuickAdd open={quick.open} tab={quick.tab} projects={projects} onOpenChange={(open) => setQuick((q) => ({ ...q, open }))} />
      </div>
    </ShellContext.Provider>
  );
}

function Sidebar({ pathname, name, onCollapse, notifications, onSearch, onQuick }: { pathname: string; name: string; onCollapse: () => void; notifications: number; onSearch: () => void; onQuick: () => void }) {
  return (
    <aside className="glass fixed inset-y-2 left-2 z-50 hidden w-[256px] flex-col overflow-hidden rounded-2xl border border-border shadow-soft lg:flex">
      <div className="flex items-center gap-2 px-4 pb-2 pt-4">
        <Logo className="size-6" />
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
        <div className="flex h-8 w-full items-center gap-2 rounded-lg px-3 text-[13px] text-muted">
          <Bell className="size-4" /> Notificações
          {notifications > 0 && <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-fg">{notifications}</span>}
        </div>
      </div>
      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV.map((s) => (
          <div key={s.label}>
            <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{s.label}</div>
            {s.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px] transition",
                  isActive(pathname, i.href) ? "bg-surface-3 font-medium text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <i.icon className="size-4" /> {i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <Link href={SETTINGS_ITEM.href} className={cn("flex h-8 items-center gap-2.5 rounded-lg px-3 text-[13px]", isActive(pathname, "/config") ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}>
          <Settings className="size-4" /> Configurações
        </Link>
        <div className="mt-2 flex items-center gap-2.5 px-2">
          <Avatar name={name} />
          <div className="min-w-0 text-[12.5px] font-medium">{name}</div>
        </div>
      </div>
    </aside>
  );
}

function Dock({ pathname, hidden, onQuick }: { pathname: string; hidden: boolean; onQuick: (tab: string) => void }) {
  const items = ALL_NAV.filter((i) => i.dock);
  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3", hidden && "lg:hidden")}>
      <nav className="glass pointer-events-auto flex items-center gap-1 rounded-[22px] border border-border p-1.5 shadow-soft">
        <div className="no-scrollbar flex max-w-[calc(100vw-140px)] items-center gap-0.5 overflow-x-auto">
          {items.map((i) => {
            const active = isActive(pathname, i.href);
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
        <AllApps pathname={pathname} />
        <SpeedDial onQuickAdd={onQuick} />
      </nav>
    </div>
  );
}

function AllApps({ pathname }: { pathname: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="grid size-10 place-items-center rounded-2xl text-muted hover:bg-surface-2 hover:text-fg" aria-label="Todos os módulos">
        <LayoutGrid className="size-[18px]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" sideOffset={14} className="z-50 w-[min(92vw,420px)] rounded-2xl border border-border-strong bg-surface p-3 shadow-soft animate-in">
          {NAV.map((s) => (
            <div key={s.label} className="mb-2 last:mb-0">
              <div className="px-1 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-faint">{s.label}</div>
              <div className="grid grid-cols-3 gap-1">
                {s.items.map((i) => (
                  <Link
                    key={i.href}
                    href={i.href}
                    onClick={() => setOpen(false)}
                    className={cn("flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-[12px] transition", isActive(pathname, i.href) ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
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

function Notifications({ items, light }: { items: ShellNotification[]; light: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger
        className={cn("relative grid size-9 place-items-center rounded-xl border transition", light ? "glass border-white/10 text-white/85 hover:text-white" : "border-border bg-surface-2 text-muted hover:text-fg")}
        aria-label="Notificações"
      >
        <Bell className="size-4" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-warning px-1 text-[10.5px] font-bold text-black">{items.length > 99 ? "99+" : items.length}</span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-50 w-[min(92vw,360px)] rounded-2xl border border-border-strong bg-surface p-2 shadow-soft animate-in">
          <div className="px-2 pb-2 pt-1 text-[13px] font-semibold">Notificações</div>
          {items.length === 0 ? (
            <p className="px-2 pb-3 text-[13px] text-muted">Tudo em dia. 🎉</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <Link key={n.id} href={n.href} className="flex gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-2">
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.tone === "danger" ? "bg-danger" : n.tone === "warning" ? "bg-warning" : "bg-accent")} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{n.title}</span>
                    {n.detail && <span className="block truncate text-[12px] text-muted">{n.detail}</span>}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function UserMenu({ name, light }: { name: string; light: boolean }) {
  const { setTheme, theme } = useTheme();
  return (
    <Menu>
      <MenuTrigger className={cn("rounded-full ring-1 transition", light ? "ring-white/20" : "ring-border")} aria-label="Conta">
        <Avatar name={name} />
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>{name}</MenuLabel>
        <MenuItem onSelect={() => (window.location.href = "/config")}><Settings /> Configurações</MenuItem>
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

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-[12px] font-bold text-white", className)}>
      {initials}
    </span>
  );
}
