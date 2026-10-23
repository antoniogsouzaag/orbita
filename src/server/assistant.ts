import "server-only";
import { desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { events, notes, projects, tasks, transactions, type TaskScope } from "@/db/schema";
import { localDate, localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { matchProject, parseTaskInput } from "@/lib/parse-task";
import { projectScope, taskHref } from "@/lib/task-scope";
import { insertTask, patchTask } from "./task-write";
import { eventsBetween } from "./calendar";
import { CRM_ASSIGNEE, clearCrmCache, crmCall, crmConfigured, crmUrl } from "./crm";
import { liveOps } from "./ops-live";
import { listTasks, type TaskView } from "./tasks";
import { getVaultIndexSafe, getVaultProvider, searchVault, vaultHealth } from "./vault";
import { editVault, editVaultSchema } from "./vault-edit";

/**
 * Ações que a IA da Órbita (e o atalho do iPhone) podem executar em nome de Antonio.
 * Só o proprietário chega aqui (rotas autenticadas por sessão ou token pessoal).
 * Nada é apagado por estas ações.
 */

export type ActionResult = { text: string; action?: { label: string; href: string } };

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");
const hora = z.string().regex(/^\d{2}:\d{2}$/, "use HH:MM");
const PRIORIDADE = { nenhuma: 0, baixa: 1, media: 2, alta: 3 } as const;
const prioridade = z.enum(["nenhuma", "baixa", "media", "alta"]);
const PRIO_NOME = ["sem prioridade", "baixa", "média", "alta"];

async function projectByName(name: string | null | undefined) {
  if (!name) return null;
  const db = await getDb();
  const all = await db.select({ id: projects.id, name: projects.name, area: projects.area }).from(projects).where(eq(projects.archived, false));
  const m = matchProject(name, all);
  return m ? (all.find((x) => x.id === m.id) ?? null) : null;
}

function fmtTask(t: { id: string; scope?: string; title: string; dueDate: string | null; dueTime: string | null; priority: number; status: string; project?: { name: string } | null; tags?: string[] }) {
  return `- [${t.status === "done" ? "x" : " "}] ${t.title} (id ${t.id})${t.scope === "empresa" ? " · empresa" : ""}${t.dueDate ? ` · prazo ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""}` : ""}${t.priority ? ` · prioridade ${PRIO_NOME[t.priority]}` : ""}${t.project ? ` · projeto ${t.project.name}` : ""}${t.tags?.length ? ` · #${t.tags.join(" #")}` : ""}`;
}

/* ───────────── Ações ───────────── */

const criarTarefaSchema = z.object({
    titulo: z.string().trim().min(1).max(500).describe("Título curto e acionável"),
    prazo: data.nullish().describe("Data limite AAAA-MM-DD"),
    hora: hora.nullish().describe("Horário HH:MM"),
    prioridade: prioridade.nullish(),
    projeto: z.string().max(100).nullish().describe("Nome do projeto existente"),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).nullish(),
    notas: z.string().max(5000).nullish(),
    escopo: z.enum(["pessoal", "empresa"]).nullish().describe("empresa = trabalho da AG LABS; pessoal = vida pessoal. Padrão: pessoal"),
  });
export const criarTarefa = {
  schema: criarTarefaSchema,
  async run(v: z.infer<typeof criarTarefaSchema>): Promise<ActionResult> {
    const p = await projectByName(v.projeto);
    const scope = v.escopo ?? projectScope(p?.area ?? "pessoal");
    const id = await insertTask({ title: v.titulo, dueDate: v.prazo ?? null, dueTime: v.hora ?? null, priority: v.prioridade ? PRIORIDADE[v.prioridade] : 0, projectId: p?.id ?? null, tags: v.tags ?? [], notes: v.notas ?? null, scope });
    const extra = [v.prazo && `prazo ${v.prazo}${v.hora ? ` ${v.hora}` : ""}`, p && `projeto ${p.name}`, v.projeto && !p && `projeto “${v.projeto}” não encontrado, ficou sem projeto`].filter(Boolean).join(", ");
    return { text: `Tarefa criada em ${scope} (id ${id}): ${v.titulo}${extra ? ` — ${extra}` : ""}.`, action: { label: `Tarefa: ${v.titulo}`, href: taskHref(scope) } };
  },
};

