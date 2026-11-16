import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { RateWindow } from "@/lib/rate-window";

/**
 * Limite do Postiz: o servidor público conta só a criação de post (POST /public/v1/posts), por organização e por hora
 * (API_LIMIT; o docker-compose do Postiz traz 30). Upload e leitura não contam. Cada rede de um post é uma criação,
 * então um post da AG LABS em 5 redes gasta 5. Outro cliente com a mesma chave (o script do marketing, o painel)
 * também gasta sem entrar nesta conta, e por isso a resposta 429 continua tratada.
 */
export const POSTIZ_POST_LIMIT = Math.max(1, Number(process.env.POSTIZ_API_LIMIT) || 30);
export const createBudget = new RateWindow(POSTIZ_POST_LIMIT, 3_600_000);
export function postizBudget() { return createBudget.state(); }

/**
 * A conta fica também em `settings` para sobreviver a deploy e reinício. Só é lida e gravada quando alguém agenda
 * ou consulta (nada de leitura por requisição: o banco dorme entre batidas). Falha de banco não bloqueia o agendamento.
 */
const KEY = "postiz-budget";
export async function loadPostizBudget() {
  try {
    const db = await getDb();
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, KEY));
    createBudget.merge(row?.value as { calls?: unknown; blockedUntil?: unknown } | undefined);
  } catch (e) { console.error(`[postiz] conta de criações não lida: ${e instanceof Error ? e.message : e}`); }
}
export async function savePostizBudget() {
  try {
    const db = await getDb();
    const value = createBudget.snapshot();
    await db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  } catch (e) { console.error(`[postiz] conta de criações não gravada: ${e instanceof Error ? e.message : e}`); }
}
/** Só para os testes. */
export async function clearPostizBudget() {
  createBudget.reset();
  await (await getDb()).delete(settings).where(eq(settings.key, KEY));
}
