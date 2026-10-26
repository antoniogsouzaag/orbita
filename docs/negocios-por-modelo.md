# Negócios por modelo

Cada aplicação da AG LABS tem um modelo de negócio próprio. A Órbita centraliza a visão de todos, mas **não força o mesmo formato**: cada produto informa os indicadores do seu modelo.

## Fluxo

App (fonte da verdade) → CRM (`crm_metricas_produto`, valida e projeta) → Órbita (`/empresa/negocios/<produto>` e ferramenta `metricas_produto` da ORBE).

O contrato v1 é comum a todos: `product`, `generatedAt`, `window` e os campos de conta SaaS (`metrics`). Cada modelo acrescenta um **bloco próprio**, validado no CRM e de novo na Órbita, com projeção fechada (nada fora do contrato atravessa). Campos que não se aplicam ao modelo ficam `null` de propósito; o CRM recusa números SaaS para produtos que não são SaaS.

| Produto | Modelo | Unidade | Bloco | Situação em 26/10/2026 |
| --- | --- | --- | --- | --- |
| Barberias | SaaS B2B | Barbearia (conta) | `metrics` + `activationFunnel` | coleta ativa e conferida |
| Members | Marketplace | Produtor | `marketplace` (bruto, receita da plataforma e vendas do mês atual/anterior; produtores; usuários) | members#51 e crm-dash#51 integrados; falta publicação/conferência do app e confirmar configuração do token |
| VibeKit | Compra única | Compra | `commerceFunnel` (eventos anônimos, compras, acessos, valor em checkout) | código do Codex; falta publicar e ativar |
| MeCard | Freemium + assinatura Pro | Usuário | só `users` hoje | código pronto; falta token e indicadores de Pro |
| AG LABS App (`aglabs-app`) | Créditos | Usuário | `credits` (usuários, compras e receita registrada, assinaturas e MRR por plano, créditos vendidos/bônus/consumidos/reembolsados, gerações; janela de 30 dias do admin) | código no app, CRM e Órbita; falta publicar no Render e ativar o token |
| Viajeki | Freemium + Pro anual e roteiro avulso | Usuário | a definir | sem coleta |

O catálogo (modelo, unidade, receita, indicadores que importam e lacunas) está em `src/lib/business-models.ts`. O status de conexão não é fixo no código: a página consulta o CRM ao vivo e mostra coleta ativa, pendente ou indisponível.

## Como adicionar ou evoluir um produto

1. Definir no app os indicadores do modelo, usando as mesmas consultas do painel administrativo do app (os números devem bater por construção).
2. Enviar um bloco próprio no endpoint `/api/integrations/crm/metrics`, com definições documentadas no repositório do app. Falha ou dado ausente → 503, nunca zero.
3. No CRM: projeção fechada do bloco em `lib/<modelo>.ts`, regra de que campos SaaS ficam nulos quando não se aplicam, cartão na tela Ecossistema.
4. Na Órbita: o bloco em `src/lib/product-metrics.ts`, a visão em `src/components/empresa/product-app-metrics.tsx` e os indicadores em `business-models.ts`.
5. Ativar: token exclusivo (≥ 32 caracteres) em `CRM_METRICS_TOKEN` no app e na entrada do produto em `APP_METRICS_SOURCES` do CRM. Conferir com o painel do app antes de declarar integrado.

Segredos ficam apenas no servidor, nos painéis autorizados de Vercel, EasyPanel ou Cloudflare; nunca em variáveis públicas, Git, mensagens ou logs. Configuração e conferência autenticada ainda não foram realizadas nesta entrega.
