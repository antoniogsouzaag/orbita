// Vínculos explícitos; nunca atribuir um canal ao negócio por semelhança de nome.
export const BARBERIAS = {
  name: "Barberias", repo: "barberias", domain: "barberias.com.br", tag: "barberias",
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
export function belongsToBarberias(url: string) {
  try { const host = new URL(url).hostname.toLowerCase(); return host === BARBERIAS.domain || host.endsWith(`.${BARBERIAS.domain}`); } catch { return false; }
}