/** Captura rápida em linguagem natural: "pagar boleto amanhã 15h #financas !alta @AG LABS". */
export async function quickTask(texto: string): Promise<ActionResult> {
  const parsed = parseTaskInput(texto, today());
  const p = parsed.projectQuery ? await projectByName(parsed.projectQuery) : null;
  const title = (parsed.projectQuery && !p ? `${parsed.title} @${parsed.projectQuery}` : parsed.title).trim() || texto;
  const scope = projectScope(p?.area ?? "pessoal");
  await insertTask({ title, tags: parsed.tags, priority: parsed.priority, dueDate: parsed.dueDate, dueTime: parsed.dueTime, projectId: p?.id ?? null, scope });
  return { text: `Tarefa criada em ${scope}: ${title}${parsed.dueDate ? `, para ${parsed.dueDate}${parsed.dueTime ? ` às ${parsed.dueTime}` : ""}` : ""}.`, action: { label: `Tarefa: ${title}`, href: taskHref(scope) } };
}

const listarTarefasSchema = z.object({
    visao: z.enum(["hoje", "proximos", "atrasadas", "semdata", "todas", "concluidas"]).nullish().describe("hoje inclui as atrasadas; proximos = 14 dias"),
    busca: z.string().max(100).nullish().describe("Filtra pelo texto do título"),
    escopo: z.enum(["pessoal", "empresa"]).nullish().describe("Padrão pessoal. Para consultar a operação interna da AG LABS, informe empresa; tarefas comerciais ficam em crm_tarefas."),
    limite: z.number().int().min(1).max(50).nullish(),
  });
export const listarTarefas = {
  schema: listarTarefasSchema,
  async run(v: z.infer<typeof listarTarefasSchema>): Promise<ActionResult> {
    const rows = await listTasks({ view: (v.visao ?? "todas") as TaskView, limit: 200, scope: v.escopo ?? "pessoal" });
    const q = v.busca?.toLowerCase();
    const list = (q ? rows.filter((t) => t.title.toLowerCase().includes(q)) : rows).slice(0, v.limite ?? 25);
    return { text: list.length ? list.map(fmtTask).join("\n") : "Nenhuma tarefa encontrada." };
  },
};

const atualizarTarefaSchema = z.object({
    id: z.string().uuid().describe("id obtido com listar_tarefas"),
    titulo: z.string().trim().min(1).max(500).nullish(),
    status: z.enum(["todo", "doing", "done"]).nullish().describe("done = concluída"),
    prazo: data.nullish(),
    hora: hora.nullish(),
    sem_prazo: z.boolean().nullish().describe("true remove a data"),
    prioridade: prioridade.nullish(),
    projeto: z.string().max(100).nullish(),
    notas: z.string().max(5000).nullish(),
    escopo: z.enum(["pessoal", "empresa"]).nullish().describe("Apenas para mover explicitamente a tarefa entre espaços; as subtarefas acompanham."),
  });
