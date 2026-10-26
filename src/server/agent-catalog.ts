import "server-only";
import { CORE_AGENT_TOOLS, agentManualMarkdown } from "@/lib/agent-handbook";
import { ASSISTANT_TOOLS } from "./assistant";
export function agentToolCatalog() {
  return [...CORE_AGENT_TOOLS, { name: "contexto_pessoal", scope: "admin", description: "Contexto pessoal de tarefas, hábitos, agenda, metas e saúde" }, ...ASSISTANT_TOOLS.filter(t => !t.orbeOnly && t.name !== "buscar").map(t => ({ name: `orbita_${t.name}`, scope: "admin", description: `${t.readOnly ? "Leitura" : "Escrita"}${t.requires ? " · depende da conexão" : ""}: ${t.description}` }))];
}
export function fullAgentManualMarkdown() { return agentManualMarkdown(agentToolCatalog()); }
