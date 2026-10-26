/** Marcadores emitidos pelo servidor. Texto do modelo não é recibo de execução. */
export type AiAction = { label: string; href: string };
export type AiSource = { name: string; ok: boolean };
export const ACTION_MARK = "\u001e";
/** Only the server emits this after settling the provider and tool loop. */
export const STREAM_END_MARK = ACTION_MARK + '{"kind":"end"}' + ACTION_MARK;

export function actionOrigins(url: string | null): string[] {
  try { const parsed = new URL(url ?? ""); return parsed.protocol === "https:" && !parsed.username && !parsed.password ? [parsed.origin] : []; } catch { return []; }
}

function safeActionHref(href: string, trustedOrigins: string[]) {
  if (/[\\\u0000-\u0020]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password && trustedOrigins.includes(url.origin); } catch { return false; }
}

export function modelText(text: string) { return text.replaceAll(ACTION_MARK, ""); }
export function sourceMarker(source: AiSource) { return ACTION_MARK + JSON.stringify({ kind: "source", ...source }) + ACTION_MARK; }
export function actionMarker(action: AiAction) { return ACTION_MARK + JSON.stringify({ kind: "action", ...action }) + ACTION_MARK; }

/** Etapa de execução emitida pelo servidor: início e fim de cada ferramenta. */
export type AiStepStatus = "running" | "done" | "failed";
export type AiStep = { id: number; name: string; status: AiStepStatus; write: boolean };
export type ChatPart = { type: "text"; text: string } | { type: "step"; step: AiStep };
export function stepMarker(step: AiStep) { return ACTION_MARK + JSON.stringify({ kind: "step", ...step }) + ACTION_MARK; }

/** Texto e etapas na ordem em que chegaram, para mostrar o status ao vivo. */
export function chatParts(raw: string): ChatPart[] {
  const parts: ChatPart[] = [];
  const steps = new Map<number, AiStep>();
  const chunks = raw.split(ACTION_MARK);
  const pushText = (text: string) => { if (!text) return; const last = parts.at(-1); if (last?.type === "text") last.text += text; else parts.push({ type: "text", text }); };
  for (let i = 0; i < chunks.length; i++) {
    if (i % 2 === 0) { pushText(chunks[i]); continue; }
    if (i === chunks.length - 1) continue;
    try {
      const v = JSON.parse(chunks[i]) as Record<string, unknown> | null;
      if (!v || v.kind !== "step" || typeof v.id !== "number" || typeof v.name !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(v.name) || !["running", "done", "failed"].includes(v.status as string)) continue;
      const known = steps.get(v.id);
      if (known) { known.status = v.status as AiStepStatus; continue; }
      const step: AiStep = { id: v.id, name: v.name, status: v.status as AiStepStatus, write: v.write === true };
      steps.set(v.id, step);
      parts.push({ type: "step", step });
    } catch { /* marcador inválido é ignorado */ }
  }
  return parts;
}

export function splitActions(raw: string, trustedOrigins: string[] = []): { text: string; actions: AiAction[]; sources: AiSource[] } {
  const actions: AiAction[] = [], sources: AiSource[] = [];
  const parts = raw.split(ACTION_MARK);
  let text = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) text += parts[i];
    else if (i < parts.length - 1) {
      try {
        const value: unknown = JSON.parse(parts[i]);
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const v = value as Record<string, unknown>;
        if (v.kind === "source" && typeof v.name === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(v.name) && typeof v.ok === "boolean") {
          if (!sources.some(s => s.name === v.name && s.ok === v.ok)) sources.push({ name: v.name, ok: v.ok });
        } else if ((v.kind === undefined || v.kind === "action") && typeof v.label === "string" && v.label.length > 0 && v.label.length <= 1000 && typeof v.href === "string") {
          // Não perder o recibo da escrita só porque seu link não é confiável.
          actions.push({ label: v.label, href: safeActionHref(v.href, trustedOrigins) ? v.href : "/integracoes" });
        }
      } catch { /* marcador incompleto ou inválido não vira recibo */ }
    }
  }
  return { text, actions, sources };
}
