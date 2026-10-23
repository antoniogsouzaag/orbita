import { desc, ilike, or } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { goals, notes, projects, tasks } from "@/db/schema";
import { isAuthenticated } from "@/lib/auth";
import { searchVault } from "@/server/vault";

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q}%`;
  const db = await getDb();
  const [t, n, p, g, v] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, status: tasks.status }).from(tasks).where(or(ilike(tasks.title, like), ilike(tasks.notes, like))).orderBy(desc(tasks.createdAt)).limit(8),
    db.select({ id: notes.id, title: notes.title }).from(notes).where(or(ilike(notes.title, like), ilike(notes.content, like))).orderBy(desc(notes.updatedAt)).limit(6),
    db.select({ id: projects.id, name: projects.name }).from(projects).where(ilike(projects.name, like)).limit(5),
    db.select({ id: goals.id, title: goals.title }).from(goals).where(ilike(goals.title, like)).limit(5),
    searchVault(q, 8).catch(() => []),
  ]);
  const results = [
    ...t.map((x) => ({ id: x.id, type: "tarefa", title: x.title, subtitle: x.status === "done" ? "concluída" : "tarefa", href: `/tarefas?task=${x.id}` })),
    ...v.map((x) => ({ id: x.path, type: "vault", title: x.title, subtitle: x.folder || "vault", href: `/vault?p=${encodeURIComponent(x.path)}` })),
    ...n.map((x) => ({ id: x.id, type: "nota", title: x.title, href: `/notas?id=${x.id}` })),
    ...p.map((x) => ({ id: x.id, type: "projeto", title: x.name, href: `/projetos/${x.id}` })),
    ...g.map((x) => ({ id: x.id, type: "meta", title: x.title, href: `/metas` })),
  ];
  return NextResponse.json({ results });
}