export const atualizarTarefa = {
  schema: atualizarTarefaSchema,
  async run(v: z.infer<typeof atualizarTarefaSchema>): Promise<ActionResult> {
    const db = await getDb();
    const [cur] = await db.select().from(tasks).where(eq(tasks.id, v.id));
    if (!cur) return { text: "Tarefa não encontrada. Use listar_tarefas para obter o id certo." };
    const p = v.projeto ? await projectByName(v.projeto) : null;
    const patch: Partial<typeof tasks.$inferInsert> = {};
    if (v.titulo) patch.title = v.titulo;
    if (v.status) Object.assign(patch, { status: v.status, completedAt: v.status === "done" ? new Date() : null });
    if (v.sem_prazo) Object.assign(patch, { dueDate: null, dueTime: null });
    else {
      if (v.prazo) patch.dueDate = v.prazo;
      if (v.hora) patch.dueTime = v.hora;
    }
    if (v.prioridade) patch.priority = PRIORIDADE[v.prioridade];
    if (p) patch.projectId = p.id;
    if (v.escopo) patch.scope = v.escopo;
    if (v.notas != null) patch.notes = v.notas;
    if (!Object.keys(patch).length) return { text: "Nada para alterar." };
    await patchTask(v.id, patch);
    const what = v.status === "done" ? "concluída" : "atualizada";
    return { text: `Tarefa ${what}: ${patch.title ?? cur.title}.${v.projeto && !p ? ` Projeto “${v.projeto}” não encontrado.` : ""}`, action: { label: `${what === "concluída" ? "Concluída" : "Atualizada"}: ${patch.title ?? cur.title}`, href: taskHref(v.escopo ?? cur.scope) } };
  },
};

const criarEventoSchema = z.object({
    titulo: z.string().trim().min(1).max(300),
    data,
    inicio: hora.nullish().describe("Sem horário = dia inteiro"),
    fim: hora.nullish(),
    local: z.string().max(300).nullish(),
    descricao: z.string().max(3000).nullish(),
  });
export const criarEvento = {
  schema: criarEventoSchema,
  async run(v: z.infer<typeof criarEventoSchema>): Promise<ActionResult> {
    const db = await getDb();
    let startAt: Date, endAt: Date;
    const allDay = !v.inicio;
    if (allDay) {
      startAt = new Date(`${v.data}T00:00:00Z`);
      endAt = new Date(`${shiftDate(v.data, 1)}T00:00:00Z`);
    } else {
      startAt = zonedToUtc(v.data, v.inicio!);
      endAt = v.fim ? zonedToUtc(v.data, v.fim) : new Date(startAt.getTime() + 3_600_000);
      if (endAt <= startAt) endAt = new Date(startAt.getTime() + 3_600_000);
    }
    await db.insert(events).values({ title: v.titulo, startAt, endAt, allDay, location: v.local ?? null, description: v.descricao ?? null });
    return { text: `Evento criado: ${v.titulo} em ${v.data}${allDay ? " (dia inteiro)" : ` das ${localTime(startAt)} às ${localTime(endAt)}`}.`, action: { label: `Evento: ${v.titulo}`, href: "/agenda" } };
  },
};

const verAgendaSchema = z.object({ de: data.nullish().describe("Padrão: hoje"), dias: z.number().int().min(1).max(31).nullish() });
export const verAgenda = {
  schema: verAgendaSchema,
  async run(v: z.infer<typeof verAgendaSchema>): Promise<ActionResult> {
    const from = v.de ?? today();
    const list = await eventsBetween(zonedToUtc(from), zonedToUtc(shiftDate(from, v.dias ?? 7)));
    return { text: list.length ? list.map((e) => `- ${e.allDay ? `${e.startAt.toISOString().slice(0, 10)} (dia inteiro)` : `${localDate(e.startAt)} ${localTime(e.startAt)}–${localTime(e.endAt)}`} ${e.title}${e.location ? ` @ ${e.location}` : ""} [${e.calendarName}]`).join("\n") : "Agenda livre no período." };
  },
};

const registrarLancamentoSchema = z.object({
    descricao: z.string().trim().min(1).max(200),
    valor: z.number().positive().max(1e9).describe("Em reais"),
    tipo: z.enum(["despesa", "receita"]).nullish(),
    categoria: z.string().trim().max(60).nullish(),
    data: data.nullish(),
  });
