import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { events, goals, notes, projects, tasks, transactions, type TaskScope } from "@/db/schema";
import { localDate, localTime, shiftDate, today, zonedToUtc } from "@/lib/dates";
import { matchProject, parseTaskInput } from "@/lib/parse-task";
import { projectScope, taskHref } from "@/lib/task-scope";
import { noteHref } from "@/lib/note-scope";
import { insertNote, noteArchiveCondition, noteScopeCondition } from "./notes";
import { insertTask, patchTask } from "./task-write";
import { eventsBetween } from "./calendar";
import { CRM_ASSIGNEE, clearCrmCache, crmCall, crmConfigured, crmUrl } from "./crm";
import { liveOps } from "./ops-live";
import { crmCommercialSummary, crmEmailFunnel, crmCommercialNotes, crmPrioritySummary } from "./crm-commercial";
import { crmSummaryInput, crmEmailInput, crmProductSchema, crmProductKey } from "@/lib/crm-aggregates";
import { businessUnit, MODEL_INFO } from "@/lib/business-models";
import { productMetrics } from "./product-metrics";
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

function fmtTask(t: { id: string; scope?: string; title: string; dueDate: string | null; dueTime: string | null; priority: number; status: string; assignee?: string | null; project?: { name: string } | null; tags?: string[] }) {
  return `- [${t.status === "done" ? "x" : " "}] ${t.title} (id ${t.id})${t.scope === "empresa" ? " · empresa" : ""}${t.status === "doing" ? " · em andamento" : ""}${t.assignee ? ` · responsável ${t.assignee}` : ""}${t.dueDate ? ` · prazo ${t.dueDate}${t.dueTime ? ` ${t.dueTime}` : ""}` : ""}${t.priority ? ` · prioridade ${PRIO_NOME[t.priority]}` : ""}${t.project ? ` · projeto ${t.project.name}` : ""}${t.tags?.length ? ` · #${t.tags.join(" #")}` : ""}`;
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
    responsavel: z.string().trim().max(80).nullish().describe("Quem assume a execução (ex.: Antonio, Tom, Claude Code). Texto vazio remove o responsável."),
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
    if (v.responsavel != null) patch.assignee = v.responsavel;
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

const criarNotaSchema = z.object({ titulo: z.string().trim().min(1).max(200), conteudo: z.string().max(50_000).nullish(), escopo: z.enum(["pessoal", "empresa"]).nullish() });
export const criarNota = {
  schema: criarNotaSchema,
  async run(v: z.infer<typeof criarNotaSchema>): Promise<ActionResult> {
    const scope = v.escopo ?? "pessoal";
    const id = await insertNote(v.titulo, v.conteudo ?? "", scope);
    return { text: `Nota criada em ${scope === "empresa" ? "Empresa" : "Pessoal"}: ${v.titulo}.`, action: { label: `Nota: ${v.titulo}`, href: noteHref(scope, id) } };
  },
};

const buscarNotasSchema = z.object({ busca: z.string().trim().min(2).max(100), limite: z.number().int().min(1).max(30).nullish(), escopo: z.enum(["pessoal", "empresa"]).nullish() });
export const buscarNotas = {
  schema: buscarNotasSchema,
  async run(v: z.infer<typeof buscarNotasSchema>): Promise<ActionResult> {
    const db = await getDb();
    const q = `%${v.busca}%`;
    const limit = v.limite ?? 20;
    const rows = await db.select({ id: notes.id, title: notes.title, content: notes.content, updatedAt: notes.updatedAt }).from(notes).where(and(noteScopeCondition(v.escopo ?? "pessoal"), noteArchiveCondition(), or(ilike(notes.title, q), ilike(notes.content, q)))).orderBy(desc(notes.updatedAt), desc(notes.id)).limit(limit + 1);
    return { text: rows.length ? rows.slice(0, limit).map((n) => `### ${n.title}\nID: ${n.id} · Atualizada: ${n.updatedAt.toISOString()}\n${n.content.slice(0, 2000)}${n.content.length > 2000 ? "\n[Conteúdo parcial; abra a nota para ler o restante.]" : ""}`).join("\n\n") + (rows.length > limit ? `\n\n[Consulta parcial: exibindo ${limit} notas. Refine a busca.]` : "") : v.escopo === "empresa" ? "Nenhuma nota da empresa encontrada." : "Nenhuma nota pessoal encontrada." };
  },
};

const buscarNoVaultSchema = z.object({ consulta: z.string().trim().min(2).max(200) });
export const buscarNoVault = {
  schema: buscarNoVaultSchema,
  async run(v: z.infer<typeof buscarNoVaultSchema>): Promise<ActionResult> {
    if (!getVaultProvider()) return { text: "Vault não configurado." };
    const health = await vaultHealth();
    if (!health.ok) return { text: "Vault indisponível nesta consulta. Tente novamente mais tarde." };
    const hits = await searchVault(v.consulta, 8);
    return { text: hits.length ? hits.map((h) => `- ${h.title} — \`${h.path}\`: ${h.snippet}`).join("\n") : "Nada encontrado no vault." };
  },
};

const lerNotaDoVaultSchema = z.object({ caminho: z.string().trim().min(1).max(400).describe("Caminho ou nome da nota") });
export const lerNotaDoVault = {
  schema: lerNotaDoVaultSchema,
  async run(v: z.infer<typeof lerNotaDoVaultSchema>): Promise<ActionResult> {
    const idx = await getVaultIndexSafe();
    if (!idx) return { text: "Vault indisponível ou não configurado nesta consulta." };
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
    const pendingWorkflows = live.events.filter(e => e.kind === "workflow_error" && !e.resolvedAt);
    const wf = live.events.filter((e) => e.kind === "workflow_error" && Date.now() - e.createdAt.getTime() < 86_400_000);
    const lines = [
      `Endereços no ar: ${live.status.length - down.length}/${live.status.length}.`,
      ...down.map((d) => `- Fora do ar: ${d.name} (${d.url}) — ${d.statusCode ?? d.error ?? "sem resposta"}`),
      `Incidentes abertos: ${open.length}. Falhas de workflow nas últimas 24h: ${wf.length}${wf.length ? ` (${wf.map((e) => e.subject).join(", ")})` : ""}.`,
      `Falhas de workflow sem resolução registrada (inclui antigas): ${pendingWorkflows.length}${pendingWorkflows.length ? ` — ${pendingWorkflows.slice(0, 10).map(e => e.subject).join("; ")}` : ""}.`,
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

export const crmResumo = {
  schema: crmSummaryInput,
  async run(input: z.infer<typeof crmSummaryInput> = {}): Promise<ActionResult> {
    return { text: `CRM — resumo: ${JSON.stringify({ ...await crmCommercialSummary(input), coverage: input.produto ? crmCommercialNotes.coverage : "CRM inteiro. Contas não comprovam pagamento. Divisão por produto só usa slugs válidos; agrupamentos_sem_slug informa quantos rótulos legados ficaram fora da divisão, sem alterar os totais globais." })}` };
  },
};

export const crmFunilEmails = {
  schema: crmEmailInput,
  async run(input: z.infer<typeof crmEmailInput> = {}): Promise<ActionResult> {
    return { text: `CRM — funil de e-mails: ${JSON.stringify({ ...await crmEmailFunnel(input), observation: crmCommercialNotes.pixel, rates: "Entrega sobre enviados; abertura, clique e resposta sobre entregues. Sem denominador: null, nunca zero presumido." })}` };
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

const listarMetasSchema = z.object({ escopo: z.enum(["pessoal", "empresa"]).nullish() });
export const listarMetas = {
  schema: listarMetasSchema,
  async run(v: z.infer<typeof listarMetasSchema>): Promise<ActionResult> {
    const db = await getDb();
    const rows = await db.select().from(goals).where(eq(goals.area, v.escopo ?? "pessoal")).orderBy(desc(goals.createdAt)).limit(30);
    return { text: rows.length ? rows.map(goal => `- ${goal.title} (id ${goal.id}): ${goal.current}/${goal.target} ${goal.unit ?? ""} · ${goal.status}${goal.dueDate ? ` · prazo ${goal.dueDate}` : ""}${goal.description ? ` · ${goal.description}` : ""}`).join("\n") : "Nenhuma meta retornada neste espaço." };
  },
};
const criarMetaSchema = z.object({ titulo: z.string().trim().min(1).max(200), descricao: z.string().max(2000).nullish(), alvo: z.number().positive().max(1e12), unidade: z.string().max(20).nullish(), prazo: data.refine(value => { const date = new Date(`${value}T12:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value; }, "Data inválida").nullish(), escopo: z.enum(["pessoal", "empresa"]).nullish() });
export const criarMeta = {
  schema: criarMetaSchema,
  async run(v: z.infer<typeof criarMetaSchema>): Promise<ActionResult> {
    const db = await getDb();
    const scope = v.escopo ?? "pessoal";
    const [row] = await db.insert(goals).values({title:v.titulo, description:v.descricao ?? null, target:v.alvo, current:0, metric:"number", unit:v.unidade ?? null, dueDate:v.prazo ?? null, area:scope, status:"ativa"}).returning({id:goals.id});
    return { text: `Meta criada em ${scope}: ${v.titulo} (id ${row.id}), alvo ${v.alvo} ${v.unidade ?? ""}. Progresso inicial 0, sem medições presumidas.`, action: {label:`Meta: ${v.titulo}`,href:scope === "empresa" ? "/metas?escopo=empresa" : "/metas"} };
  },
};

/* ───────────── Catálogo para a IA ───────────── */

export const metricasProduto = {
  schema: z.object({ produto: crmProductSchema.describe("Slug explícito do produto, ex.: barberias") }),
  async run({ produto }: { produto: string }): Promise<ActionResult> {
    const product = crmProductKey(produto)!;
    const result = await productMetrics(product);
    const unit = businessUnit(product);
    return { text: JSON.stringify({ product, source: "App de origem · métricas administrativas v1", businessModel: unit ? { ...MODEL_INFO[unit.model], indicators: unit.indicators } : null, ...result,
      coverage: product === "vibekit"
        ? "Comércio de compra única. commerceFunnel contém eventos anônimos, compras live registradas e acessos provisionados na janela informada. Eventos não são pessoas únicas nem etapas da mesma coorte; não dividir etapas como taxa de conversão. Visita à página de sucesso não comprova compra. Valor registrado em checkout não desconta taxas/estornos e não é receita líquida ou liquidada. observedFrom limita a cobertura; nulo não é zero. Métricas SaaS permanecem nulas. Sem cadastros e sem autorização para envio, convite ou mudança de contato."
        : product === "aglabs-app"
          ? "Modelo de créditos (AG LABS App, não confundir com aglabs = AG LABS institucional no CRM). Mesma fonte da aba de 30 dias do admin: total de cadastros e assinaturas vigentes são estoque atual; atividade, compras, consumo e gerações usam a janela móvel. credits.sales = compras sem reembolso aprovado/processado, compradores e receita registrada em centavos (não é liquidação). subscriptions = ativas, em teste, MRR estimado pelos preços atuais e por plano; sem cobertura de preço, mrrCents é null mantendo as contagens. credits = vendidos, comprados, bônus, consumidos, reembolsados; null é indisponível, nunca zero. Não há contas SaaS. Sem identidades e sem autorização para conceder créditos, gerar mídia ou mudar cobrança."
        : product === "members"
          ? "Marketplace. Usuários incluem alunos, produtores e administração; não são contas SaaS. marketplace distingue cadastro de produtor iniciado/aprovado e vendas/bruto/receita da plataforma nos meses informados em São Paulo. O mês corrente é parcial; compará-lo ao anterior completo exige explicitar essa diferença. Receita da plataforma inclui produtos próprios e comissões, com alocações conciliadas ou estimadas e estornos alocados conforme o relatório. Não afirmar que taxas nunca foram descontadas: não comprova liquidação ou saldo disponível. Não é MRR nem receita dos produtores. Sem o bloco, só users está disponível; não presumir os demais valores. Nenhuma identidade ou autorização para enviar mensagens, liberar acesso ou mudar cobrança."
          : "Contagens agregadas do app, sem cadastros. Ativas incluem testes e cortesias; payingAccounts é acesso de assinatura Stripe, não comprovante de recebimento ou receita conciliada. users é equipe com login, não clientes finais. Ativação é o critério do app, não uso recorrente. activationFunnel é estoque cumulativo por conta, com etapas na mesma unidade e filiais consolidadas; prontas sem reserva = readyForBooking menos firstAppointment. Não representa conversão por campanha, coorte ou período, nem comprova causa do abandono. Não somar contas do app com contatos do CRM.",
    }) };
  },
};

type Tool = { name: string; description: string; schema: z.ZodObject; run: (v: never) => Promise<ActionResult>; requires?: () => boolean; readOnly?: boolean };

export const crmPrioridades = {
  schema: z.object({ produto: crmProductSchema.optional() }),
  async run({ produto }: { produto?: string }): Promise<ActionResult> {
    const result = await crmPrioritySummary({ produto });
    return { text: JSON.stringify(result), ...(result.status === 'ok' ? { action: { label: 'Revisar no CRM', href: crmUrl('/actions') || '/empresa/negocios' } } : {}) };
  },
};

export const ASSISTANT_TOOLS: Tool[] = [
  { name: 'crm_prioridades', description: 'Consulta sinais comerciais por produto: tarefas vencidas, testes encerrados confirmados e oportunidades sem tarefa pendente. Use para recomendar próximos passos do negócio; cruze com metas, vault e receita. Contagem não autoriza envio nem mudança de etapa.', readOnly: true, requires: crmConfigured, ...crmPrioridades },
  { name: "metricas_produto", description: "Consulta agregados do app via CRM: contas, acesso, assinatura e ativação; no Members, usuários, produtores e vendas/receita da plataforma nos meses informados; no VibeKit, eventos anônimos, compras registradas e acesso provisionado. Eventos não são pessoas únicas; valores registrados não comprovam liquidação. Use antes de responder números do produto. Informa não conectado/indisponível/desatualizado sem presumir zero; não executa operações no app.", readOnly: true, ...metricasProduto },
  { name: "listar_metas", readOnly: true, description: "Consulta metas e objetivos do espaço atual com progresso, prazo e contexto. Use para discutir prioridades e evolução.", ...listarMetas },
  { name: "criar_meta", description: "Registra uma meta somente quando Antonio pedir para criar ou salvar, com título, indicador, alvo e prazo acordados. Sugestão de meta não autoriza gravação. Não invente linha de base ou progresso.", ...criarMeta },
  { name: "salvar_nota_vault", description: "Cria ou atualiza nota canônica do vault com controle de versão. Leia antes e forneça o SHA. Só registre mudanças de política, produto ou responsabilidade explicitamente aprovadas por Antonio; nunca salve segredos ou dados de clientes.", schema: editVaultSchema, run: editVault, requires: () => Boolean(getVaultProvider()) },
  { name: "criar_tarefa", description: "Cria uma tarefa para Antonio. Use datas absolutas (AAAA-MM-DD) calculadas a partir de hoje.", ...criarTarefa },
  { name: "listar_tarefas", readOnly: true, description: "Lista tarefas com id, prazo, prioridade e projeto. Use antes de atualizar ou concluir.", ...listarTarefas },
  { name: "atualizar_tarefa", description: "Altera ou conclui uma tarefa existente (status done = concluir). Para reorganizar, mude prazo e prioridade.", ...atualizarTarefa },
  { name: "criar_evento", description: "Cria um compromisso na agenda da Órbita.", ...criarEvento },
  { name: "ver_agenda", readOnly: true, description: "Mostra os compromissos de um período (inclui calendários assinados do iCloud/Google).", ...verAgenda },
  { name: "registrar_lancamento", description: "Registra uma despesa ou receita pessoal em Finanças.", ...registrarLancamento },
  { name: "criar_nota", description: "Cria uma nota no espaço atual da Órbita (Pessoal/Empresa), sem alterar o vault.", ...criarNota },
  { name: "buscar_notas", readOnly: true, description: "Busca notas no espaço atual da Órbita. No MCP, informe escopo empresa para as notas empresariais; padrão pessoal.", ...buscarNotas },
  { name: "buscar_no_vault", readOnly: true, description: "Busca no vault da AG LABS (manual canônico da empresa).", ...buscarNoVault },
  { name: "ler_nota_do_vault", readOnly: true, description: "Lê uma nota inteira do vault pelo caminho ou nome.", ...lerNotaDoVault },
  { name: "status_operacao", readOnly: true, description: "Estado ao vivo: sites fora do ar, incidentes, falhas de workflow, monitores e domínios.", ...statusOperacao },
  { name: "crm_resumo", readOnly: true, description: "Agregados do CRM: funil comercial, contas (não equivalem a pagantes), receita e tarefas. produto opcional (ex.: barberias); sem produto, CRM inteiro. Preserva fonte e indisponibilidade.", requires: crmConfigured, ...crmResumo },
  { name: "crm_funil_emails", readOnly: true, description: "Leitura agregada de e-mails registrados no CRM; produto, dias (1–365, padrão 30) e categoria opcionais. Sem contatos ou envios. Aberturas por pixel não comprovam leitura humana; taxas sem base são null.", requires: crmConfigured, ...crmFunilEmails },
  { name: "crm_tarefas", readOnly: true, description: "Tarefas pendentes do CRM (Maia, Léo, Antonio, técnico), das mais urgentes; filtra por responsável e situação.", requires: crmConfigured, ...crmTarefas },
  { name: "crm_buscar_contatos", readOnly: true, description: "Procura clientes e leads no CRM por nome, empresa, e-mail ou Instagram. Use antes de agir sobre um contato.", requires: crmConfigured, ...crmBuscarContatos },
  { name: "crm_contato", readOnly: true, description: "Ficha de um contato do CRM: etapa, produto, últimas interações, tarefas e receita.", requires: crmConfigured, ...crmContato },
  { name: "crm_criar_tarefa", description: "Cria tarefa no CRM com responsável. Para enviar e-mail a um contato, crie para leo com o contato e o conteúdo.", requires: crmConfigured, ...crmCriarTarefa },
  { name: "crm_concluir_tarefa", description: "Conclui tarefa do CRM com o motivo (também para cancelada ou substituída).", requires: crmConfigured, ...crmConcluirTarefa },
  { name: "crm_registrar_atividade", description: "Registra na ficha do contato uma interação que já aconteceu. Não muda a etapa do funil.", requires: crmConfigured, ...crmRegistrarAtividade },
] as Tool[];

/** Ferramentas disponíveis agora (as do CRM só aparecem com o CRM conectado). */
export function assistantTools(scope?: TaskScope, options: { readOnly?: boolean } = {}) {
  return ASSISTANT_TOOLS.filter((t) => (!options.readOnly || t.readOnly === true) && (!t.requires || t.requires()) && !(scope === "pessoal" && (t.name.startsWith("crm_") || t.name === "metricas_produto")) && !(scope === "empresa" && ["registrar_lancamento", "ver_agenda", "criar_evento"].includes(t.name)));
}

export function toolJsonSchema(t: Tool): Record<string, unknown> {
  const schema = z.toJSONSchema(t.schema, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

/** Executa uma ferramenta pelo nome com argumentos em JSON (vindos do modelo). */
export async function runAssistantTool(name: string, rawArgs: string | Record<string, unknown>, context?: { scope: TaskScope; readOnly?: boolean; signal?: AbortSignal }): Promise<ActionResult & { ok: boolean }> {
  const tool = assistantTools(context?.scope, { readOnly: context?.readOnly }).find((t) => t.name === name);
  if (!tool) return { ok: false, text: `Ferramenta desconhecida: ${name}` };
  try {
    context?.signal?.throwIfAborted();
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
    if (context && ["listar_metas", "criar_meta", "criar_nota", "buscar_notas"].includes(name) && args && typeof args === "object" && !Array.isArray(args)) {
      const input = args as Record<string,unknown>;
      if (input.escopo && input.escopo !== context.scope) return { ok:false, text:"Consulte ou registre dados no espaço atual." };
      args = { ...input, escopo: context.scope };
    }
    const parsed = tool.schema.safeParse(args ?? {});
    if (!parsed.success) return { ok: false, text: `Argumentos inválidos: ${parsed.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ")}` };
    context?.signal?.throwIfAborted();
    return { ok: true, ...(await tool.run(parsed.data as never)) };
  } catch {
    return { ok: false, text: context?.signal?.aborted ? "Consulta interrompida. Ações já iniciadas podem concluir; confira o estado antes de repetir." : "Não foi possível executar a ferramenta nesta consulta. Confira o estado antes de repetir uma escrita." };
  }
}
