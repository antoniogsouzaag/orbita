import { NotebookPen } from "lucide-react";
import { NotesPage } from "@/components/notes/notes-page";
import { PageHeader } from "@/components/ui/card";
import { getNote, listNotes } from "@/server/notes";
import { taskScope } from "@/lib/task-scope";

export const metadata = { title: "Notas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; escopo?: string }> }) {
  const { id, escopo } = await searchParams;
  const scope = taskScope(escopo);
  const [notes, selected] = await Promise.all([listNotes(undefined, scope), id && /^[0-9a-f-]{36}$/.test(id) ? getNote(id, scope) : Promise.resolve(null)]);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<NotebookPen />} title={scope === "empresa" ? "Notas da empresa" : "Notas pessoais"} description={scope === "empresa" ? "Rascunhos, ideias e anotações de trabalho. Conhecimento canônico continua no Vault." : "Ideias e anotações do seu espaço pessoal."} />
      <NotesPage key={scope} notes={notes} selected={selected} scope={scope} />
    </div>
  );
}