export const registrarLancamento = {
  schema: registrarLancamentoSchema,
  async run(v: z.infer<typeof registrarLancamentoSchema>): Promise<ActionResult> {
    const db = await getDb();
    const kind = v.tipo ?? "despesa";
    await db.insert(transactions).values({ description: v.descricao, amount: v.valor, kind, category: v.categoria || "Outros", date: v.data ?? today() });
    const brl = v.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    return { text: `${kind === "despesa" ? "Despesa" : "Receita"} registrada: ${v.descricao}, ${brl}.`, action: { label: `${kind === "despesa" ? "Gasto" : "Receita"}: ${v.descricao} ${brl}`, href: "/financas" } };
  },
};

const criarNotaSchema = z.object({ titulo: z.string().trim().min(1).max(200), conteudo: z.string().max(50_000).nullish() });
export const criarNota = {
  schema: criarNotaSchema,
  async run(v: z.infer<typeof criarNotaSchema>): Promise<ActionResult> {
    const db = await getDb();
    await db.insert(notes).values({ title: v.titulo, content: v.conteudo ?? "" });
    return { text: `Nota criada: ${v.titulo}.`, action: { label: `Nota: ${v.titulo}`, href: "/notas" } };
  },
};

const buscarNotasSchema = z.object({ busca: z.string().trim().min(2).max(100) });
export const buscarNotas = {
  schema: buscarNotasSchema,
  async run(v: z.infer<typeof buscarNotasSchema>): Promise<ActionResult> {
    const db = await getDb();
    const q = `%${v.busca}%`;
    const rows = await db.select({ title: notes.title, content: notes.content }).from(notes).where(or(ilike(notes.title, q), ilike(notes.content, q))).orderBy(desc(notes.updatedAt)).limit(5);
    return { text: rows.length ? rows.map((n) => `### ${n.title}\n${n.content.slice(0, 2000)}`).join("\n\n") : "Nenhuma nota pessoal encontrada." };
  },
};

const buscarNoVaultSchema = z.object({ consulta: z.string().trim().min(2).max(200) });
export const buscarNoVault = {
  schema: buscarNoVaultSchema,
  async run(v: z.infer<typeof buscarNoVaultSchema>): Promise<ActionResult> {
    if (!getVaultProvider()) return { text: "Vault não configurado." };
    const health = await vaultHealth();
    if (!health.ok) return { text: `Vault indisponível: ${health.error}` };
    const hits = await searchVault(v.consulta, 8);
    return { text: hits.length ? hits.map((h) => `- ${h.title} — \`${h.path}\`: ${h.snippet}`).join("\n") : "Nada encontrado no vault." };
  },
};

const lerNotaDoVaultSchema = z.object({ caminho: z.string().trim().min(1).max(400).describe("Caminho ou nome da nota") });
export const lerNotaDoVault = {
  schema: lerNotaDoVaultSchema,
  async run(v: z.infer<typeof lerNotaDoVaultSchema>): Promise<ActionResult> {
    const idx = await getVaultIndexSafe();
    if (!idx) return { text: (await vaultHealth()).error ?? "Vault não configurado." };
    const p = idx.notes.has(v.caminho) ? v.caminho : idx.resolve(v.caminho.replace(/\.md$/i, ""));
    const n = p ? idx.notes.get(p) : null;
    return n ? { text: `# ${n.title} (${n.path})\nVersão: ${n.sha}\n\n${n.body.slice(0, 12_000)}` } : { text: "Nota não encontrada no vault." };
  },
};

