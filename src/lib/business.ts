// Vínculos explícitos; nunca atribuir um canal ao negócio por semelhança de nome.
export const BARBERIAS = {
  id: "barberias", name: "Barberias", repo: "barberias", domain: "barberias.com.br", tag: "barberias", logo: "/brands/barberias.png",
  postizGroupId: "66f42ad3-dd35-40fa-a261-d632f680e18e",
  pages: [
    { label: "O sistema", path: "/sobre", purpose: "Apresentação para donos de barbearia" },
    { label: "Planos", path: "/planos", purpose: "Oferta e escolha do plano" },
    { label: "Criar conta", path: "/signup", purpose: "Início do teste do gestor" },
    { label: "Demonstração", path: "/b/barber-ag", purpose: "Experiência do cliente que agenda" },
    { label: "Ajuda", path: "/ajuda", purpose: "Configuração e suporte ao uso" },
    { label: "Barbearias", path: "/barbearias", purpose: "Descoberta de estabelecimentos" },
  ],
};

// IDs conferidos na lista de grupos do Postiz. O nome de uma conta não define seu negócio.
export const SOCIAL_ENTITIES: Record<string, { id: string; name: string; logo?: string; businessHref?: string }> = {
  [BARBERIAS.postizGroupId]: { id: BARBERIAS.id, name: BARBERIAS.name, logo: BARBERIAS.logo, businessHref: "/empresa/negocios/barberias" },
  "8b2560ec-d5c9-4290-9bf7-4b71555ed766": { id: "ag-labs", name: "AG LABS", logo: "/brands/aglabs-app-purple.png" },
  "9d72757a-bd07-44a6-b362-29b8535b6ca9": { id: "members", name: "Members", logo: "/brands/members.png", businessHref: "/empresa/negocios/members" },
  "93b212db-9b05-4841-a6ba-e0bcc2c70837": { id: "mecard", name: "MeCard", logo: "/brands/mecard.png", businessHref: "/empresa/negocios/mecard" },
};

/** Marcas do ecossistema ainda sem grupo no Postiz. VibeKit publica pelo perfil institucional do AG LABS. */
export const SOCIAL_PENDING_ENTITIES = [
  { id: "viajeki", name: "Viajeki", logo: "/brands/viajeki.png" },
] as const;

export function socialGroupId(entity: string) {
  return Object.entries(SOCIAL_ENTITIES).find(([groupId, item]) => entity === item.id || entity === groupId)?.[0] ?? entity;
}

export type GroupableChannel = { id: string; disabled?: boolean; customer?: { id: string; name: string } | null };
export function groupSocialChannels<T extends GroupableChannel>(channels: T[]) {
  const groups = new Map<string, { id: string; key: string; name: string; logo?: string; businessHref?: string; channels: T[] }>();
  for (const channel of channels) {
    const id = channel.customer?.id ?? "ungrouped";
    const entity = SOCIAL_ENTITIES[id];
    if (!groups.has(id)) groups.set(id, { id, key: entity?.id ?? id, name: entity?.name ?? channel.customer?.name ?? "Sem entidade", logo: entity?.logo, businessHref: entity?.businessHref, channels: [] });
    groups.get(id)!.channels.push(channel);
  }
  return [...groups.values()].sort((a, b) => a.id === "ungrouped" ? 1 : b.id === "ungrouped" ? -1 : a.name.localeCompare(b.name, "pt-BR"));
}
export function belongsToBarberias(url: string) {
  try { const host = new URL(url).hostname.toLowerCase(); return host === BARBERIAS.domain || host.endsWith(`.${BARBERIAS.domain}`); } catch { return false; }
}

/** Prioriza Instagram conectado; seleção explícita de outro canal continua válida. */
export function preferredSocialChannel<T extends { disabled?: boolean; identifier: string }>(channels: T[]) {
  return channels.find(channel => !channel.disabled && /^instagram(?:-|$)/i.test(channel.identifier)) ?? channels.find(channel => !channel.disabled) ?? channels[0];
}
