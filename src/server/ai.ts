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
import { assistantTools, runAssistantTool, toolJsonSchema } from "@/server/assistant";
import { crmConfigured } from "@/server/crm";
import { getVaultIndexSafe, getVaultProvider, searchVault } from "@/server/vault";

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
    `- ${x.title} (id ${x.id})${x.dueDate ? ` (vence ${x.dueDate}${x.dueTime ? ` ${x.dueTime}` : ""})` : ""}${x.priority ? ` [prioridade ${["", "baixa", "média", "alta"][x.priority]}]` : ""}${x.project ? ` #${x.project.name}` : ""}`;
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
  const idx = await getVaultIndexSafe();
  if (!idx) return "";
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

/** Marcador de ação no fluxo de texto: \u001e{json}\u001e — o chat mostra um chip e atualiza a tela. */
export const ACTION_MARK = "\u001e";
const MAX_ROUNDS = 6;

function actionMarker(a: { label: string; href: string }) {
  return `${ACTION_MARK}${JSON.stringify(a)}${ACTION_MARK}`;
}

const TOOL_RULES = `Você pode agir com as ferramentas: criar, listar, atualizar e concluir tarefas; criar eventos e ver a agenda; registrar despesas e receitas; criar e buscar notas pessoais; buscar e ler o vault; ver o status da operação.
- Quando o pedido for uma ação ("cria", "marca", "lembra", "anota", "gastei", "conclui", "reorganiza"), execute com a ferramenta em vez de só descrever. Depois confirme em uma linha o que foi feito.
- Calcule datas absolutas (AAAA-MM-DD) a partir de hoje, informado no contexto. Horários em HH:MM, fuso de São Paulo.
- Para mudar uma tarefa existente use o id do contexto ou chame listar_tarefas antes. Nunca invente ids.
- Para reorganizar o dia ou a semana, ajuste prazo e prioridade das tarefas e explique a nova ordem.
- Pedido ambíguo que pode criar algo errado: pergunte antes. Você não apaga nada.
- O vault é só leitura aqui.`;

const CRM_RULES = `CRM da AG LABS (ferramentas crm_*): clientes, leads, funil, receita e tarefas do time (Maia, Léo, Antonio, técnico).
- Procure o contato (crm_buscar_contatos) antes de criar tarefa ou interação sobre ele; use o id que o CRM devolver.
- E-mail para um contato é enviado pelo Léo: crie a tarefa para leo com o contato e o que deve ser enviado. Atribuir não garante que ele recebeu.
- Tarefa da empresa sobre cliente ou venda vai para o CRM; tarefa pessoal ou interna de Antonio continua na Órbita.
- Você não muda a etapa do funil, não apaga e não vê e-mail ou telefone dos contatos.`;

const NO_CRM = "- Tarefas e dados de clientes da empresa ficam no CRM, que ainda não está conectado à Órbita.";

/** Resposta em streaming (texto) para a pergunta, com contexto do dia + vault e ferramentas para agir. */
export async function askStream(history: ChatTurn[], opts: { tools?: boolean } = {}): Promise<ReadableStream<Uint8Array>> {
  const provider = aiProvider();
  if (!provider) throw new Error("IA não configurada");
  const useTools = opts.tools ?? true;
  const question = history.at(-1)?.content ?? "";
  const [personal, vault] = await Promise.all([personalContext(), vaultContext(question)]);
  const context = `<contexto_do_dia>\n${personal}\n</contexto_do_dia>${vault ? `\n<vault>\n${vault}\n</vault>` : ""}`;
  const turns = history.map((m, i) => (i === history.length - 1 ? { role: "user" as const, content: `${context}\n\n<pergunta>\n${m.content}\n</pergunta>` } : m));
  const instructions = useTools ? `${SYSTEM}\n\n${TOOL_RULES}\n${crmConfigured() ? `\n${CRM_RULES}` : NO_CRM}` : SYSTEM;
  const enc = new TextEncoder();
  const controller = new AbortController();

  const run = provider === "openai" ? runOpenAI : runAnthropic;
  return new ReadableStream({
    async start(out) {
      const emit = (t: string) => out.enqueue(enc.encode(t));
      try {
        await run({ instructions, turns, useTools, emit, signal: controller.signal });
      } catch (e) {
        if (!controller.signal.aborted) emit(`\n\n⚠️ ${errorText(e)}.`);
      } finally {
        out.close();
      }
    },
    cancel() {
      controller.abort();
    },
  });
}

