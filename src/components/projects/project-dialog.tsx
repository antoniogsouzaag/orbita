"use client";
import { confirmAction } from "@/components/ui/confirm-action";

import * as React from "react";
import { toast } from "sonner";
import { deleteProject, saveProject } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { AREAS, type Project, type TaskScope } from "@/db/schema";
import { projectScope } from "@/lib/task-scope";
import { AREA_LABEL } from "@/lib/utils";

export function ProjectDialog({ open, onOpenChange, project, scope = projectScope(project?.area ?? "pessoal") }: { open: boolean; onOpenChange: (v: boolean) => void; project?: Project | null; scope?: TaskScope }) {
  const [form, setForm] = React.useState({ name: project?.name ?? "", description: project?.description ?? "", color: project?.color ?? "#3b82f6", area: project?.area ?? scope, archived: project?.archived ?? false });
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={project ? "Editar projeto" : "Novo projeto"}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                await saveProject(project?.id ?? null, form);
                toast.success(project ? "Projeto atualizado" : "Projeto criado");
                onOpenChange(false);
              } catch { toast.error("Não foi possível salvar o projeto."); }
            });
          }}
          className="space-y-4"
        >
          <Field label="Nome"><Input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Faculdade, Barberias, Casa" /></Field>
          <Field label="Área">
            <Select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value as Project["area"] })}>
              {AREAS.filter((a) => projectScope(a) === scope).map((a) => <option key={a} value={a}>{AREA_LABEL[a]}</option>)}
            </Select>
          </Field>
          <Field label="Cor"><ColorPicker value={form.color} onChange={(color) => setForm({ ...form, color })} /></Field>
          <Field label="Descrição"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-16" /></Field>
          {project && (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              <input type="checkbox" checked={form.archived} onChange={(e) => setForm({ ...form, archived: e.target.checked })} className="accent-[var(--accent)]" /> Arquivado
            </label>
          )}
          <div className="flex items-center gap-2">
            {project && (
              <Button type="button" variant="danger" onClick={() => start(async () => { if (!await confirmAction("Excluir o projeto? As tarefas ficam sem projeto.")) return; await deleteProject(project.id); onOpenChange(false); })}>Excluir</Button>
            )}
            <Button variant="primary" className="ml-auto" disabled={pending}>Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
