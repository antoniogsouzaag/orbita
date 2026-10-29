import { Activity, BarChart3, BookOpen, Bot, Brain, History, Send, CalendarDays, CheckSquare, FolderKanban, Mail, NotebookPen, Target, Users, Wallet, Wrench, type LucideIcon } from "lucide-react";
import type { AiStep } from "@/lib/ai-stream";
import type { TraceNode } from "@/components/ui/ai-agent-response";

/** [em andamento, concluída] para cada ferramenta da ORBE. */
const LABELS: Record<string, [string, string]> = {
  listar_tarefas: ["Consultando tarefas", "Consultou tarefas"],
  consultar_tarefa: ["Lendo histórico da tarefa", "Leu histórico da tarefa"],
  criar_tarefa: ["Criando tarefa", "Criou tarefa"],
  atualizar_tarefa: ["Atualizando tarefa", "Atualizou tarefa"],
  ver_agenda: ["Consultando agenda", "Consultou agenda"],
  criar_evento: ["Criando compromisso", "Criou compromisso"],
  registrar_lancamento: ["Registrando lançamento", "Registrou lançamento"],
  listar_metas: ["Consultando metas", "Consultou metas"],
  criar_meta: ["Criando meta", "Criou meta"],
  criar_nota: ["Criando nota", "Criou nota"],
  buscar_notas: ["Buscando notas", "Buscou notas"],
  consultar_nota: ["Lendo nota da Órbita", "Leu nota da Órbita"],
  vincular_nota_projeto: ["Vinculando nota ao projeto", "Organizou projeto da nota"],
  buscar: ["Buscando nas fontes", "Consultou as fontes"],
  ler_nota_do_vault: ["Lendo nota do vault", "Leu nota do vault"],
  salvar_nota_vault: ["Salvando nota no vault", "Salvou nota no vault"],
  status_operacao: ["Verificando a operação", "Verificou a operação"],
  metricas_produto: ["Consultando métricas do produto", "Consultou métricas do produto"],
  crm_resumo: ["Consultando resumo do CRM", "Consultou resumo do CRM"],
  crm_prioridades: ["Analisando prioridades comerciais", "Analisou prioridades comerciais"],
  crm_funil_emails: ["Consultando funil de e-mails", "Consultou funil de e-mails"],
  crm_tarefas: ["Consultando tarefas do CRM", "Consultou tarefas do CRM"],
  crm_buscar_contatos: ["Buscando contatos", "Buscou contatos"],
  crm_contato: ["Abrindo ficha do contato", "Abriu ficha do contato"],
  crm_criar_tarefa: ["Criando tarefa no CRM", "Criou tarefa no CRM"],
  crm_concluir_tarefa: ["Concluindo tarefa no CRM", "Concluiu tarefa no CRM"],
  crm_registrar_atividade: ["Registrando atividade", "Registrou atividade"],
  listar_projetos: ["Consultando projetos", "Consultou projetos"],
  criar_projeto: ["Criando projeto", "Criou projeto"],
  memoria: ["Atualizando a memória", "Atualizou a memória"],
  buscar_conversas: ["Buscando em conversas anteriores", "Buscou em conversas anteriores"],
  pedir_a_agente: ["Enviando pedido ao agente", "Enviou pedido ao agente"],
  status_agentes: ["Consultando os agentes", "Consultou os agentes"],
};

function iconFor(name: string): LucideIcon {
  if (name === "memoria") return Brain;
  if (name === "buscar_conversas") return History;
  if (name === "pedir_a_agente") return Send;
  if (name === "status_agentes") return Bot;
  if (name.includes("projeto")) return FolderKanban;
  if (name === "crm_funil_emails") return Mail;
  if (name.startsWith("crm_")) return Users;
  if (name.includes("vault")) return BookOpen;
  if (name.includes("tarefa")) return CheckSquare;
  if (name.includes("agenda") || name.includes("evento")) return CalendarDays;
  if (name.includes("meta")) return name.startsWith("metricas") ? BarChart3 : Target;
  if (name.includes("nota")) return NotebookPen;
  if (name.includes("lancamento")) return Wallet;
  if (name === "status_operacao") return Activity;
  return Wrench;
}

const humanize = (name: string) => name.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

export function stepNode(step: AiStep): TraceNode {
  const [running, done] = LABELS[step.name] ?? [humanize(step.name), humanize(step.name)];
  return {
    id: step.id,
    primary: step.status === "running" ? `${running}…` : step.status === "failed" ? `Falhou: ${running.toLowerCase()}` : done,
    secondary: step.write ? "escrita" : undefined,
    status: step.status,
    icon: iconFor(step.name),
    iconClassName: step.write ? "text-warning" : "text-muted",
  };
}

/** Rótulo do cabeçalho enquanto a etapa atual roda. */
export function workingLabel(step: AiStep | undefined) {
  if (!step || step.status !== "running") return "Pensando…";
  return `${(LABELS[step.name] ?? [humanize(step.name)])[0]}…`;
}
