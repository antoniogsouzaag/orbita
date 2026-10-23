"use client";

import { Command } from "cmdk";
import { CalendarPlus, CheckSquare, FileText, FolderKanban, Goal, LibraryBig, Moon, NotebookPen, PanelLeft, Plus, Sun, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { ALL_NAV, navigationHref, spaceOf } from "./nav";

type Result = { id: string; type: "tarefa" | "nota" | "projeto" | "meta" | "vault"; title: string; subtitle?: string; href: string };

const ICONS = { tarefa: CheckSquare, nota: NotebookPen, projeto: FolderKanban, meta: Goal, vault: LibraryBig };

export function CommandPalette({ open, onOpenChange, onQuickAdd, scope, onToggleSidebar }: { open: boolean; onOpenChange: (v: boolean) => void; onQuickAdd: (tab?: string) => void; scope: "pessoal" | "empresa"; onToggleSidebar: () => void }) {
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [q, setQ] = React.useState("");
  const [resultSet, setResultSet] = React.useState<{ query: string; items: Result[] }>({ query: "", items: [] });
  const results = q.trim().length >= 2 && resultSet.query === q ? resultSet.items : [];
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || q.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&escopo=${scope}`, { signal: ctrl.signal });
        if (res.ok && !ctrl.signal.aborted) setResultSet({ query: q, items: (await res.json()).results });
      } catch {}
      if (!ctrl.signal.aborted) setLoading(false);
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, scope, open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const run = (fn: () => void) => {
    onOpenChange(false);
    setTimeout(fn, 60);
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[12vh] z-[61] w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border-strong bg-surface shadow-soft animate-in">
          <D.Title className="sr-only">Buscar</D.Title>
          <D.Description className="sr-only">Busque tarefas, notas, projetos, metas e notas do vault</D.Description>
          <Command shouldFilter={true} loop className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-faint">
            <Command.Input
              value={q}
              onValueChange={setQ}
              autoFocus
              placeholder="Buscar ou digitar um comando…"
              className="h-14 w-full border-b border-border bg-transparent px-5 text-[15px] outline-none placeholder:text-faint"
            />
            <Command.List className="max-h-[56vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[13px] text-muted">{loading ? "Buscando…" : "Nada encontrado."}</Command.Empty>
              {results.length > 0 && (
                <Command.Group heading="Resultados">
                  {results.map((r) => {
                    const Icon = ICONS[r.type] ?? FileText;
                    return (
                      <Item key={`${r.type}-${r.id}`} value={`${r.title} ${r.subtitle ?? ""} ${r.type} ${q}`} onSelect={() => go(r.href)}>
                        <Icon />
                        <span className="truncate">{r.title}</span>
                        <span className="ml-auto shrink-0 text-[11.5px] text-faint">{r.subtitle ?? r.type}</span>
                      </Item>
                    );
                  })}
                </Command.Group>
              )}
              <Command.Group heading="Ações">
                <Item value="nova tarefa adicionar" onSelect={() => run(() => onQuickAdd("tarefa"))}><Plus /> Nova tarefa {scope === "empresa" ? "da empresa" : "pessoal"}</Item>
                {scope === "pessoal" && <>
                  <Item value="nova nota" onSelect={() => run(() => onQuickAdd("nota"))}><NotebookPen /> Nova nota</Item>
                  <Item value="novo evento compromisso agenda" onSelect={() => run(() => onQuickAdd("evento"))}><CalendarPlus /> Novo compromisso</Item>
                  <Item value="novo lançamento gasto receita finanças" onSelect={() => run(() => onQuickAdd("financas"))}><Wallet /> Novo lançamento</Item>
                </>}
                <Item value="alternar barra lateral sidebar menu navegação" onSelect={() => run(onToggleSidebar)}><PanelLeft /> Alternar barra lateral <span className="ml-auto text-[12px] text-faint">&apos;</span></Item>
                <Item value="alternar tema escuro claro" onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
                  {resolvedTheme === "dark" ? <Sun /> : <Moon />} Alternar tema
                </Item>
              </Command.Group>
              <Command.Group heading="Ir para">
                {ALL_NAV.map((n) => {
                  const [path, query] = navigationHref(n.href, scope).split("?");
                  const targetScope = spaceOf(path, new URLSearchParams(query).get("escopo"));
                  return <Item key={n.href} value={`ir ${n.label} ${n.keywords ?? ""} ${targetScope ?? ""} ${n.href}`} onSelect={() => go(navigationHref(n.href, scope))}>
                    <n.icon /> {n.label}
                    {targetScope && <span className="ml-auto text-[10.5px] text-faint">{targetScope === "empresa" ? "Empresa" : "Pessoal"}</span>}
                  </Item>;
                })}
              </Command.Group>
            </Command.List>
          </Command>
          <p className="flex justify-between border-t border-border px-4 py-2 text-[10.5px] text-faint"><span>Ctrl K · buscar</span><span>C · capturar</span><span>&apos; · barra lateral</span></p>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function Item({ children, onSelect, value }: { children: React.ReactNode; onSelect: () => void; value: string }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] text-fg data-[selected=true]:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted"
    >
      {children}
    </Command.Item>
  );
}
