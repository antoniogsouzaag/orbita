"use client";

import { FolderKanban, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Progress } from "@/components/ui/misc";
import type { Project, TaskScope } from "@/db/schema";
import { AREA_LABEL } from "@/lib/utils";
import type { ProjectWithCounts } from "@/server/projects";
import { ProjectDialog } from "./project-dialog";

export function ProjectsGrid({ projects, scope }: { projects: ProjectWithCounts[]; scope: TaskScope }) {
  const [editing, setEditing] = React.useState<Project | null>(null);
  const params = useSearchParams();
  const [open, setOpen] = React.useState(params.get("novo") === "1");
  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);
  const card = (p: ProjectWithCounts) => {
    const total = p.open + p.done;
    return (
      <Card key={p.id} className="group relative p-5 transition hover:border-border-strong">
        <Link href={`/projetos/${p.id}${scope === "empresa" ? "?escopo=empresa" : ""}`} className="absolute inset-0" aria-label={p.name} />
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl" style={{ background: `color-mix(in oklab, ${p.color} 18%, transparent)`, color: p.color }}><FolderKanban className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{p.name}</div>
            <div className="text-[12px] text-faint">{AREA_LABEL[p.area]}</div>
          </div>
          <button onClick={() => { setEditing(p); setOpen(true); }} className="relative z-10 rounded-lg p-1.5 text-faint opacity-0 transition hover:bg-surface-2 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Editar"><Pencil className="size-3.5" /></button>
        </div>
        {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-muted">{p.description}</p>}
        <div className="mt-4 flex justify-between text-[12px] text-muted"><span>{p.open} abertas</span><span>{total ? Math.round((p.done / total) * 100) : 0}%</span></div>
        <Progress value={total ? (p.done / total) * 100 : 0} color={p.color} className="mt-1.5" />
      </Card>
    );
  };
  return (
    <>
      <div className="mb-4 flex justify-end"><Button variant="primary" size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus /> Novo projeto</Button></div>
      {active.length === 0 ? (
        <Card><EmptyState icon={<FolderKanban />} title="Nenhum projeto" description="Agrupe tarefas por projeto: faculdade, produtos, casa…" /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{active.map(card)}</div>
      )}
      {archived.length > 0 && (
        <>
          <div className="mb-3 mt-8 text-[12px] font-semibold uppercase tracking-wider text-faint">Arquivados</div>
          <div className="grid gap-4 opacity-60 sm:grid-cols-2 lg:grid-cols-3">{archived.map(card)}</div>
        </>
      )}
      {open && <ProjectDialog open={open} onOpenChange={setOpen} project={editing} scope={scope} />}
    </>
  );
}

export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Pencil /> Editar</Button>
      {open && <ProjectDialog open={open} onOpenChange={setOpen} project={project} />}
    </>
  );
}
