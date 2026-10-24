/** Marcadores emitidos pelo servidor. Texto do modelo não é recibo de execução. */
export type AiAction = { label: string; href: string };
export type AiSource = { name: string; ok: boolean };
export const ACTION_MARK = "\u001e";

function safeActionHref(href: string) {
  if (/[\\\u0000-\u0020]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//");
  try { const url = new URL(href); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; }
}

export function modelText(text: string) { return text.replaceAll(ACTION_MARK, ""); }
export function sourceMarker(source: AiSource) { return ACTION_MARK + JSON.stringify({ kind: "source", ...source }) + ACTION_MARK; }
export function actionMarker(action: AiAction) { return ACTION_MARK + JSON.stringify({ kind: "action", ...action }) + ACTION_MARK; }

export function splitActions(raw: string): { text: string; actions: AiAction[]; sources: AiSource[] } {
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
        } else if ((v.kind === undefined || v.kind === "action") && typeof v.label === "string" && v.label.length > 0 && v.label.length <= 1000 && typeof v.href === "string" && safeActionHref(v.href)) {
          actions.push({ label: v.label, href: v.href });
        }
      } catch { /* marcador incompleto ou inválido não vira recibo */ }
    }
  }
  return { text, actions, sources };
}
