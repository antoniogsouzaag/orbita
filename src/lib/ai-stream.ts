/** Separa o texto da IA dos marcadores de ação (\u001e{json}\u001e) enviados no mesmo fluxo. */
export type AiAction = { label: string; href: string };
const MARK = "\u001e";

export function splitActions(raw: string): { text: string; actions: AiAction[] } {
  const actions: AiAction[] = [];
  const parts = raw.split(MARK);
  let text = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) text += parts[i];
    else if (i < parts.length - 1) {
      try {
        actions.push(JSON.parse(parts[i]) as AiAction);
      } catch {}
    } // marcador ainda incompleto no fim do fluxo: ignora até chegar o resto
  }
  return { text, actions };
}
