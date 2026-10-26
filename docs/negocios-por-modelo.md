# Negócios por modelo

Cada aplicação da AG LABS tem um modelo de negócio próprio. A Órbita centraliza a visão de todos, mas **não força o mesmo formato**: cada produto informa os indicadores do seu modelo.

## Fluxo

App (fonte da verdade) → CRM (`crm_metricas_produto`, valida e projeta) → Órbita (`/empresa/negocios/<produto>` e ferramenta `metricas_produto` da ORBE).

O contrato v1 é comum a todos: `product`, `generatedAt`, `window` e os campos de conta SaaS (`metrics`). Cada modelo acrescenta um **bloco próprio**, validado no CRM e de novo na Órbita, com projeção fechada (nada fora do contrato atravessa). Campos que não se aplicam ao modelo ficam `null` de propósito; o CRM recusa números SaaS para produtos que não são SaaS.

| Produto | Modelo | Unidade | Bloco | Situação em 26/10/2026 |
| --- | --- | --- | --- | --- |
| Barberias | SaaS B2B | Barbearia (conta) | `metrics` + `activationFunnel` | coleta ativa e conferida |
| Members | Marketplace | Produtor | `marketplace` (bruto, receita da plataforma e vendas do mês atual/anterior; produtores; usuários) | coleta ativa; financeiro conferido com `/plataforma` e snapshot recebido na Órbita |
| VibeKit | Compra única | Compra | `commerceFunnel` (eventos anônimos, compras, acessos, valor em checkout) | código do Codex; falta publicar e ativar |
| MeCard | Freemium + assinatura Pro | Usuário | só `users` hoje | código pronto; falta token e indicadores de Pro |
| AG LABS App (`aglabs-app`) | Créditos | Usuário | `credits` (usuários, compras e receita registrada, assinaturas e MRR por plano, créditos vendidos/bônus/consumidos/reembolsados, gerações; janela de 30 dias do admin) | coleta ativa; visão geral, assinaturas e créditos conferidos com admin 30d e Órbita |
| Viajeki | Freemium + Pro anual e roteiro avulso | Usuário | a definir | sem coleta |

O catálogo (modelo, unidade, receita, indicadores que importam e lacunas) está em `src/lib/business-models.ts`. O status de conexão não é fixo no código: a página consulta o CRM ao vivo e mostra coleta ativa, pendente ou indisponível.

## Como adicionar ou evoluir um produto

1. Definir no app os indicadores do modelo, usando as mesmas consultas do painel administrativo do app (os números devem bater por construção).
2. Enviar um bloco próprio no endpoint `/api/integrations/crm/metrics`, com definições documentadas no repositório do app. Falha ou dado ausente → 503, nunca zero.
3. No CRM: projeção fechada do bloco em `lib/<modelo>.ts`, regra de que campos SaaS ficam nulos quando não se aplicam, cartão na tela Ecossistema.
4. Na Órbita: o bloco em `src/lib/product-metrics.ts`, a visão em `src/components/empresa/product-app-metrics.tsx` e os indicadores em `business-models.ts`.
5. Ativar: token exclusivo (≥ 32 caracteres) em `CRM_METRICS_TOKEN` no app e na entrada do produto em `APP_METRICS_SOURCES` do CRM. Se o segredo existente não puder ser relido, preservar seu valor e acrescentar fontes em `APP_METRICS_SOURCES_EXTRA`, no mesmo formato. Preservar também entradas adicionais existentes; produtos duplicados são recusados. Usar Secret somente em Production, publicar e conferir com o painel do app antes de declarar integrado.

Segredos ficam apenas no servidor, nos painéis autorizados de Vercel, EasyPanel, Render ou Cloudflare; nunca em variáveis públicas, Git, mensagens ou logs.

## Conferência de ativação — 26/10/2026, 12:45 BRT

Members e AG LABS receberam tokens exclusivos nos seus servidores. O Secret original do CRM foi preservado e as duas entradas foram adicionadas em `APP_METRICS_SOURCES_EXTRA`, somente em Production. A [PR CRM 54](https://github.com/aglabs-core/crm-dash/pull/54) passou no CI, nos 139 testes de contrato e 44 de interface, build e auditoria. Produção Vercel `BcLhzM4Q2Ani15Un6obhGAgN7Pr6`, commit `38700ea`, Ready/Current. Members: EasyPanel Success às 15:31:55 UTC. AG LABS: Render `dep-dbfn6qnavr4c73fdrqmg`, commit `e61831e`, Live.

Os dois endpoints retornaram 401 sem token e 200 autenticados, com `Cache-Control: no-store`. Os cartões da Órbita receberam os mesmos agregados pelo CRM. Members: mês corrente no fuso de São Paulo, zero vendas, bruto e receita da plataforma; dez usuários, três novos em 30 dias e zero produtores com cadastro iniciado/aprovado. O financeiro foi conferido com `/plataforma`. AG LABS: admin 30d com 24 usuários, 11 ativos, cinco geradores, seis gerações, 92 créditos consumidos e zero compras, receita, assinaturas e trials; conferência nas abas Visão geral, Assinaturas e Créditos. Barberias continuou respondendo pela configuração original (28 contas), sem regressão da fonte.

Esses zeros são valores dos relatórios, não comprovam ausência de movimentação nos provedores. Nenhum pagamento, geração paga, mensagem ou alteração de acesso foi usado em teste. Homologação de chargebacks e estornos permanece uma entrega separada. As orientações do catálogo passam às lacunas seguintes: compradores/produtores vendedores no Members e falhas/custo por geração no AG LABS; não pedem repetir a ativação já conferida.

## Operação assistida

O [desenho de diagnóstico e operação assistida do Barberias](./barberias-diagnostico-operacao-assistida.md) define a primeira fatia somente leitura, reutilização dos serviços do painel, isolamento por tenant e os gates de uma fase futura de comandos. A entrega é de planejamento; não ativa MCP nem concede acesso a clientes.

A [preparação do MCP Members](./members-mcp-catalogo-rascunhos.md) define catálogo/ofertas por criador, resumo por papel/período, link com prontidão explícita e uma fase posterior de rascunhos idempotentes. A oferta de rascunho deve nascer inativa atomicamente; a criação atual de oferta ativa não pode ser exposta diretamente como comando de rascunho. Identidade delegada, implementação e homologação permanecem etapas próprias.