const statusOperacaoSchema = z.object({});
export const statusOperacao = {
  schema: statusOperacaoSchema,
  async run(): Promise<ActionResult> {
    const live = await liveOps();
    const down = live.status.filter((s) => !s.ok);
    const open = live.events.filter((e) => e.kind === "site_down" && !e.resolvedAt);
    const wf = live.events.filter((e) => e.kind === "workflow_error" && Date.now() - e.createdAt.getTime() < 86_400_000);
    const lines = [
      `Endereços no ar: ${live.status.length - down.length}/${live.status.length}.`,
      ...down.map((d) => `- Fora do ar: ${d.name} (${d.url}) — ${d.statusCode ?? d.error ?? "sem resposta"}`),
      `Incidentes abertos: ${open.length}. Falhas de workflow nas últimas 24h: ${wf.length}${wf.length ? ` (${wf.map((e) => e.subject).join(", ")})` : ""}.`,
      `Monitores: ${live.monitors.map((m) => `${m.label}${m.silent ? " ⚠️ em silêncio" : ""}`).join("; ") || "nenhum enviando ainda"}.`,
    ];
    const soon = live.domains.filter((d) => d.expiresAt && d.expiresAt.getTime() - Date.now() < 45 * 86_400_000);
    if (soon.length) lines.push(`Domínios vencendo em menos de 45 dias: ${soon.map((d) => `${d.domain} (${d.expiresAt!.toISOString().slice(0, 10)})`).join(", ")}.`);
    return { text: lines.join("\n") };
  },
};

/* ───────────── CRM (servidor MCP do crm-dash) ───────────── */

const responsavel = z.enum(["maia", "leo", "antonio", "tecnico"]);
const idCrm = z.string().uuid("use o id que o CRM devolveu");
/** O modelo manda null nos campos opcionais; o CRM espera o campo ausente. */
const semNulos = (v: Record<string, unknown>) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined));
const crmLink = (label: string, path: string) => {
  const href = crmUrl(path);
  return href ? { label, href } : undefined;
};

const crmResumoSchema = z.object({});
export const crmResumo = {
  schema: crmResumoSchema,
  async run(): Promise<ActionResult> {
    return { text: `CRM — resumo: ${JSON.stringify(await crmCall("crm_resumo"))}` };
  },
};

const crmTarefasSchema = z.object({
  responsavel: responsavel.nullish(),
  situacao: z.enum(["todas", "vencidas", "hoje", "ate_hoje"]).nullish(),
  limite: z.number().int().min(1).max(50).nullish(),
});
export const crmTarefas = {
  schema: crmTarefasSchema,
  async run(v: z.infer<typeof crmTarefasSchema>): Promise<ActionResult> {
    return { text: `CRM — tarefas pendentes: ${JSON.stringify(await crmCall("crm_tarefas", semNulos(v)))}` };
  },
};

const crmBuscarContatosSchema = z.object({ termo: z.string().trim().min(2).max(80).describe("Nome, empresa, e-mail ou Instagram") });
export const crmBuscarContatos = {
  schema: crmBuscarContatosSchema,
  async run(v: z.infer<typeof crmBuscarContatosSchema>): Promise<ActionResult> {
    return { text: `CRM — contatos: ${JSON.stringify(await crmCall("crm_buscar_contatos", v))}` };
  },
};

const crmContatoSchema = z.object({ contato_id: idCrm });
export const crmContato = {
  schema: crmContatoSchema,
  async run(v: z.infer<typeof crmContatoSchema>): Promise<ActionResult> {
    return { text: `CRM — ficha: ${JSON.stringify(await crmCall("crm_contato", v))}` };
  },
};

const crmCriarTarefaSchema = z.object({
  titulo: z.string().trim().min(3).max(200),
  descricao: z.string().trim().max(2000).nullish().describe("O que fazer; para e-mail, o conteúdo ou o objetivo da mensagem"),
  responsavel,
  prazo: data.nullish(),
  prioridade: z.enum(["Baixa", "Média", "Alta"]).nullish(),
  contato_id: idCrm.nullish(),
});
export const crmCriarTarefa = {
  schema: crmCriarTarefaSchema,
  async run(v: z.infer<typeof crmCriarTarefaSchema>): Promise<ActionResult> {
    const r = await crmCall<{ criada: { id: string; titulo: string } }>("crm_criar_tarefa", semNulos(v));
    clearCrmCache();
    const quem = CRM_ASSIGNEE[v.responsavel];
    return { text: `Tarefa criada no CRM para ${quem} (id ${r.criada.id}): ${r.criada.titulo}.`, action: crmLink(`CRM: ${v.titulo} → ${quem}`, v.contato_id ? `/contacts/${v.contato_id}` : "/tasks") };
  },
};

