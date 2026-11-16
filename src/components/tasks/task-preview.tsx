"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { loadTaskDetail } from "@/app/actions/task-detail";
import type { TaskScope } from "@/db/schema";
import type { TaskRow } from "@/server/tasks";
import { TaskDetail, type TaskDetailData } from "./task-detail";

/** O histórico nativo atualiza a seleção sem recarregar lista, contagens e CRM. */
export function selectTask(href: string) { window.history.pushState(null, "", href); }

export function TaskPreview({ tasks, initial, projects, assignees, scope }: {
  tasks: TaskRow[]; initial: TaskDetailData | null; scope: TaskScope;
  projects: { id: string; name: string; color: string }[]; assignees?: string[];
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const id = params.get("task");
  const [result, setResult] = useState<{ id: string; data: TaskDetailData | null; error?: boolean } | null>(null);
  useEffect(() => {
    if (!id || initial?.id === id) return;
    let active = true;
    loadTaskDetail(id, scope).then(data => { if (active) setResult({ id, data }); }, () => { if (active) setResult({ id, data: null, error: true }); });
    return () => { active = false; };
  }, [id, scope, initial, tasks]);
  if (!id) return null;
  const row = tasks.find(task => task.id === id && !task.parentId);
  const loaded = initial?.id === id ? initial : result?.id === id ? result.data : null;
  const task = loaded ? { ...loaded, ...(row ?? {}), children: loaded.children } : row ? { ...row, children: [] } : null;
  const close = () => { const next = new URLSearchParams(params.toString()); next.delete("task"); window.history.replaceState(null, "", `${pathname}?${next}`); };
  if (!task) return null;
  return <TaskDetail key={id} task={task} projects={projects} assignees={assignees} onClose={close} loading={!loaded && result?.id !== id} loadError={result?.id === id && !!result.error} />;
}
