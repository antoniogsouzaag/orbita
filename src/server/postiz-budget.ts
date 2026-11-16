import "server-only";
import { RateWindow } from "@/lib/rate-window";

/**
 * Limite do Postiz: o servidor público conta só a criação de post (POST /public/v1/posts), por organização e por hora
 * (API_LIMIT; o docker-compose do Postiz traz 30). Upload e leitura não contam. Cada rede de um post é uma criação,
 * então um post da AG LABS em 5 redes gasta 5. A janela é deste processo: outro cliente com a mesma chave (o script do
 * marketing, o painel) também gasta, e por isso a resposta 429 continua tratada.
 */
export const POSTIZ_POST_LIMIT = Math.max(1, Number(process.env.POSTIZ_API_LIMIT) || 30);
export const createBudget = new RateWindow(POSTIZ_POST_LIMIT, 3_600_000);
export function postizBudget() { return createBudget.state(); }