const crmConcluirTarefaSchema = z.object({ tarefa_id: idCrm, motivo: z.string().trim().min(3).max(500).describe("Por que foi concluída, cancelada ou substituída") });
export const crmConcluirTarefa = {
  schema: crmConcluirTarefaSchema,
  async run(v: z.infer<typeof crmConcluirTarefaSchema>): Promise<ActionResult> {
    const r = await crmCall<{ concluida?: string; ja_concluida?: boolean; tarefa?: string }>("crm_concluir_tarefa", v);
    clearCrmCache();
    if (r.ja_concluida) return { text: `A tarefa “${r.tarefa}” já estava concluída no CRM.` };
    return { text: `Tarefa concluída no CRM: ${r.concluida}.`, action: crmLink(`CRM concluída: ${r.concluida}`, "/tasks") };
  },
};

const crmRegistrarAtividadeSchema = z.object({
  contato_id: idCrm,
  tipo: z.enum(["note", "followup", "suporte", "meeting"]).describe("note = nota, followup, suporte ou meeting = reunião"),
  canal: z.enum(["whatsapp", "email", "telefone", "presencial", "instagram"]).nullish(),
  resumo: z.string().trim().min(3).max(2000),
});
export const crmRegistrarAtividade = {
  schema: crmRegistrarAtividadeSchema,
  async run(v: z.infer<typeof crmRegistrarAtividadeSchema>): Promise<ActionResult> {
    await crmCall("crm_registrar_atividade", semNulos(v));
    return { text: "Interação registrada na ficha do contato no CRM.", action: crmLink("CRM: interação registrada", `/contacts/${v.contato_id}`) };
  },
};

/* ───────────── Catálogo para a IA ───────────── */

type Tool = { name: string; description: string; schema: z.ZodObject; run: (v: never) => Promise<ActionResult>; requires?: () => boolean };

export const ASSISTANT_TOOLS: Tool[] = [
  { name: "salvar_nota_vault", description: "Cria ou atualiza nota canônica do vault com controle de versão. Leia antes e forneça o SHA. Só registre mudanças de política, produto ou responsabilidade explicitamente aprovadas por Antonio; nunca salve segredos ou dados de clientes.", schema: editVaultSchema, run: editVault, requires: () => Boolean(getVaultProvider()) },
  { name: "criar_tarefa", description: "Cria uma tarefa para Antonio. Use datas absolutas (AAAA-MM-DD) calculadas a partir de hoje.", ...criarTarefa },
  { name: "listar_tarefas", description: "Lista tarefas com id, prazo, prioridade e projeto. Use antes de atualizar ou concluir.", ...listarTarefas },
  { name: "atualizar_tarefa", description: "Altera ou conclui uma tarefa existente (status done = concluir). Para reorganizar, mude prazo e prioridade.", ...atualizarTarefa },
  { name: "criar_evento", description: "Cria um compromisso na agenda da Órbita.", ...criarEvento },
  { name: "ver_agenda", description: "Mostra os compromissos de um período (inclui calendários assinados do iCloud/Google).", ...verAgenda },
  { name: "registrar_lancamento", description: "Registra uma despesa ou receita pessoal em Finanças.", ...registrarLancamento },
  { name: "criar_nota", description: "Cria uma nota pessoal na Órbita (não no vault).", ...criarNota },
  { name: "buscar_notas", description: "Busca nas notas pessoais da Órbita.", ...buscarNotas },
  { name: "buscar_no_vault", description: "Busca no vault da AG LABS (manual canônico da empresa).", ...buscarNoVault },
  { name: "ler_nota_do_vault", description: "Lê uma nota inteira do vault pelo caminho ou nome.", ...lerNotaDoVault },
  { name: "status_operacao", description: "Estado ao vivo: sites fora do ar, incidentes, falhas de workflow, monitores e domínios.", ...statusOperacao },
  { name: "crm_resumo", description: "CRM da AG LABS: funil por etapa, novos contatos, receita líquida do mês e tarefas por responsável.", requires: crmConfigured, ...crmResumo },
  { name: "crm_tarefas", description: "Tarefas pendentes do CRM (Maia, Léo, Antonio, técnico), das mais urgentes; filtra por responsável e situação.", requires: crmConfigured, ...crmTarefas },
  { name: "crm_buscar_contatos", description: "Procura clientes e leads no CRM por nome, empresa, e-mail ou Instagram. Use antes de agir sobre um contato.", requires: crmConfigured, ...crmBuscarContatos },
  { name: "crm_contato", description: "Ficha de um contato do CRM: etapa, produto, últimas interações, tarefas e receita.", requires: crmConfigured, ...crmContato },
  { name: "crm_criar_tarefa", description: "Cria tarefa no CRM com responsável. Para enviar e-mail a um contato, crie para leo com o contato e o conteúdo.", requires: crmConfigured, ...crmCriarTarefa },
  { name: "crm_concluir_tarefa", description: "Conclui tarefa do CRM com o motivo (também para cancelada ou substituída).", requires: crmConfigured, ...crmConcluirTarefa },
  { name: "crm_registrar_atividade", description: "Registra na ficha do contato uma interação que já aconteceu. Não muda a etapa do funil.", requires: crmConfigured, ...crmRegistrarAtividade },
] as Tool[];

