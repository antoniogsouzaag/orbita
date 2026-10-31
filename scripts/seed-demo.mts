// Dados de exemplo para desenvolvimento local (PGlite). Uso: npx tsx scripts/seed-demo.ts
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as s from "../src/db/schema";

const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
const db = drizzle(new PGlite(dir), { schema: s });
await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const at = (n: number, h: number, m = 0) => new Date(`${day(n)}T${String(h + 3).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`);

for (const t of [s.habitLogs, s.habits, s.tasks, s.projects, s.goals, s.events, s.transactions, s.notes, s.books, s.workouts, s.opsStatus, s.opsEvents, s.opsHeartbeats, s.opsDomains, s.focusSessions, s.checkins]) await db.delete(t);

const [agl, barb, casa] = await db.insert(s.projects).values([
  { name: "AG LABS — Comercial", color: "#22d3ee", area: "empresa" },
  { name: "Barberias", color: "#f59e0b", area: "empresa" },
  { name: "Casa", color: "#a78bfa", area: "pessoal" },
]).returning();

await db.insert(s.tasks).values([
  { title: "Revisar proposta do Atendente de IA para a Gabi", scope: "empresa", projectId: agl.id, dueDate: day(0), dueTime: "10:00", priority: 3 },
  { title: "Aprovar PR de lote do Barberias", scope: "empresa", projectId: barb.id, dueDate: day(0), priority: 2, tags: ["agente", "agente:hermes-oracle"] },
  { title: "Renovar domínio aglabs.app.br", scope: "empresa", dueDate: day(-1), priority: 3 },
  { title: "Gravar carrossel sobre automação", scope: "empresa", projectId: agl.id, dueDate: day(2), priority: 1 },
  { title: "Planejar campanha de novembro", scope: "empresa", dueDate: day(5) },
  { title: "Pagar academia", scope: "pessoal", dueDate: day(0), priority: 2, tags: ["financas"] },
  { title: "Comprar presente da mãe", scope: "pessoal", projectId: casa.id, dueDate: day(3) },
  { title: "Marcar dentista", scope: "pessoal", priority: 1 },
  { title: "Ler capítulo 4 de Deep Work", scope: "pessoal", dueDate: day(1), status: "doing" },
  { title: "Organizar fotos do celular", scope: "pessoal", status: "done", completedAt: new Date() },
]);

const habits = await db.insert(s.habits).values([
  { name: "Treinar", emoji: "🏋️", color: "#22c55e" },
  { name: "Ler 20 min", emoji: "📚", color: "#a78bfa" },
  { name: "Meditar", emoji: "🧘", color: "#22d3ee" },
]).returning();
const logs = habits.flatMap((h, i) => Array.from({ length: 14 }, (_, d) => ({ habitId: h.id, date: day(-d - 1) })).filter((_, d) => (d + i) % 4 !== 3));
await db.insert(s.habitLogs).values(logs);

await db.insert(s.goals).values([
  { title: "MRR do Barberias", emoji: "💈", area: "empresa", metric: "currency", current: 1840, target: 5000, unit: "R$", dueDate: day(70), color: "#f59e0b" },
  { title: "Ler 12 livros no ano", emoji: "📚", area: "pessoal", metric: "number", current: 8, target: 12, unit: "livros", color: "#a78bfa" },
]);

await db.insert(s.events).values([
  { title: "Call com cliente — Atendente IA", startAt: at(0, 14), endAt: at(0, 15), location: "Meet" },
  { title: "Treino", startAt: at(0, 18, 30), endAt: at(0, 19, 30) },
  { title: "Reunião de alinhamento dos agentes", startAt: at(1, 10), endAt: at(1, 11) },
]);

await db.insert(s.transactions).values([
  { date: day(-1), description: "Almoço", kind: "despesa", amount: 42.9, category: "Alimentação" },
  { date: day(-2), description: "Uber", kind: "despesa", amount: 23.5, category: "Transporte" },
  { date: day(-3), description: "Projeto Gabi Nutri", kind: "receita", amount: 1800, category: "Serviços" },
  { date: day(-5), description: "Mercado", kind: "despesa", amount: 318.4, category: "Casa" },
  { date: day(-8), description: "Academia", kind: "despesa", amount: 129.9, category: "Saúde" },
]);
await db.insert(s.notes).values([{ title: "Ideias para o Barberias", content: "- Lembrete por WhatsApp\n- Relatório semanal ao dono", pinned: true }, { title: "Livros para ler", content: "Deep Work, Atomic Habits" }]);
await db.insert(s.books).values([{ title: "Deep Work", author: "Cal Newport", totalPages: 296, currentPage: 124, status: "lendo" }]);
await db.insert(s.workouts).values([{ date: day(-1), name: "Treino A — Peito e tríceps", minutes: 55, exercises: [{ name: "Supino", sets: 4, reps: "10", load: "60kg" }] }]);

const now = new Date();
const urls = [["Barberias", "https://barberias.com.br/", "P1"], ["Members", "https://members.ia.br/", "P1"], ["AG LABS Institucional", "https://aglabs.ia.br/", "P2"], ["LP App", "https://aglabs.app.br/sobre", "P2"], ["Viajeki", "https://viajeki.com.br/", "P3"], ["n8n VPS-01", "https://n8na.aglabs.api.br/", "P4"]] as const;
await db.insert(s.opsStatus).values(urls.map(([name, url], i) => ({ url, name, ok: i !== 4, statusCode: i === 4 ? 502 : 200, latencyMs: 180 + i * 37, fails: i === 4 ? 3 : 0, source: "n8n-vps03-ping", checkedAt: now, changedAt: new Date(now.getTime() - (i === 4 ? 45 : 3000) * 60_000) })));
await db.insert(s.opsEvents).values([
  { kind: "site_down", severity: "critical", source: "n8n-vps03-ping", subject: "Viajeki", detail: { url: "https://viajeki.com.br/", status: 502 }, createdAt: new Date(now.getTime() - 45 * 60_000) },
  { kind: "workflow_error", severity: "warning", source: "n8n-vps01-erros", subject: "Instagram responde comentarios AG LABS", detail: { node: "HTTP Request", message: "401 token expirado" }, createdAt: new Date(now.getTime() - 3 * 3_600_000) },
]);
await db.insert(s.opsHeartbeats).values([
  { source: "n8n-vps03-ping", label: "ping my links (VPS-03)", lastSeen: now, everyMinutes: 15 },
  { source: "n8n-vps01-cruzado", label: "monitor cruzado (VPS-01 → VPS-03)", lastSeen: now, everyMinutes: 30 },
]);
await db.insert(s.opsDomains).values([{ domain: "aglabs.app.br", depends: "AG LABS App e LP", expiresAt: new Date(now.getTime() + 21 * 86_400_000), source: "n8n-vps03-dominios", checkedAt: now }]);
await db.insert(s.checkins).values([{ date: day(-1), mood: 4, energy: 3 }]);
console.log("seed ok");
process.exit(0);
