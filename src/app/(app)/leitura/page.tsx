import { BookOpen } from "lucide-react";
import { BooksPage } from "@/components/life/books-page";
import { PageHeader } from "@/components/ui/card";
import { listBooks } from "@/server/life";

export const metadata = { title: "Leitura" };

export default async function Page() {
  const books = await listBooks();
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHeader icon={<BookOpen />} title="Leitura" description="Livros em andamento e progresso de páginas." />
      <BooksPage books={books} />
    </div>
  );
}
