/**
 * Causa provável de uma falha de workflow. Serve para decidir o próximo passo sem abrir a execução:
 * credencial vencida pede renovação, serviço fora do ar pede espera, dado inválido pede tratar o item.
 */
export const FAILURE_CAUSES = {
  credencial: "Credencial ou token expirado, inválido ou sem permissão",
  servico_externo: "Serviço externo fora do ar, lento ou recusando a conexão",
  dado_invalido: "Dado de entrada inválido ou inexistente, como número sem WhatsApp ou campo vazio",
  limite: "Limite de uso, cota ou taxa de requisições excedido",
  logica: "Erro na lógica ou na configuração do próprio workflow",
} as const;

export type FailureCause = keyof typeof FAILURE_CAUSES;

export const FAILURE_CAUSE_LABEL: Record<FailureCause, string> = {
  credencial: "credencial",
  servico_externo: "serviço externo",
  dado_invalido: "dado de entrada",
  limite: "limite de uso",
  logica: "lógica do workflow",
};

export const isFailureCause = (value: unknown): value is FailureCause => typeof value === "string" && value in FAILURE_CAUSES;

/** Tira o que identifica pessoa ou dá acesso antes de o texto sair do servidor: e-mails, telefones, segredos em URL e tokens longos. */
export function sanitizeFailureText(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(/([?&][\w.-]+=)[^&\s"']+/g, "$1[valor]")
    .replace(/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi, "$1 [token]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[token]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[numero]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}

const RULES: [FailureCause, RegExp][] = [
  ["dado_invalido", /"exists"\s*:\s*false|n[uú]mero (inv[aá]lido|sem whatsapp)|invalid (phone|number|email)|is required|cannot read propert/i],
  ["limite", /\b429\b|rate.?limit|too many requests|quota|limite (de uso|excedido)/i],
  ["credencial", /\b40[13]\b|unauthori[sz]ed|forbidden|invalid.{0,20}(token|credential|api.?key|signature)|token.{0,20}(expired|expirad|inv[aá]lid)|access denied|authentication failed/i],
  ["servico_externo", /\b50[234]\b|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|timed? ?out|bad gateway|service unavailable|gateway timeout/i],
];

/** Causas que a própria mensagem entrega. O que não casa com nenhuma regra fica para o classificador. */
export function ruleFailureCause(message: string | null | undefined): FailureCause | null {
  const text = message ?? "";
  return RULES.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}
