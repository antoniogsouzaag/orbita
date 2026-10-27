# Revisão de consistência da central — 27/10/2026

## Evidências e causas

- CRM autenticado: R$ 300 no histórico completo e R$ 200 nos últimos 30 dias; o adicional de R$ 100 pertence a outra janela. O MCP retornava somente receita mensal. O conector passa a oferecer receita acumulada separada, preservando o calendário de São Paulo.
- Seis negócios responderam ao diagnóstico de leitura. Entre os cinco apps com contas, Barberias não enviava audience e MeCard enviava newMonth, mas active30d nulo. Os conectores têm mudanças próprias, com deploy separado; disponibilidade não equivale a cobertura de todos os indicadores.
- O widget de domínios limitava a lista a seis linhas. A lista completa passa a aparecer. Negócios com domínio cadastrado e sem resultado de vencimento ficam como aguardando coleta. O workflow já contém mecard.com.br nos dois cadastros; a ingestão agendada ocorre no ramo de três dias. Não executar o workflow inteiro como teste, pois pode enviar alertas.
- O vault lista 46 automações, mas a página só mostrava workflows n8n. O inventário passa a incluir as demais rotinas canônicas, sem criar cópias no banco nem habilitar automações. Rotinas já correlacionadas pelo ID são mostradas nas tabelas ao vivo; as demais indicam ausência de estado recebido.
- Postiz retornou 14 canais. Facebook de Barberias devolveu lista vazia de séries, sem erro de transporte; isso não comprova zero. No código oficial do Postiz, Instagram usa insights follower_count por dia e percentageChange fixo em 5. A central deixa de somar follower_count como audiência total, remove a variação sem base e apresenta cobertura por perfil. Fonte: https://github.com/gitroomhq/postiz-app/blob/main/libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts (analytics). Instagram conectado é o canal padrão de cada entidade.

## Organização

Tarefas é a mesma base em Lista e Kanban, selecionadas ao lado de Nova tarefa. Links antigos de /kanban redirecionam preservando filtros e espaço. Projetos agrupam tarefas e notas vinculadas explicitamente por marcador interno p:UUID; criação verifica a existência e o espaço do projeto. Notas continuam editáveis no editor atual e filtradas pelo projeto, com retorno ao contexto.

Viajeki e MeCard foram movidos a P1 no vault; Loja Labs, hub de links, a P3. Commit canônico: 9113d4fc4feec249b5826c60c024512c35f39274.

## Validação local

Órbita sobre a base 8d02738: instalação limpa, lint, TypeScript, build e 428 testes em 81 arquivos aprovados. Runtime Node 24.22.1 do bundle, pois a base atual inclui jsdom 30.1.3, que exige versão mais nova que o Node 22.20 do shell.

Barberias: npm run verify aprovado (inclui auditoria de segurança e build), 14 testes do endpoint. MeCard: npm run check (564 testes) e npm run test:sql completos aprovados, incluindo o relatório SQL novo. CRM: npm run check completo aprovado: lint, TypeScript, 145 testes de biblioteca, 44 de interface e build. Rede foi usada somente para as fontes oficiais do Next.js.

A revisão automática de permissões bloqueou publicar branches/PRs nos quatro repositórios, inclusive depois de Antonio pedir para evitar confirmações repetidas. Não houve merge, deploy ou aplicação remota da migration MeCard. O conector Supabase desta sessão expõe somente outro projeto inativo, sem o projeto MeCard. A correção de preferência solicitada por Antonio foi registrada separadamente na memória, sem alterar gates ou billing.


## Limites reais

As lacunas de conversão por coorte, compradores únicos, custo de geração e conciliação de pagamento exigem instrumentação própria; não derivar essas medidas de snapshots ou esconder as lacunas para completar o painel. O próximo passo do VibeKit foi atualizado porque a coleta já respondeu. Dados ausentes continuam explícitos e não são zero. Atividade Barberias é observada nos gestores, não em toda a equipe.

Implementação, gates, publicação, migration MeCard e validação autenticada da nova versão devem ter evidências separadas. Nenhum pagamento, mensagem a cliente ou execução de automação foi usado como teste.
