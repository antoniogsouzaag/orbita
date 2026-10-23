import { NotebookPen } from "lucide-react";
import { NotesPage } from "@/components/notes/notes-page";
import { PageHeader } from "@/components/ui/card";
import { getNote, listNotes } from "@/server/notes";

export const metadata = { title: "Notas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const [notes, selected] = await Promise.all([listNotes(), id && /^[0-9a-f-]{36}$/.test(id) ? getNote(id) : Promise.resolve(null)]);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <PageHeader icon={<NotebookPen />} title="Notas" description="Notas pessoais. O conhecimento da empresa fica no Vault." />
      <NotesPage notes={notes} selected={selected} />
    </div>
  );
}
