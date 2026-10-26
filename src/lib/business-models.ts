/**
 * Catálogo dos negócios: cada produto tem seu modelo e seus indicadores de gestão.
 * Fonte das descrições: fichas de Produto no vault. Os dados vêm do app → CRM → Órbita, nunca por inferência.
 */

export type BusinessModel = "saas_b2b" | "marketplace" | "compra_unica" | "freemium_assinatura" | "creditos";

export const MODEL_INFO: Record<BusinessModel, { label: string; unit: string; revenue: string }> = {
  saas_b2b: { label: "SaaS B2B", unit: "Estabelecimento (conta)", revenue: "Assinatura mensal por conta" },
  marketplace: { label: "Marketplace", unit: "Produtor", revenue: "Comissão sobre vendas e produtos próprios" },
  compra_unica: { label: "Compra única", unit: "Compra", revenue: "Venda avulsa de produto digital" },
  freemium_assinatura: { label: "Freemium + assinatura", unit: "Usuário", revenue: "Plano grátis e assinatura Pro" },
  creditos: { label: "Créditos", unit: "Usuário", revenue: "Assinatura com créditos e pacotes avulsos" },
};

export type Indicator = { label: string; source: "app" | "crm"; available: boolean };

export type BusinessUnit = {
  id: string;
  name: string;
  domain: string;
  /** Marca oficial local; os arquivos e suas origens estão em public/brands/README.md. */
  logo: string;
  /** Tag das tarefas internas da Empresa ligadas ao produto. */
  tag: string;
  model: BusinessModel;
  summary: string;
  /** O que acompanhar para gerir este negócio; available=false indica lacuna de dados. */
  indicators: Indicator[];
  next: string;
};

export const BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: "barberias", name: "Barberias", domain: "barberias.com.br", logo: "/brands/barberias.png", tag: "barberias", model: "saas_b2b",
    summary: "Gestão e agendamento para barbearias. A barbearia testa, ativa a agenda e assina.",
    indicators: [
      { label: "Contas, em teste e com assinatura", source: "app", available: true },
      { label: "Ativação: profissional, serviços, agenda pronta, primeira reserva", source: "app", available: true },
      { label: "Pagamentos confirmados", source: "app", available: false },
      { label: "Funil comercial e e-mails", source: "crm", available: true },
    ],
    next: "Medir pagamentos confirmados e a perda de ativação entre agenda pronta e primeira reserva.",
  },
  {
    id: "members", name: "Members", domain: "members.ia.br", logo: "/brands/members.png", tag: "members", model: "marketplace",
    summary: "Plataforma de vendas e área de membros. Produtores vendem; a plataforma ganha comissão e vende produtos próprios.",
    indicators: [
      { label: "Faturamento bruto e vendas no mês", source: "app", available: true },
      { label: "Receita da plataforma (comissões e produtos próprios)", source: "app", available: true },
      { label: "Produtores com cadastro iniciado e aprovados", source: "app", available: true },
      { label: "Produtores com venda no período", source: "app", available: false },
      { label: "Compradores únicos", source: "app", available: false },
    ],
    next: "Medir produtores com venda e compradores únicos no período, separando cadastro aprovado de venda realizada.",
  },
  {
    id: "vibekit", name: "VibeKit", domain: "templates.aglabs.ia.br", logo: "/brands/vibekit-purple.png", tag: "vibekit", model: "compra_unica",
    summary: "Templates vendidos por compra única; o acesso é provisionado após a compra.",
    indicators: [
      { label: "Visitas, preço, cliques e checkouts (eventos anônimos)", source: "app", available: true },
      { label: "Compras registradas e acessos provisionados", source: "app", available: true },
      { label: "Valor registrado em checkout", source: "app", available: true },
    ],
    next: "Publicar a coleta, ativar o token e comparar uma navegação controlada.",
  },
  {
    id: "mecard", name: "MeCard", domain: "mecard.com.br", logo: "/brands/mecard.png", tag: "mecard", model: "freemium_assinatura",
    summary: "Cartão de visita digital. Plano grátis e Pro mensal ou anual pelo Mercado Pago.",
    indicators: [
      { label: "Usuários cadastrados", source: "app", available: true },
      { label: "Páginas publicadas", source: "app", available: false },
      { label: "Assinantes Pro pagantes (mensal e anual)", source: "app", available: false },
      { label: "Conversão grátis → Pro", source: "app", available: false },
    ],
    next: "Ativar o token e definir no app os indicadores de páginas publicadas e Pro pagante.",
  },
  {
    // No CRM a chave "aglabs" é o AG LABS institucional; as métricas do app usam "aglabs-app".
    id: "aglabs-app", name: "AG LABS App", domain: "aglabs.app.br", logo: "/brands/aglabs-app-purple.png", tag: "aglabs", model: "creditos",
    summary: "Geração de mídia com IA. Créditos por assinatura mensal ou pacote avulso; contas novas ganham bônus.",
    indicators: [
      { label: "Usuários, ativos em 30 dias e que geraram", source: "app", available: true },
      { label: "Compras, compradores e receita registrada em 30 dias", source: "app", available: true },
      { label: "Assinaturas ativas, em teste, MRR e por plano", source: "app", available: true },
      { label: "Créditos vendidos, bônus, consumidos e reembolsados", source: "app", available: true },
      { label: "Gerações com falha e custo por geração", source: "app", available: false },
    ],
    next: "Medir falhas e custo por geração; validar privacidade e limite de créditos antes do MCP de mídia.",
  },
  {
    id: "viajeki", name: "Viajeki", domain: "viajeki.com.br", logo: "/brands/viajeki.png", tag: "viajeki", model: "freemium_assinatura",
    summary: "Roteiros de viagem com IA. Plano Essencial grátis, Pro anual e compra de roteiro.",
    indicators: [
      { label: "Usuários e roteiros criados", source: "app", available: false },
      { label: "Assinantes Pro e roteiros comprados", source: "app", available: false },
      { label: "Conversão grátis → pago", source: "app", available: false },
    ],
    next: "Definir as métricas no app e criar o endpoint para o CRM.",
  },
];

export const businessUnit = (id: string) => BUSINESS_UNITS.find((unit) => unit.id === id);
