export type PriorityTask = { id: string; title: string; dueDate: string | null; priority: number };
export function rankPriorities<T extends PriorityTask>(tasks: T[], today: string) {
  const bucket = (task: T) => task.dueDate && task.dueDate < today ? 0 : task.dueDate === today ? 1 : task.priority >= 3 ? 2 : 3;
  return [...tasks].sort((a, b) => bucket(a) - bucket(b) || b.priority - a.priority || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.id.localeCompare(b.id));
}