/** Ferramentas disponíveis agora (as do CRM só aparecem com o CRM conectado). */
export function assistantTools(scope?: TaskScope) {
  return ASSISTANT_TOOLS.filter((t) => (!t.requires || t.requires()) && !(scope === "pessoal" && t.name.startsWith("crm_")) && !(scope === "empresa" && ["registrar_lancamento", "criar_nota", "buscar_notas", "ver_agenda", "criar_evento"].includes(t.name)));
}

export function toolJsonSchema(t: Tool): Record<string, unknown> {
  const schema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Executa uma ferramenta pelo nome com argumentos em JSON (vindos do modelo). */
export async function runAssistantTool(name: string, rawArgs: string | Record<string, unknown>, context?: { scope: TaskScope }): Promise<ActionResult & { ok: boolean }> {
  const tool = assistantTools(context?.scope).find((t) => t.name === name);
  if (!tool) return { ok: false, text: `Ferramenta desconhecida: ${name}` };
  let args: unknown = rawArgs;
  if (typeof rawArgs === "string") {
    try {
      args = rawArgs ? JSON.parse(rawArgs) : {};
    } catch {
      return { ok: false, text: "Argumentos inválidos (JSON malformado)." };
    }
  }
  if (context && ["criar_tarefa", "listar_tarefas", "atualizar_tarefa"].includes(name) && args && typeof args === "object" && !Array.isArray(args)) {
    const input = args as Record<string, unknown>;
    if (input.escopo && input.escopo !== context.scope) return { ok: false, text: "Essa tarefa pertence a outro espaço. Abra Pessoal ou Empresa para agir no espaço correspondente." };
    if (name === "atualizar_tarefa") {
      const id = z.string().uuid().safeParse(input.id);
      if (id.success) {
        const db = await getDb();
        const [task] = await db.select({ scope: tasks.scope }).from(tasks).where(eq(tasks.id, id.data));
        if (!task || task.scope !== context.scope) return { ok: false, text: "Tarefa não encontrada neste espaço." };
      }
    } else args = { ...input, escopo: context.scope };
  }
  const parsed = tool.schema.safeParse(args ?? {});
  if (!parsed.success) return { ok: false, text: `Argumentos inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ")}` };
  try {
    return { ok: true, ...(await tool.run(parsed.data as never)) };
  } catch (e) {
    return { ok: false, text: `Falhou: ${e instanceof Error ? e.message : String(e)}` };
  }
}
