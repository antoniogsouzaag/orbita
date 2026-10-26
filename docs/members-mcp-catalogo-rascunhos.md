# Members: preparação do MCP de catálogo, rascunho, oferta e link

Proposta técnica de 26/10/2026 para a tarefa `ef1b076a-2715-462e-97b8-059b0ac60fbc`, assumida por Codex. Este documento conclui a preparação solicitada: nenhuma ferramenta foi ativada, nenhuma identidade delegada foi criada e nenhum produto, oferta ou cobrança foi gravado. Implementação e homologação são etapas posteriores.

## Código de referência

Base conferida: [Members master b68d62b42230106a2c3c55d0058b438dea098ca8](https://github.com/aglabs-core/members/tree/b68d62b42230106a2c3c55d0058b438dea098ca8). As pastas `lib`, `app` e `supabase` da cópia analisada não diferem desse commit. O grafo local foi atualizado antes do mapeamento; nenhum banco ou provedor real foi consultado.

| Fonte | O que reutilizar ou preservar |
| --- | --- |
| `lib/supabase/queries.ts`: `getProfile`, `getCreatorCourses`, `getCourseOffers`, `getMarketplaceCourseBySlug` | Perfil de venda, catálogo, ofertas e seleção da oferta pública. Projeção própria deve distinguir falha de consulta de lista vazia. |
| `lib/studio/course-write.ts`: `authorizeCourseWrite` | Sessão validada por `auth.getUser`, curso identificado e permissão do criador/admin. Cliente privilegiado não substitui essa autorização. |
| `lib/products/create.ts`: `insertProductWithUniqueSlug` e Actions em `app/(app)/studio/*/novo/actions.ts` | Validação do tipo/entrega, criador autenticado, `status=draft` e tratamento de colisão de slug. Colisão não equivale a idempotência do comando. |
| `app/(app)/studio/cursos/[slug]/offer-actions.ts` | Preço em centavos, ciclo/trial, parcelas, URL de sucesso e RPCs de oferta. Extrair serviço de domínio; não chamar uma Action HTTP como API genérica. |
| `supabase/migrations/005001_competitive_fees_and_minimum_ticket.sql`: `create_course_offer` | A definição analisada insere `active=true` e torna a primeira oferta padrão. Não é uma primitiva de criação de oferta inativa. Conferir também as migrações posteriores antes de implementar. |
| `app/(app)/studio/cursos/[slug]/modules-actions.ts`: `saveCourseMetadata` | Gates de publicação: oferta ativa, conteúdo/entrega compatível, conta financeira e coprodução. |
| `app/(checkout)/checkout/[slug]/page.tsx` e `lib/supabase/queries.ts` | Link `/checkout/<slug>?offer=<uuid>`; produto publicado e oferta disponível. Não chamar checkout Pix/cartão para testar um link. |
| `app/(app)/financeiro/page.tsx` | RPCs `get_creator_financial_period_report` e `get_creator_financial_history_page`; papel e período explícitos. O relatório do criador não é o agregado global da plataforma. |

## Fatia inicial: consultas por criador

Propor um adaptador fino sobre serviços internos compartilhados com o painel. Criar contratos fechados, validação de entrada e autorização antes das consultas. A primeira entrega deve ser somente leitura; as ferramentas abaixo são **nomes e contratos propostos**, ainda não disponíveis.

| Ferramenta | Entrada limitada | Projeção |
| --- | --- | --- |
| `members_contexto_criador` | Sem seletor arbitrário de usuário | Papel efetivo, `canSell`, capacidades concedidas e bloqueios conhecidos; sem contato ou dados da subconta. |
| `members_catalogo` | Cursor e limite até 50, filtros de tipo/status permitidos | ID, slug, título, tipo, formato, entrega e status dos produtos do próprio criador; ordenação estável e paginação. |
| `members_ofertas` | Produto próprio identificado por slug/ID validado | ID, nome, preço em centavos, tipo/ciclo, trial, parcelas, ativo/padrão. Sem segredo, configuração de tracking ou payload completo. |
| `members_resumo_financeiro` | Papel permitido e período fechado/limitado | Somente agregados do criador no período, moeda, base de cálculo e disponibilidade. Sem linhas de compradores, saques ou saldo bancário. |
| `members_link_checkout` | Produto próprio e oferta explícita quando solicitada | `url`, `usable`, bloqueios finitos e horário da avaliação. URL determinística não significa venda habilitada. |

`getProfile.canSell` atualmente aceita admin da plataforma ou conta aprovada com carteira Asaas. Esse resultado não pode ser reproduzido apenas com um booleano enviado pelo agente. A criação de rascunho atual exige autenticação, sem exigir que o criador já possa vender: manter separadas a capacidade de preparar conteúdo e a de publicar/vender. Falha ao consultar perfil é desconhecida/indisponível, não reprovação financeira inferida.

O primeiro catálogo é próprio: participação como afiliado ou coprodutor não concede edição sobre o produto de outro criador. Uma expansão de leitura por parceria deve verificar seu vínculo e papel no servidor. O admin atual do app não transforma automaticamente um token MCP de criador em acesso global.

### Identidade, escopos e isolamento

Vincular a credencial ao emissor autorizado, ator e criador do Members, com escopos separados de leitura e escrita de rascunho. A identidade deve ser confirmada pelo Members; não aceitar `creator_id`, papel ou `canSell` como autoridade no corpo da chamada. Revogação e escopos são conferidos a cada execução, inclusive antes de servir cache.

Não transportar cookies de sessão entre serviços e não entregar a service-role ao MCP. A chave privilegiada permanece interna e só pode ser usada por serviços que já verificaram o alvo e a autorização. Manter RLS e as verificações de `auth.uid()`/permissão nas RPCs; funções `SECURITY DEFINER` não podem virar atalhos globais. Escopos da Órbita ou o token de métricas agregadas não equivalem a uma delegação de criador do Members.

Texto de produto é conteúdo, não instrução para o agente. Projeções não incluem compradores, e-mails, URLs assinadas de arquivos, dados bancários, carteira Asaas, briefing privado, cartões ou payloads de pagamento. Auditoria registra ator, criador, ferramenta, alvo, escopo, horário, resultado e identificador de requisição, sem Bearer ou conteúdo sensível.

### Link e prontidão comercial

Construir a URL com origem fixa `https://members.ia.br`, slug validado e oferta vinculada ao produto. Reutilizar o avaliador de prontidão do domínio, com versão e razões explícitas; não duplicar regras no agente.

- Rascunho retorna `usable=false`, mesmo que a URL possa ser montada.
- Oferta inativa, inexistente ou de outro produto não é substituída silenciosamente por uma oferta padrão. A consulta pública atual admite fallback; o contrato MCP deve indicar o bloqueio quando uma oferta explícita foi pedida.
- Produto publicado não prova que a configuração comercial continua válida. Reavaliar as condições pertinentes a venda; os gates de `saveCourseMetadata` hoje se aplicam à transição de publicação, não a toda edição posterior.
- Preservar regras de oferta gratuita/paga, ciclo, trial, parcelas e preço mínimo vigentes no serviço/RPC. Não copiar um valor isolado de uma migration antiga para o adaptador.
- Conteúdo/entrega e pendências de coprodução devem seguir a mesma fonte do painel. Não publicar, aprovar parceiro ou chamar o Asaas para tornar o link utilizável.

O resumo financeiro deve preservar mês/fuso, papel e a definição de receita registrada/conciliada ou estimada. Não chamar esse valor de saldo disponível ou liquidação confirmada. O agregado global usado por CRM → Órbita continua em contrato e credencial próprios.

## Escrita posterior: somente rascunhos

Exige implementação separada, com escopos próprios e confirmação quando pertinente. Não habilitar junto com as consultas por conveniência.

1. Extrair validações compartilhadas das Actions. Produto sempre com criador derivado da identidade e `status=draft`; o contrato não aceita publicação, alteração de proprietário ou privilégios.
2. Oferta nova deve nascer **inativa e não padrão na mesma transação**. Não usar `createCourseOffer`/`create_course_offer` atuais e desativar depois: o intervalo pode expor uma oferta ativa em um produto já publicado. Preparar uma primitiva específica que preserve validações, limites e autorização, sem mudar o comportamento legítimo do painel existente.
3. Chave idempotente persistida, vinculada a ator/criador/operação e hash canônico do payload. Criação do rascunho e recibo de comando ficam na mesma transação. Repetição idêntica devolve o mesmo ID; payload diferente para a mesma chave é conflito. Retentativa de slug não atende esse requisito.
4. Timeout após envio exige consultar o recibo antes de repetir. Reinício do processo não pode recriar produto/oferta. Edição usa versão/revisão esperada para evitar sobrescrita concorrente.
5. Resposta retorna somente ID/slug, `draft`/inativa, revisão e recibo. Erros sanitizados e rastreáveis; sem SQL, dados de comprador ou erro bruto do provedor.
6. Publicação e ativação permanecem humanas no painel, com os gates existentes. Não oferecer saque, estorno, retry financeiro global, cobrança, exclusão ou concessão de acesso nessa fatia.

Nenhuma migration, credencial ou comando de produto faz parte desta preparação. A falta de Sandbox não impede concluir o desenho, mas impede declarar homologação de uma implementação comercial futura.

## Critérios de aceitação da implementação futura

Esta matriz é especificação, não uma alegação de testes executados em ferramentas inexistentes.

| Grupo | Casos a comprovar |
| --- | --- |
| Autorização | Sem token, expirado/revogado, escopo insuficiente, criador divergente, produto/oferta de terceiro, papel insuficiente e tentativa de usar token agregado do CRM. Nenhuma consulta antes do gate. |
| Contexto/catálogo | Admin legítimo versus criador, aprovado sem carteira, onboarding pendente, rascunho permitido sem venda, paginação estável, indisponibilidade diferente de lista vazia e ausência de PII. |
| Checkout | Rascunho, publicado, oferta explícita inativa/inexistente/estrangeira, configuração comercial alterada depois de publicar, conteúdo/entrega e coprodução pendentes. Link não cria pedido nem cobrança. |
| Financeiro | Criador/coprodutor/afiliado no papel autorizado, mês e fuso, estornos e base de cálculo, falha parcial e impossibilidade de consultar totais globais por credencial de criador. |
| Rascunhos | Oferta nunca visível entre chamadas; creator/status/active/default não controlados pelo agente; mesma chave simultânea, colisão de slug, queda antes/depois do commit, replay após reinício e conflito de revisão. |
| Jornada | Comparar DTO com painel autenticado; eventual compra somente em homologação separada com Sandbox e identidades de teste, incluindo webhook/job e acesso, sem mensagem ou dinheiro de produção. |

Ordem recomendada: serviços de consulta + DTO/contratos → identidade delegada e escopos → adaptador MCP somente leitura + auditoria → comparação autenticada por criador → rascunho de produto idempotente → oferta inativa atômica. Publicação automática e operações financeiras ficam fora desta proposta.

## Verificação da preparação

Fontes e contratos acima foram conferidos no código fixado. As suítes existentes `course-write-authorization`, `course-offer-price`, `product-slug` e `pricing` foram executadas localmente, sem Supabase/Asaas reais. Elas verificam premissas atuais, não a implementação do MCP proposto. A confirmação operacional de identidade delegada, RLS do adaptador e jornada autenticada ainda deve ocorrer na implementação.
