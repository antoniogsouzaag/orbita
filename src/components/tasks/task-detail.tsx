"use client";
import { confirmAction } from "@/components/ui/confirm-action";

import { PencilLine, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { toast } from "sonner";
import { createTask, deleteTask, toggleTask, updateTask } from "@/app/actions/core";
import { MarkdownView } from "@/components/markdown/view";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CheckButton, Segmented } from "@/components/ui/misc";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/utils";
import { OWNER_NAME, assigneeLabel } from "@/lib/task-assignee";
import { AssigneeBadge } from "./assignee-badge";
import { taskHref } from "@/lib/task-scope";
import type { TaskRow } from "@/server/tasks";

export type TaskDetailData = TaskRow & { children: Task[] };

export function TaskDetail({ task, projects, assignees = [OWNER_NAME], onClose }: { task: TaskDetailData; projects: { id: string; name: string; color: string }[]; assignees?: string[]; onClose: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(task.title);
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const [tags, setTags] = React.useState(task.tags.join(", "));
  const [assignee, setAssignee] = React.useState(task.assignee ?? "");
  const listId = React.useId();
  const [sub, setSub] = React.useState("");
  const [, start] = React.useTransition();

  const patch = (p: Parameters<typeof updateTask>[1]) => start(async () => {
    try { await updateTask(task.id, p); }
    catch { toast.error("Não foi possível salvar. Confira o espaço e o projeto da tarefa."); }
  });

  if (!editing) return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent title={task.title} description="Visualização da tarefa" wide>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>{task.status === "done" ? "Concluída" : task.status === "doing" ? "Em andamento" : "A fazer"}</span>
          {task.project && <span>· {task.project.name}</span>}
          {task.dueDate && <span>· {task.dueDate.split("-").reverse().join("/")}{task.dueTime && ` às ${task.dueTime}`}</span>}
          {task.assignee && <AssigneeBadge task={task} />}
        </div>
        {task.tags.length > 0 && <div className="mb-4 flex max-h-24 flex-wrap gap-1 overflow-y-auto text-xs text-accent">{task.tags.map(tag => <span key={tag} className="max-w-full break-all rounded bg-surface-2 px-2 py-1">#{tag}</span>)}</div>}
        <div className="break-words">{task.notes ? <MarkdownView content={task.notes} /> : <p className="text-sm text-muted">Sem notas nesta tarefa.</p>}</div>
        {task.children.length > 0 && <div className="mt-5 space-y-2"><h3 className="text-sm font-medium">Subtarefas</h3>{task.children.map(child => <div key={child.id} className="flex items-center gap-2"><CheckButton checked={child.status === "done"} label="Concluir subtarefa" onToggle={() => start(() => toggleTask(child.id))} /><span className={cn("text-sm", child.status === "done" && "line-through text-muted")}>{child.title}</span></div>)}</div>}
        <div className="mt-5 flex gap-2 border-t border-border pt-4">
          <Button size="sm" onClick={() => setEditing(true)}><PencilLine />Editar tarefa</Button>
          <Button size="sm" variant="ghost" onClick={() => start(() => toggleTask(task.id))}>{task.status === "done" ? "Reabrir" : "Concluir"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px] animate-in" />
        <D.Content className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-lg flex-col border-l border-border-strong bg-surface shadow-soft animate-in focus:outline-none">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <CheckButton checked={task.status === "done"} label="Concluir" onToggle={() => start(() => toggleTask(task.id))} />
            <D.Title className="truncate text-[13px] text-muted">{assigneeLabel(task) ?? (task.status === "done" ? "Concluída" : task.status === "doing" ? "Em andamento" : "A fazer")}</D.Title>
            <D.Description className="sr-only">Detalhes da tarefa</D.Description>
            <button
              onClick={() =>
                start(async () => {
                  if (!await confirmAction("Excluir esta tarefa?")) return;
                  await deleteTask(task.id);
                  toast.success("Tarefa excluída");
                  onClose();
                })
              }
              className="ml-auto rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
              aria-label="Excluir"
            >
              <Trash2 className="size-4" />
            </button>
            <D.Close className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Fechar"><X className="size-4" /></D.Close>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && patch({ title })}
              className="w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Projeto">
                <Select value={task.projectId ?? ""} onChange={(e) => patch({ projectId: e.target.value || null })}>
                  <option value="">Sem projeto</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={task.status} onChange={(e) => patch({ status: e.target.value as Task["status"] })}>
                  <option value="todo">A fazer</option>
                  <option value="doing">Em andamento</option>
                  <option value="done">Concluída</option>
                </Select>
              </Field>
              <Field label="Data">
                <Input type="date" value={task.dueDate ?? ""} onChange={(e) => patch({ dueDate: e.target.value || null })} />
              </Field>
              <Field label="Hora">
                <Input type="time" value={task.dueTime ?? ""} onChange={(e) => patch({ dueTime: e.target.value || null })} />
              </Field>
            </div>
            <Field label="Onde">
              <Segmented
                value={task.scope}
                onChange={(v) => start(async () => {
                  try {
                    const scope = v as Task["scope"];
                    await updateTask(task.id, { scope });
                    toast.success(`Tarefa movida para ${scope === "empresa" ? "Empresa" : "Pessoal"}`, { description: "As subtarefas acompanham a tarefa principal." });
                    router.push(taskHref(scope, task.id));
                  } catch { toast.error("Não foi possível mover a tarefa."); }
                })}
                options={[{ value: "pessoal", label: "Pessoal" }, { value: "empresa", label: "Empresa" }]}
              />
            </Field>
            {!task.parentId && (
              <Field label="Responsável">
                <div className="flex gap-2">
                  <Input
                    list={listId}
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    onBlur={() => assignee.trim() !== (task.assignee ?? "") && patch({ assignee: assignee.trim() || null })}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    placeholder="Ninguém assumiu — escolha ou digite um nome"
                  />
                  {!task.assignee && task.status !== "done" && (
                    <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => { setAssignee(OWNER_NAME); patch({ assignee: OWNER_NAME, status: "doing" }); }}>Assumir</Button>
                  )}
                </div>
                <datalist id={listId}>{assignees.map((name) => <option key={name} value={name} />)}</datalist>
                {task.claimedAt && task.assignee && <p className="mt-1 text-[11px] text-faint">Assumida em {new Date(task.claimedAt).toLocaleString("pt-BR")}</p>}
              </Field>
            )}
            <Field label="Prioridade">
              <Segmented
                value={String(task.priority)}
                onChange={(v) => patch({ priority: Number(v) })}
                options={[{ value: "0", label: "Nenhuma" }, { value: "1", label: "Baixa" }, { value: "2", label: "Média" }, { value: "3", label: "Alta" }]}
              />
            </Field>
            <Field label="Tags (separadas por vírgula)">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} onBlur={() => patch({ tags: tags.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean) })} placeholder="empresa, financeiro" />
            </Field>
            <Field label="Notas">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (task.notes ?? "") && patch({ notes })} placeholder="Detalhes, links, contexto…" className="min-h-32" />
            </Field>
            <div>
              <div className="mb-2 text-xs font-medium text-muted">Subtarefas {task.children.length > 0 && `· ${task.children.filter((c) => c.status === "done").length}/${task.children.length}`}</div>
              <div className="space-y-1">
                {task.children.map((c) => (
                  <div key={c.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-2">
                    <CheckButton size="sm" checked={c.status === "done"} label="Concluir subtarefa" onToggle={() => start(() => toggleTask(c.id))} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className={cn("text-[13.5px]", c.status === "done" && "text-faint line-through")}>{c.title}</span>
                      {c.assignee && <AssigneeBadge task={c} className="mt-0.5 self-start" />}
                    </span>
                    <button onClick={() => start(() => deleteTask(c.id))} className="invisible rounded p-1 text-faint hover:text-danger group-hover:visible" aria-label="Remover"><X className="size-3.5" /></button>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!sub.trim()) return;
                  const t = sub;
                  setSub("");
                  start(async () => {
                    await createTask({ title: t, parentId: task.id, projectId: task.projectId, scope: task.scope });
                    router.refresh();
                  });
                }}
              >
                <Input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="+ Adicionar subtarefa" className="mt-1 h-9" />
              </form>
            </div>
          </div>
          <div className="border-t border-border px-5 py-3 text-[11.5px] text-faint">
            Criada em {new Date(task.createdAt).toLocaleString("pt-BR")}{task.completedAt && ` · concluída em ${new Date(task.completedAt).toLocaleString("pt-BR")}`}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function NewTaskButton({ projectId, scope = "pessoal" }: { projectId?: string; scope?: "pessoal" | "empresa" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, start] = React.useTransition();
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() =>
        start(async () => {
          try {
            const id = await createTask({ title: "Nova tarefa", projectId: projectId ?? null, scope });
            const query = new URLSearchParams(params.toString());
            query.set("task", id);
            query.delete("modo");
            if (scope === "empresa") query.set("escopo", "empresa"); else query.delete("escopo");
            router.push(`?${query}`);
          } catch { toast.error("Não foi possível criar a tarefa."); }
        })
      }
    >
      + Nova tarefa
    </Button>
  );
}
