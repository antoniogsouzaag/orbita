"use client";

import { ArrowUpRight, CircleAlert, GitPullRequest, Lightbulb, Loader2, FolderGit2, RefreshCw, Search } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { refreshGithubInboxAction } from "@/app/actions/integrations";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { GithubInbox as Inbox } from "@/server/github-inbox";

export function GithubInbox({ initial }: { initial: Inbox }) {
  const [data, setData] = React.useState(initial);
  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState("all");
  const [repo, setRepo] = React.useState("all");
  const repositories = [...new Set(data.items.map((item) => item.repo))].sort();
  const [pending, start] = React.useTransition();
  const items = data.items.filter((item) => (repo === "all" || item.repo === repo) && `${item.title} ${item.repo} ${item.author} #${item.number}`.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) && (kind === "all" || kind === "proposta" && item.kind === "proposta" || kind === "draft" && item.kind === "pr" && item.draft || kind === "pr" && item.kind === "pr" && !item.draft));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "PRs para revisar", value: data.items.filter((item) => item.kind === "pr" && !item.draft).length },
          { label: "Rascunhos", value: data.items.filter((item) => item.kind === "pr" && item.draft).length },
          { label: "Propostas abertas", value: data.items.filter((item) => item.kind === "proposta").length },
        ].map((stat) => <Card key={stat.label} className="!rounded-2xl p-3 sm:p-4"><p className="text-[11px] text-muted">{stat.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{data.error || !data.configured ? "—" : stat.value}</p></Card>)}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Repositórios">
        <button type="button" aria-pressed={repo === "all"} onClick={() => setRepo("all")} className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${repo === "all" ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface-2"}`}>Todos · {data.items.length}</button>
        {repositories.map((name) => <button key={name} type="button" aria-pressed={repo === name} onClick={() => setRepo(name)} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${repo === name ? "border-accent/30 bg-accent/10 text-accent" : "border-border text-muted hover:bg-surface-2"}`}><FolderGit2 className="size-3" />{name}<span className="text-faint">{data.items.filter((item) => item.repo === name).length}</span></button>)}
      </div>
      <Card className="overflow-hidden !rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-0 flex-1 basis-56"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-faint" /><Input aria-label="Buscar PRs por título, repositório ou autor" className="h-9 pl-9" placeholder="Buscar título, repositório, autor…" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select aria-label="Filtrar tipo de pendência" value={kind} onChange={(event) => setKind(event.target.value)} className="h-9 rounded-xl border border-border bg-surface px-3 text-[12px] text-fg"><option value="all">Todas as pendências</option><option value="pr">PRs para revisar</option><option value="draft">Rascunhos</option><option value="proposta">Propostas</option></select>
          <Button size="sm" className="h-9" disabled={pending || !data.configured} onClick={() => start(async () => {
            try { setData(await refreshGithubInboxAction()); } catch { toast.error("Não foi possível atualizar o GitHub."); }
          })}>{pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}Atualizar</Button>
        </div>
        {data.error ? <EmptyState icon={<CircleAlert />} title="A consulta ao GitHub falhou" description={data.error} /> : !data.configured ? <EmptyState icon={<GitPullRequest />} title="Conecte o GitHub" description="Configure GITHUB_INBOX_TOKEN ou um acesso já existente no servidor. Nenhum token é exibido no navegador." /> : !items.length ? <EmptyState icon={<GitPullRequest />} title={query || kind !== "all" ? "Nenhum resultado neste filtro" : "Nenhuma pendência visível"} description="Confira a cobertura do token antes de considerar a revisão de toda a organização concluída." /> : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span className="mt-0.5 rounded-lg bg-surface-2 p-2 text-muted">{item.kind === "pr" ? <GitPullRequest className="size-4" /> : <Lightbulb className="size-4" />}</span>
                  <div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-snug">{item.title}</p><div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint"><span>{item.repo} #{item.number}</span><span>{item.author}</span><span>Atualizado {new Date(item.updatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span><span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-muted">{item.kind === "proposta" ? "Proposta" : item.draft ? "Rascunho" : "PR aberto"}</span></div></div>
                  <ArrowUpRight className="mt-1 size-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-faint"><span>{items.length} exibidos · {data.items.length} carregados de {data.total} resultados{data.truncated ? " · consulta parcial" : ""}</span><span>{data.checkedAt ? `Consultado ${new Date(data.checkedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "Ainda não consultado"}</span></div>
      </Card>
      <details className="rounded-xl border border-border/70 px-4 py-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium">Cobertura e permissões da consulta</summary>
        <p className="mt-3 leading-relaxed">{data.warning}</p>
        <p className="mt-2 leading-relaxed">Acesso privado depende dos repositórios autorizados à credencial. Ajustes de conexão ficam em Integrações.</p>
      </details>
    </div>
  );
}
