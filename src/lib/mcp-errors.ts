import { z } from "zod";

/** Unknown exceptions may contain provider bodies, credentials or private payloads. */
export function mcpErrorMessage(error: unknown) {
  if (error instanceof z.ZodError) return `Parâmetros inválidos: ${error.issues.slice(0, 4).map(issue => `${issue.path.join(".") || "entrada"}: ${issue.code}`).join("; ")}. Confira o schema da ferramenta.`;
  return "Não foi possível executar a ferramenta nesta consulta. Confira o estado antes de repetir uma escrita.";
}
