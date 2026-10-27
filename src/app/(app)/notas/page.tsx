import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { NotesPage } from "@/components/notes/notes-page";
import { PageHeader } from "@/components/ui/card";
import { getNote, listNotes } from "@/server/notes";
import { getProject } from "@/server/projects";
import { notFound } from "next/navigation";
import { projectScope, taskScope } from "@/lib/task-scope";

export const metadata = { title: "Notas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; escopo?: string; arquivo?: string; projeto?: string }> }) {
  const { id, escopo, arquivo, projeto } = await searchParams;
  const scope = taskScope(escopo);
  const project = projeto && /^[0-9a-f-]{36}$/.test(projeto) ? await getProject(projeto) : null;
  if (projeto && (!project || projectScope(project.area) !== scope)) notFound();
  const [notes, selected] = await Promise.all([listNotes(undefined, scope, arquivo === "1", project?.id), id && /^[0-9a-f-]{36}$/.test(id) ? getNote(id, scope) : Promise.resolve(null)]);
  if (project && selected && !selected.tags.includes(`p:${project.id}`)) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<NotebookPen />} title={scope === "empresa" ? "Notas da empresa" : "Notas pessoais"} description={scope === "empresa" ? "Rascunhos, ideias e anotações de trabalho. Conhecimento canônico continua no Vault." : "Ideias e anotações do seu espaço pessoal."} />
      {project && <p className="mb-4 text-sm text-muted"><Link className="text-accent hover:underline" href={`/projetos/${project.id}${scope === "empresa" ? "?escopo=empresa" : ""}`}>← {project.name}</Link> · Notas vinculadas a este projeto</p>}
      <NotesPage projectId={project?.id} key={`${scope}:${project?.id ?? "all"}`} notes={notes} selected={selected} scope={scope} archived={arquivo === "1"} />
    </div>
  );
}
