"use client";

import { BookOpen, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { deleteBook, saveBook } from "@/app/actions/life";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, SectionLabel } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import type { Book } from "@/db/schema";

export function BooksPage({ books }: { books: Book[] }) {
  const [f, setF] = React.useState({ title: "", author: "", totalPages: "" });
  const [, start] = React.useTransition();
  const groups = [
    { id: "lendo", label: "Lendo" },
    { id: "quero", label: "Quero ler" },
    { id: "lido", label: "Lidos" },
  ];
  return (
    <div className="space-y-6">
      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              await saveBook(null, { title: f.title, author: f.author || null, totalPages: f.totalPages ? Number(f.totalPages) : null, status: "lendo" });
              toast.success("Livro adicionado");
              setF({ title: "", author: "", totalPages: "" });
            });
          }}
          className="flex flex-wrap gap-2"
        >
          <Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Título" className="min-w-[180px] flex-1" />
          <Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} placeholder="Autor" className="w-48" />
          <Input inputMode="numeric" value={f.totalPages} onChange={(e) => setF({ ...f, totalPages: e.target.value })} placeholder="Páginas" className="w-28" />
          <Button variant="primary"><Plus /> Adicionar</Button>
        </form>
      </Card>
      {books.length === 0 && <Card><EmptyState icon={<BookOpen />} title="Sua estante está vazia" /></Card>}
      {groups.map((g) => {
        const list = books.filter((b) => b.status === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id}>
            <SectionLabel className="mb-3">{g.label} · {list.length}</SectionLabel>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {list.map((b) => <BookCard key={b.id} b={b} onDelete={() => start(async () => { if (confirm("Remover livro?")) await deleteBook(b.id); })} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BookCard({ b, onDelete }: { b: Book; onDelete: () => void }) {
  const [page, setPage] = React.useState(String(b.currentPage));
  const [, start] = React.useTransition();
  const pct = b.totalPages ? (b.currentPage / b.totalPages) * 100 : 0;
  const save = (status?: "quero" | "lendo" | "lido") =>
    start(async () => {
      const n = Math.max(0, Math.min(Number(page) || 0, b.totalPages ?? 99999));
      const done = b.totalPages ? n >= b.totalPages : false;
      await saveBook(b.id, { title: b.title, currentPage: n, status: status ?? (done ? "lido" : b.status === "quero" && n > 0 ? "lendo" : (b.status as "lendo")) });
      if (done && b.status !== "lido") toast.success("Livro concluído! 📚");
    });
  return (
    <Card className="group p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-14 w-10 shrink-0 place-items-center rounded-md bg-gradient-to-br from-accent/25 to-accent/5 text-accent ring-1 ring-inset ring-accent/15"><BookOpen className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 font-medium">{b.title}</div>
          {b.author && <div className="text-[12px] text-faint">{b.author}</div>}
        </div>
        <button onClick={onDelete} className="rounded-md p-1 transition text-faint opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100" aria-label="Remover"><Trash2 className="size-3.5" /></button>
      </div>
      {b.status !== "quero" && (
        <>
          <Progress value={pct} className="mt-3" />
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted">
            <span>Página</span>
            <input value={page} onChange={(e) => setPage(e.target.value)} onBlur={() => save()} onKeyDown={(e) => e.key === "Enter" && save()} inputMode="numeric" aria-label="Página atual" className="h-7 w-16 rounded-lg border border-border bg-surface-2 px-2 text-center tabular-nums text-fg outline-none transition-[border-color,box-shadow] focus:border-accent/60 focus:ring-2 focus:ring-accent/15" />
            <span>de {b.totalPages ?? "?"}</span>
            <span className="ml-auto tabular-nums">{Math.round(pct)}%</span>
          </div>
        </>
      )}
      {b.status === "quero" && <Button size="sm" variant="secondary" className="mt-3" onClick={() => save("lendo")}>Começar a ler</Button>}
    </Card>
  );
}
