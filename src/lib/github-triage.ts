/** Etiquetas descrevem a triagem; não autorizam o app a executar ou mesclar código. */
export type GithubStage = "decision" | "execution" | "triage";
export const GITHUB_STAGES: { id: GithubStage; label: string; description: string }[] = [
  { id: "decision", label: "Decisão de Antonio", description: "Mudança estrutural, diretriz, regra do negócio ou impacto sensível ainda sem decisão." },
  { id: "execution", label: "Fila de execução", description: "Correção ou melhoria delimitada; permanece aberta até implementação e verificação." },
  { id: "triage", label: "A classificar", description: "Proposta legada ainda não reconciliada. O título não determina risco nem aprovação." },
];
export function issueStage(labels: string[] = []): GithubStage {
  const names = labels.map(label => label.toLowerCase());
  // Conflito conservador: decisão explícita nunca some atrás de execução/aprovado.
  if (names.includes("decisao")) return "decision";
  if (names.includes("execucao") || names.includes("aprovado")) return "execution";
  return "triage";
}
export function stageLabel(item: { kind: string; stage?: GithubStage; draft?: boolean; blocked?: boolean }) {
  if (item.kind === "pr") return item.draft ? "PR rascunho" : "PR aberto";
  const name = GITHUB_STAGES.find(stage => stage.id === (item.stage ?? "triage"))!.label;
  return name + (item.blocked ? " · bloqueada" : "");
}
