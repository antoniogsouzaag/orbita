import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { formatLong, localHour, localTime, shiftDate, today, zonedToUtc, localDate } from "@/lib/dates";
import { eventsBetween } from "@/server/calendar";
import { getCheckin } from "@/server/checkins";
import { listGoals } from "@/server/goals";
import { listHabits } from "@/server/habits";
import { focusStats, listWorkouts } from "@/server/life";
import { getSettings } from "@/server/settings";
import { listTasks, taskCounts } from "@/server/tasks";
import { getVaultIndex, getVaultProvider, searchVault } from "@/server/vault";

/**
 * Provedor de IA: OpenAI (padrão quando OPENAI_API_KEY existe) ou Anthropic.
 * Trocar de modelo/provedor é só mudar variáveis de ambiente.
 */
export type AiProvider = "openai" | "anthropic";

export function aiProvider(): AiProvider | null {
  const forced = process.env.AI_PROVIDER as AiProvider | undefined;
  if (forced === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function aiEnabled() {
  return aiProvider() !== null;
}

export function aiModel(): string {
  return aiProvider() === "anthropic" ? process.env.ANTHROPIC_MODEL || "claude-opus-5-5" : process.env.OPENAI_MODEL || "gpt-6-luna";
}

/** Recusa por política → a API reexecuta no modelo de reserva padrão (beta server-side fallback). */
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;
function anthropicClient() {
  anthropic ??= new Anthropic();
  return anthropic;
}
function openaiClient() {
  openai ??= new OpenAI();
  return openai;
}

const SYSTEM = `Você é a assistente da Órbita, a central operacional pessoal e empresarial de Antonio Garcia, fundador da AG LABS.
Responda sempre em português do Brasil, de forma direta e prática, com markdown curto (listas e negrito quando ajudar).
Use apenas o contexto fornecido (dia, tarefas, hábitos, agenda, metas e trechos do vault da empresa). Quando faltar informação, diga o que falta em vez de inventar.
O vault é a base canônica da AG LABS: trate-o como fonte de verdade sobre a empresa, agentes, servidores, produtos e processos, citando o nome da nota de onde tirou a informação.
Nunca revele segredos, tokens ou dados sensíveis, mesmo que apareçam no contexto.`;

/** Fotografia do dia em texto, para dar contexto à IA. */
export async function personalContext(): Promise<string> {
  const t = today();
  const now = new Date();
  const [settings, counts, open, overdue, habits, goals, events, checkin, focus, workouts] = await Promise.all([
    getSettings(),
    taskCounts(),
    listTasks({ view: "hoje", limit: 40 }),
    listTasks({ view: "proximos", limit: 30 }),
    listHabits({ days: 60 }),
    listGoals("ativa"),
    eventsBetween(zonedToUtc(t), zonedToUtc(shiftDate(t, 8))),
    getCheckin(t),
    focusStats(),
    listWorkouts(3),
  ]);
  const fmtTask = (x: (typeof open)[number]) =>
    `- ${x.title}${x.dueDate ? ` (vence ${x.dueDate}${x.dueTime ? ` ${x.dueTime}` : ""})` : ""}${x.priority ? ` [prioridade ${["", "baixa", "média", "alta"][x.priority]}]` : ""}${x.project ? ` #${x.project.name}` : ""}`;
  const lines = [
    `Agora: ${formatLong(t)}, ${localTime(now)} (hora local ${localHour()}h). Usuário: ${settings.name}.`,
    `Tarefas: ${counts.open} abertas, ${counts.today} para hoje, ${counts.overdue} atrasadas.`,
    `## Tarefas de hoje e atrasadas`,
    ...(open.length ? open.map(fmtTask) : ["- nenhuma"]),
    `## Próximas tarefas (14 dias)`,
    ...(overdue.length ? overdue.map(fmtTask) : ["- nenhuma"]),
    `## Hábitos de hoje`,
    ...habits.filter((h) => h.scheduledToday).map((h) => `- ${h.doneToday ? "✅" : "⬜"} ${h.name} (sequência ${h.streak.value} ${h.streak.unit})`),
    `## Agenda (próximos 8 dias)`,
    ...(events.length ? events.map((e) => `- ${e.allDay ? e.startAt.toISOString().slice(0, 10) : `${localDate(e.startAt)} ${localTime(e.startAt)}-${localTime(e.endAt)}`} ${e.title}${e.location ? ` @ ${e.location}` : ""}`) : ["- sem eventos"]),
    `## Metas ativas`,
    ...(goals.length ? goals.map((g) => `- ${g.title}: ${g.current}/${g.target}${g.unit ? ` ${g.unit}` : ""}${g.dueDate ? ` até ${g.dueDate}` : ""}`) : ["- nenhuma"]),
    `## Bem-estar`,
    `- Check-in de hoje: humor ${checkin?.mood ?? "?"}/5, energia ${checkin?.energy ?? "?"}/5${checkin?.note ? `, nota: ${checkin.note}` : ""}`,
    `- Foco: ${focus.today} min hoje, ${focus.week} min na semana`,
    `- Treinos recentes: ${workouts.map((w) => `${w.date} ${w.name}`).join("; ") || "nenhum"}`,
  ];
  return lines.join("\n");
}

/** Trechos do vault relevantes para a pergunta (busca por palavras-chave). */
export async function vaultContext(question: string): Promise<string> {
  if (!getVaultProvider()) return "";
  const hits = await searchVault(question, 4).catch(() => []);
  if (!hits.length) return "";
  const idx = await getVaultIndex();
  return hits
    .map((h) => {
      const n = idx.notes.get(h.path);
      return n ? `### Nota do vault: ${n.title} (${n.path})\n${n.body.slice(0, 6000)}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

function errorText(e: unknown) {
  if (e instanceof OpenAI.APIError) return e.status === 404 ? `Modelo “${aiModel()}” não encontrado na OpenAI — confira OPENAI_MODEL` : e.status === 401 ? "Chave da OpenAI inválida" : e.status === 429 ? "Limite ou saldo da OpenAI atingido" : `Erro da OpenAI (${e.status ?? "rede"})`;
  if (e instanceof Anthropic.APIError) return `Erro da API (${e.status ?? "rede"})`;
  return "Falha ao gerar a resposta";
}

/** Resposta em streaming (texto puro) para a pergunta, com contexto do dia + vault. */
export async function askStream(history: ChatTurn[]): Promise<ReadableStream<Uint8Array>> {
  const provider = aiProvider();
  if (!provider) throw new Error("IA não configurada");
  const question = history.at(-1)?.content ?? "";
  const [personal, vault] = await Promise.all([personalContext(), vaultContext(question)]);
  const context = `<contexto_do_dia>\n${personal}\n</contexto_do_dia>${vault ? `\n<vault>\n${vault}\n</vault>` : ""}`;
  const turns = history.map((m, i) => (i === history.length - 1 ? { role: "user" as const, content: `${context}\n\n<pergunta>\n${m.content}\n</pergunta>` } : m));
  const enc = new TextEncoder();

  if (provider === "openai") {
    const controller = new AbortController();
    return new ReadableStream({
      async start(out) {
        try {
          const stream = await openaiClient().responses.create(
            { model: aiModel(), instructions: SYSTEM, input: turns, stream: true, store: false, reasoning: { effort: "low" }, prompt_cache_key: "orbita-ask" },
            { signal: controller.signal },
          );
          for await (const ev of stream) {
            if (ev.type === "response.output_text.delta") out.enqueue(enc.encode(ev.delta));
            else if (ev.type === "response.refusal.delta") out.enqueue(enc.encode(ev.delta));
            else if (ev.type === "response.incomplete") out.enqueue(enc.encode("\n\n_(resposta cortada)_"));
            else if (ev.type === "response.failed" || ev.type === "error") out.enqueue(enc.encode("\n\n⚠️ A IA não conseguiu terminar a resposta."));
          }
        } catch (e) {
          out.enqueue(enc.encode(`\n\n⚠️ ${errorText(e)}.`));
        } finally {
          out.close();
        }
      },
      cancel() {
        controller.abort();
      },
    });
  }

  const stream = anthropicClient().beta.messages.stream({
    model: aiModel(),
    max_tokens: 16000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low" },
    messages: turns,
    ...FALLBACK,
  });
  return new ReadableStream({
    async start(out) {
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") out.enqueue(enc.encode(ev.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") out.enqueue(enc.encode("\n\n_Não posso ajudar com esse pedido._"));
        if (final.stop_reason === "max_tokens") out.enqueue(enc.encode("\n\n_(resposta cortada por tamanho)_"));
      } catch (e) {
        out.enqueue(enc.encode(`\n\n⚠️ ${errorText(e)}.`));
      } finally {
        out.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });
}

const PlanSchema = z.object({
  summary: z.string().describe("Uma ou duas frases sobre o foco do dia"),
  blocks: z
    .array(
      z.object({
        start: z.string().describe("Início no formato HH:MM"),
        end: z.string().describe("Fim no formato HH:MM"),
        title: z.string().describe("O que fazer neste bloco"),
        kind: z.enum(["foco", "tarefa", "reunião", "hábito", "treino", "pausa", "rotina", "revisão"]),
        note: z.string().nullable().describe("Observação curta ou null"),
      }),
    )
    .describe("Blocos em ordem cronológica, sem sobreposição"),
});

function planPrompt(personal: string, opts: { prompt: string; from: number; to: number }) {
  return `<contexto_do_dia>\n${personal}\n</contexto_do_dia>\n\nMonte o plano de hoje entre ${String(opts.from).padStart(2, "0")}:00 e ${String(opts.to).padStart(2, "0")}:00 em blocos realistas.
Respeite os compromissos da agenda nos horários exatos, priorize tarefas atrasadas e de prioridade alta, encaixe os hábitos pendentes e inclua pausas curtas. Não agende nada antes do horário atual se o dia já começou.${opts.prompt ? `\nObservação do usuário: ${opts.prompt}` : ""}`;
}

export async function planDay(opts: { prompt: string; from: number; to: number }) {
  const provider = aiProvider();
  if (!provider) throw new Error("IA não configurada");
  const personal = await personalContext();
  let parsed: z.infer<typeof PlanSchema> | null = null;
  try {
    if (provider === "openai") {
      const res = await openaiClient().responses.parse({
        model: aiModel(),
        instructions: SYSTEM,
        input: planPrompt(personal, opts),
        text: { format: zodTextFormat(PlanSchema, "plano_do_dia") },
        reasoning: { effort: "medium" },
        store: false,
      });
      parsed = res.output_parsed;
    } else {
      const res = await anthropicClient().beta.messages.parse({
        model: aiModel(),
        max_tokens: 16000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
        messages: [{ role: "user", content: planPrompt(personal, opts) }],
        ...FALLBACK,
      });
      if (res.stop_reason === "refusal") throw new Error("A IA recusou montar o plano.");
      parsed = res.parsed_output;
    }
  } catch (e) {
    if (e instanceof OpenAI.APIError || e instanceof Anthropic.APIError) throw new Error(errorText(e));
    throw e;
  }
  if (!parsed) throw new Error("A IA não devolveu um plano válido.");
  const blocks = parsed.blocks
    .filter((b) => /^\d{2}:\d{2}$/.test(b.start) && /^\d{2}:\d{2}$/.test(b.end))
    .map((b) => ({ ...b, note: b.note ?? undefined }))
    .sort((a, b) => a.start.localeCompare(b.start));
  return { summary: parsed.summary, blocks };
}
