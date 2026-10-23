"use client";

import { AlertTriangle, ArrowUpRight, Eye, FileSearch, FilePlus2, Hash, Link2, ListTree, Network, PanelLeft, PencilLine, RefreshCw, Save, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { createVaultNote, refreshVault, saveVaultFile } from "@/app/actions/vault";
import { MarkdownEditor } from "@/components/markdown/editor";
import { MarkdownView, slugHeading } from "@/components/markdown/view";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { createResolver } from "@/lib/wikilinks";
import type { TreeNode } from "@/server/vault";
import { VaultTree } from "./vault-tree";

export type VaultFileView = {
  path: string;
  sha: string;
  kind: "md" | "image" | "text" | "binary";
  content: string | null;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
  headings: string[];
  tags: string[];
  links: { path: string; title: string }[];
  unresolved: string[];
  backlinks: { path: string; title: string; snippet: string }[];
  webUrl: string | null;
};

export function VaultPage({
  tree,
  file,
  mdPaths,
  folders,
  source,
  stats,
  defaultFolder,
}: {
  tree: TreeNode[];
  file: VaultFileView | null;
  mdPaths: string[];
  folders: string[];
  source: string;
  stats: { notes: number; files: number; links: number };
  defaultFolder: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = React.useState("");
  const [mode, setMode] = React.useState<"view" | "edit">("view");
  const [draft, setDraft] = React.useState(file?.content ?? "");
  const [sha, setSha] = React.useState(file?.sha ?? null);
  const [saving, startSave] = React.useTransition();
  const [creating, setCreating] = React.useState(false);
  const [treeOpen, setTreeOpen] = React.useState(false);
  const dirty = file ? draft !== file.content : false;

  React.useEffect(() => {
    setDraft(file?.content ?? "");
    setSha(file?.sha ?? null);
    setMode("view");
    setTreeOpen(false);
  }, [file?.path, file?.sha]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const resolver = React.useMemo(() => createResolver(mdPaths), [mdPaths]);
  const resolve = (target: string, heading?: string) => {
    const p = resolver(target);
    return p ? `/vault?p=${encodeURIComponent(p)}${heading ? `#${slugHeading(heading)}` : ""}` : null;
  };
  const allPaths = React.useMemo(() => new Set(flatten(tree)), [tree]);
  const embedUrl = (target: string) => {
    const exact = [...allPaths].find((p) => p === target || p.endsWith(`/${target}`));
    return exact ? `/api/vault/raw?p=${encodeURIComponent(exact)}` : null;
  };
  const titles = React.useMemo(() => mdPaths.map((p) => p.split("/").pop()!.replace(/\.md$/i, "")), [mdPaths]);

  const save = () => {
    if (!file || !dirty) return;
    startSave(async () => {
      try {
        const r = await saveVaultFile(file.path, draft, sha);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setSha(r.sha);
        setDraft(r.content);
        toast.success("Salvo e enviado ao GitHub");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao salvar");
      }
    });
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex gap-1.5 p-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar arquivos" className="h-8 pl-8 text-[12.5px]" />
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => setCreating(true)} aria-label="Nova nota"><FilePlus2 /></Button>
        <Button size="icon-sm" variant="ghost" asChild><Link href="/vault/revisao" aria-label="Revisar estrutura do vault"><FileSearch /></Link></Button>
        <Button size="icon-sm" variant="ghost" asChild><Link href="/vault/grafo" aria-label="Grafo"><Network /></Link></Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3"><VaultTree nodes={tree} current={file?.path ?? null} filter={filter} /></div>
      <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-[11px] text-faint">
        <span className="truncate" title={source}>{source}</span>
        <button onClick={() => startSave(async () => { await refreshVault(); toast.success("Vault atualizado"); })} className="ml-auto rounded p-1 hover:text-fg" aria-label="Recarregar"><RefreshCw className={cn("size-3.5", saving && "animate-spin")} /></button>
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_260px]">
      <Card className="hidden overflow-hidden lg:block lg:h-[calc(100dvh-110px)] lg:sticky lg:top-[72px]">{sidebar}</Card>
      {treeOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 lg:hidden" onClick={() => setTreeOpen(false)}>
          <div className="h-full w-[85vw] max-w-xs border-r border-border bg-surface" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}

      <div className="min-w-0">
        {!file ? (
          <Card className="p-6">
            <Button size="sm" variant="secondary" className="mb-4 lg:hidden" onClick={() => setTreeOpen(true)}><PanelLeft /> Arquivos</Button>
            <EmptyState icon={<ListTree />} title="Vault da AG LABS" description={`${stats.notes} notas · ${stats.links} links entre notas. Escolha uma nota à esquerda, busque com Ctrl+K ou abra o grafo.`} action={<Button size="sm" asChild><Link href={`/vault?p=${encodeURIComponent(mdPaths.find((p) => /in[ií]cio/i.test(p)) ?? mdPaths[0] ?? "")}`}>Abrir nota inicial</Link></Button>} />
          </Card>
        ) : (
          <Card className="min-h-[70vh]">
            <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 rounded-t-[18px] border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur">
              <Button size="icon-sm" variant="ghost" className="lg:hidden" onClick={() => setTreeOpen(true)} aria-label="Arquivos"><PanelLeft /></Button>
              <div className="min-w-0 flex-1 truncate text-[12px] text-faint">{file.path.split("/").slice(0, -1).join(" / ") || "raiz"}</div>
              {dirty && <span className="text-[12px] text-warning">não salvo</span>}
              {file.kind === "md" || file.kind === "text" ? (
                <>
                  <Segmented value={mode} onChange={setMode} options={[{ value: "view", label: <span className="flex items-center gap-1"><Eye className="size-3.5" />Ler</span> }, { value: "edit", label: <span className="flex items-center gap-1"><PencilLine className="size-3.5" />Editar</span> }]} />
                  <Button size="sm" variant="primary" disabled={!dirty || saving} onClick={save}><Save /> {saving ? "Salvando…" : "Salvar"}</Button>
                </>
              ) : null}
              {file.webUrl && <Button size="icon-sm" variant="ghost" asChild><a href={file.webUrl} target="_blank" rel="noreferrer" aria-label="Abrir no GitHub"><ArrowUpRight /></a></Button>}
            </div>
            <div className="px-5 py-6 sm:px-10">
              {mode === "edit" && (file.kind === "md" || file.kind === "text") ? (
                <>
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/8 px-3 py-2 text-[12.5px] text-muted">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>O vault é a base canônica: registre só fatos confirmados. Tarefas, logs, métricas e segredos não entram — veja o <Link className="underline" href={`/vault?p=${encodeURIComponent(mdPaths.find((p) => /Guia de Contribui/.test(p)) ?? "")}`}>Guia de Contribuição</Link>. Ctrl+S salva e faz commit no GitHub.</span>
                  </div>
                  <MarkdownEditor value={draft} onChange={setDraft} onSave={save} linkTargets={titles} minHeight="65vh" />
                </>
              ) : file.kind === "md" ? (
                <>
                  <Properties fm={file.frontmatter} />
                  <MarkdownView content={file.body} resolve={resolve} embedUrl={embedUrl} />
                </>
              ) : file.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/vault/raw?p=${encodeURIComponent(file.path)}`} alt={file.title} className="mx-auto max-h-[70vh] rounded-xl" />
              ) : file.kind === "text" ? (
                <>
                  <h1 className="mb-4 text-xl font-semibold">{file.title}</h1>
                  {/\.html?$/i.test(file.path) && (
                    <iframe title="Prévia" sandbox="" srcDoc={file.content ?? ""} className="mb-4 h-[420px] w-full rounded-xl border border-border bg-white" />
                  )}
                  <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-[12.5px] leading-relaxed">{file.content}</pre>
                </>
              ) : (
                <EmptyState title="Arquivo binário" description="Sem prévia para este tipo de arquivo." action={<Button size="sm" asChild><a href={`/api/vault/raw?p=${encodeURIComponent(file.path)}`}>Baixar</a></Button>} />
              )}
            </div>
          </Card>
        )}
      </div>

      {file?.kind === "md" && (
        <aside className="hidden space-y-4 xl:block">
          <div className="sticky top-[72px] space-y-4">
            {file.headings.length > 1 && (
              <Card className="p-4">
                <SideTitle icon={<ListTree />}>Sumário</SideTitle>
                <div className="space-y-1">{file.headings.slice(0, 30).map((h, i) => <a key={i} href={`#${slugHeading(h)}`} className="block truncate text-[12.5px] text-muted hover:text-fg">{h}</a>)}</div>
              </Card>
            )}
            <Card className="p-4">
              <SideTitle icon={<Link2 />}>Backlinks · {file.backlinks.length}</SideTitle>
              {file.backlinks.length === 0 && <p className="text-[12px] text-faint">Nenhuma nota aponta para esta.</p>}
              <div className="space-y-2">
                {file.backlinks.map((b) => (
                  <Link key={b.path} href={`/vault?p=${encodeURIComponent(b.path)}`} className="block rounded-lg p-1.5 hover:bg-surface-2">
                    <div className="truncate text-[12.5px] text-fg">{b.title}</div>
                    {b.snippet && <div className="line-clamp-2 text-[11.5px] text-faint">{b.snippet}</div>}
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="p-4">
              <SideTitle icon={<ArrowUpRight />}>Links de saída · {file.links.length}</SideTitle>
              <div className="space-y-1">
                {file.links.map((l) => <Link key={l.path} href={`/vault?p=${encodeURIComponent(l.path)}`} className="block truncate text-[12.5px] text-muted hover:text-fg">{l.title}</Link>)}
                {file.unresolved.map((u) => <div key={u} className="truncate text-[12.5px] text-faint line-through" title="Nota inexistente">{u}</div>)}
              </div>
            </Card>
            {file.tags.length > 0 && (
              <Card className="p-4">
                <SideTitle icon={<Hash />}>Tags</SideTitle>
                <div className="flex flex-wrap gap-1">{file.tags.map((t) => <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-muted">#{t}</span>)}</div>
              </Card>
            )}
          </div>
        </aside>
      )}

      <NewNoteDialog open={creating} onOpenChange={setCreating} folders={folders} defaultFolder={file ? file.path.split("/").slice(0, -1).join("/") : defaultFolder} />
    </div>
  );
}

function flatten(nodes: TreeNode[]): string[] {
  return nodes.flatMap((n) => (n.type === "file" ? [n.path] : flatten(n.children ?? [])));
}

function SideTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-faint [&_svg]:size-3.5">{icon}{children}</div>;
}

function Properties({ fm }: { fm: Record<string, unknown> }) {
  const entries = Object.entries(fm).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length));
  if (!entries.length) return null;
  return (
    <div className="mb-6 grid grid-cols-[minmax(90px,auto)_1fr] gap-x-4 gap-y-1.5 rounded-xl border border-border bg-surface-2/60 p-3 text-[12.5px]">
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <span className="text-faint">{k}</span>
          <span className="min-w-0 break-words text-muted">{Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function NewNoteDialog({ open, onOpenChange, folders, defaultFolder }: { open: boolean; onOpenChange: (v: boolean) => void; folders: string[]; defaultFolder: string }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [folder, setFolder] = React.useState(defaultFolder);
  const [pending, start] = React.useTransition();
  React.useEffect(() => {
    if (open) {
      setFolder(defaultFolder);
      setName("");
    }
  }, [open, defaultFolder]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Nova nota no vault" description="Cria o arquivo com frontmatter padrão e faz commit.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createVaultNote(folder, name);
              if (!r.ok) return void toast.error(r.error);
              toast.success("Nota criada");
              onOpenChange(false);
              router.push(`/vault?p=${encodeURIComponent(r.path)}`);
            });
          }}
          className="space-y-3"
        >
          <Field label="Pasta">
            <Select value={folder} onChange={(e) => setFolder(e.target.value)}>
              <option value="">(raiz)</option>
              {[...new Set([defaultFolder, ...folders])].filter(Boolean).map((f) => <option key={f} value={f}>{f}</option>)}
            </Select>
          </Field>
          <Field label="Nome"><Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="Agente - Nova" /></Field>
          <div className="flex justify-end"><Button variant="primary" disabled={pending}>Criar</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
