"use client";

import { Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as D } from "radix-ui";
import * as React from "react";
import { toast } from "sonner";
import { createTask, deleteTask, toggleTask, updateTask } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { CheckButton, Segmented } from "@/components/ui/misc";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/server/tasks";

export type TaskDetailData = TaskRow & { children: Task[] };

export function TaskDetail({ task, projects, onClose }: { task: TaskDetailData; projects: { id: string; name: string; color: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = React.useState(task.title);
  const [notes, setNotes] = React.useState(task.notes ?? "");
  const [tags, setTags] = React.useState(task.tags.join(", "));
  const [sub, setSub] = React.useState("");
  const [, start] = React.useTransition();

  React.useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setTags(task.tags.join(", "));
  }, [task.id, task.title, task.notes, task.tags]);

  const patch = (p: Parameters<typeof updateTask>[1]) => start(() => updateTask(task.id, p));

  return (
    <D.Root open onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <D.Content className="fixed inset-y-0 right-0 z-[61] flex w-full max-w-lg flex-col border-l border-border-strong bg-surface shadow-soft animate-in focus:outline-none">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <CheckButton checked={task.status === "done"} label="Concluir" onToggle={() => start(() => toggleTask(task.id))} />
            <D.Title className="text-[13px] text-muted">{task.status === "done" ? "Concluída" : task.status === "doing" ? "Em andamento" : "A fazer"}</D.Title>
            <D.Description className="sr-only">Detalhes da tarefa</D.Description>
            <button
              onClick={() =>
                start(async () => {
                  if (!confirm("Excluir esta tarefa?")) return;
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
                onChange={(v) => patch({ scope: v as "pessoal" | "empresa" })}
                options={[{ value: "pessoal", label: "Pessoal" }, { value: "empresa", label: "Empresa" }]}
              />
            </Field>
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
                    <span className={cn("flex-1 text-[13.5px]", c.status === "done" && "text-faint line-through")}>{c.title}</span>
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
                    await createTask({ title: t, parentId: task.id, projectId: task.projectId });
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

export function NewTaskButton({ projectId, scope }: { projectId?: string; scope?: "pessoal" | "empresa" }) {
  const router = useRouter();
  const [, start] = React.useTransition();
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={() =>
        start(async () => {
          const id = await createTask({ title: "Nova tarefa", projectId: projectId ?? null, scope });
          router.push(`?task=${id}`);
        })
      }
    >
      + Nova tarefa
    </Button>
  );
}
