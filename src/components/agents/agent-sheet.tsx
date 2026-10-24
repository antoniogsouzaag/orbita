"use client";

import { MarkdownView, slugHeading } from "@/components/markdown/view";

/**
 * Ficha do agente vinda do vault. Os wikilinks chegam já resolvidos pelo servidor
 * (alvo → caminho), então só os links desta nota viajam para o navegador.
 */
export function AgentSheet({ body, links, embeds }: { body: string; links: Record<string, string>; embeds: Record<string, string> }) {
  const lower = Object.fromEntries(Object.entries(links).map(([k, v]) => [k.toLowerCase(), v]));
  return (
    <MarkdownView
      content={body}
      resolve={(target, heading) => {
        const path = links[target] ?? lower[target.toLowerCase()];
        return path ? `/vault?p=${encodeURIComponent(path)}${heading ? `#${slugHeading(heading)}` : ""}` : null;
      }}
      embedUrl={(target) => (embeds[target] ? `/api/vault/raw?p=${encodeURIComponent(embeds[target])}` : null)}
    />
  );
}
