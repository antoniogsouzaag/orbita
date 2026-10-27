import { redirect } from "next/navigation";

export default async function KanbanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined));
  query.set("modo", "kanban");
  redirect(`/tarefas?${query}`);
}
