import { crmCall, crmConfigured, crmUrl, type CrmTask } from "@/server/crm";
import { z } from "zod";
import { today, shiftDate } from "@/lib/dates";
import type { TaskView } from "@/server/tasks";

const responseSchema = z.object({ total: z.number().int().nonnegative(), tarefas: z.array(z.object({
  id: z.string(), titulo: z.string(), prazo: z.string().nullable(), prioridade: z.string().nullable(), vencida: z.boolean(),
  contato: z.object({id:z.string(),nome:z.string().nullable()}).nullable(),
})).max(50) });

export async function CommercialTaskList({ view, product }: { view: TaskView; product?: string }) {
  if (!crmConfigured() || view === "concluidas" || view === "andamento") return null;
  let result: z.infer<typeof responseSchema> | null = null;
  try {
    result = responseSchema.parse(await crmCall<{total:number;tarefas:CrmTask[]}>("crm_tarefas", {responsavel:"antonio",situacao:view === "atrasadas" ? "vencidas" : "todas",limite:50,...(product && /^[a-z0-9_-]{2,60}$/.test(product) ? {produto:product} : {})}));
  } catch {}
  if (!result) return <p role="status" className="mt-5 text-xs text-warning">Tarefas comerciais temporariamente indisponíveis. As tarefas internas permanecem disponíveis.</p>;
    const date = today();
    const tasks = result.tarefas.filter(task => view === "semdata" ? !task.prazo : view === "hoje" ? !!task.prazo && task.prazo <= date : view === "proximos" ? !!task.prazo && task.prazo > date && task.prazo <= shiftDate(date, 14) : true);
    return <section className="mt-6" aria-label="Tarefas comerciais de Antonio"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Comercial <span className="ml-2 text-xs font-normal text-muted">{tasks.length} nesta visão · CRM</span></h2><a href={crmUrl("/tasks") ?? "#"} target="_blank" rel="noopener noreferrer" className="text-xs text-accent">Abrir origem ↗</a></div><ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">{tasks.map(task => <li key={task.id}><a href={crmUrl("/tasks") ?? "#"} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-3 text-sm hover:text-accent"><span className="min-w-0"><span className="block">{task.titulo}</span>{task.contato?.nome && <span className="mt-1 block text-xs text-muted">{task.contato.nome}</span>}</span><span className={`shrink-0 text-xs ${task.vencida ? "text-warning" : "text-faint"}`}>{task.prazo ?? "Sem prazo"} ↗</span></a></li>)}{!tasks.length && <li className="py-3 text-xs text-muted">Nenhuma tarefa comercial nesta visão.</li>}</ul><p className="mt-2 text-[10px] text-faint">Fonte: CRM · responsável Antonio · consulta {new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})} · até 50 de {result.total} pendentes. Filtros aplicados à amostra. Edição na origem; não há cópia nem sincronização de registros.</p></section>;
}