/** Mesma conversa, sem streaming: devolve o texto final e as ações feitas (usado pelo atalho do iPhone). */
export async function askOnce(text: string): Promise<{ answer: string; actions: { label: string; href: string }[] }> {
  const stream = await askStream([{ role: "user", content: text }]);
  const raw = await new Response(stream).text();
  const actions: { label: string; href: string }[] = [];
  const answer = raw.replace(new RegExp(`${ACTION_MARK}([^${ACTION_MARK}]*)${ACTION_MARK}`, "g"), (_, j: string) => {
    try {
      actions.push(JSON.parse(j));
    } catch {}
    return "";
  });
  return { answer: answer.trim(), actions };
}

type RunArgs = { instructions: string; turns: ChatTurn[]; useTools: boolean; emit: (t: string) => void; signal: AbortSignal };

async function runOpenAI({ instructions, turns, useTools, emit, signal }: RunArgs) {
  const client = openaiClient();
  const tools: OpenAI.Responses.Tool[] = useTools ? assistantTools().map((t) => ({ type: "function", name: t.name, description: t.description, parameters: toolJsonSchema(t), strict: false })) : [];
  let input: OpenAI.Responses.ResponseInput = turns.map((t) => ({ role: t.role, content: t.content }));
  let reasoning = true; // alguns modelos não aceitam o parâmetro: cai para a chamada simples

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const body = {
      model: aiModel(),
      instructions,
      input,
      stream: true as const,
      store: false,
      prompt_cache_key: "orbita-ask",
      ...(tools.length ? { tools, parallel_tool_calls: true } : {}),
      ...(reasoning ? { reasoning: { effort: "low" as const }, include: ["reasoning.encrypted_content" as const] } : {}),
    };
    let stream;
    try {
      stream = await client.responses.create(body, { signal });
    } catch (e) {
      if (reasoning && e instanceof OpenAI.APIError && e.status === 400 && /reasoning|unsupported/i.test(e.message)) {
        reasoning = false;
        round--;
        continue;
      }
      throw e;
    }
    let final: OpenAI.Responses.Response | null = null;
    for await (const ev of stream) {
      if (ev.type === "response.output_text.delta") emit(ev.delta);
      else if (ev.type === "response.refusal.delta") emit(ev.delta);
      else if (ev.type === "response.completed") final = ev.response;
      else if (ev.type === "response.incomplete") {
        emit("\n\n_(resposta cortada)_");
        final = ev.response;
      } else if (ev.type === "response.failed" || ev.type === "error") emit("\n\n⚠️ A IA não conseguiu terminar a resposta.");
    }
    const calls = (final?.output ?? []).filter((o): o is OpenAI.Responses.ResponseFunctionToolCall => o.type === "function_call");
    if (!calls.length || !final) return;
    input = [...input, ...(final.output as OpenAI.Responses.ResponseInputItem[])];
    for (const c of calls) {
      const r = await runAssistantTool(c.name, c.arguments);
      if (r.action) emit(actionMarker(r.action));
      input.push({ type: "function_call_output", call_id: c.call_id, output: r.text });
    }
  }
  emit("\n\n_(parei após muitas etapas; confira o que foi feito)_");
}

async function runAnthropic({ instructions, turns, useTools, emit, signal }: RunArgs) {
  const tools = useTools ? assistantTools().map((t) => ({ name: t.name, description: t.description, input_schema: toolJsonSchema(t) as Anthropic.Beta.BetaTool.InputSchema })) : undefined;
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => ({ role: t.role, content: t.content }));
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = anthropicClient().beta.messages.stream(
      { model: aiModel(), max_tokens: 16000, system: [{ type: "text", text: instructions, cache_control: { type: "ephemeral" } }], output_config: { effort: "low" }, messages, ...(tools ? { tools } : {}), ...FALLBACK },
      { signal },
    );
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") emit(ev.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") emit("\n\n_Não posso ajudar com esse pedido._");
    if (final.stop_reason === "max_tokens") emit("\n\n_(resposta cortada por tamanho)_");
    if (final.stop_reason !== "tool_use") return;
    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const b of final.content) {
      if (b.type !== "tool_use") continue;
      const r = await runAssistantTool(b.name, b.input as Record<string, unknown>);
      if (r.action) emit(actionMarker(r.action));
      results.push({ type: "tool_result", tool_use_id: b.id, content: r.text, ...(r.ok ? {} : { is_error: true }) });
    }
    messages.push({ role: "user", content: results });
  }
  emit("\n\n_(parei após muitas etapas; confira o que foi feito)_");
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
