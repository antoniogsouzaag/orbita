# Refinamento da central — 23/10/2026

## Implementação

- Navegação com sidebar flutuante, identidade consistente, movimento reduzido e Vault compartilhado.
- Troca de espaços com loading, prefetch e fontes externas da Empresa em Suspense. Tarefas pessoais e da empresa separadas no Início.
- Grafo com arraste, abertura de notas, filtros, busca, foco por vizinhança e controles acessíveis.
- Agenda mês/semana/dia/lista, colisões de horário, leitura de ICS, validação de datas e sincronização sem bloquear abertura.
- Agentes como central operacional de atividade, pedidos, time documentado e acessos recolhidos.
- Tela de PRs e diagnóstico de integrações, com reaproveitamento das permissões existentes do token Knowledge e cobertura parcial explícita.
- Notificações de pendências, eventos e incidentes, atualização automática e leitura persistida por navegador.
- Revisão com períodos comparáveis de 7/14/30 dias e estados vazios sem dados inventados.

## Evidência local

- Suíte completa: 19 arquivos, 83 testes passaram. Dois testes de IA/brief estouraram 30 s em rodada anterior; passaram isolados e na suíte completa com timeout de 120 s no ambiente de disco lento.
- TypeScript e lint de todos os arquivos TypeScript alterados passaram. O lint global já apontava problemas em arquivos fora deste escopo.
- Build Next 16.4.2 passou. Sem alteração de schema ou migrações.
- Login HTTP real no banco local isolado, seguido de HTTP 200 em Início, Empresa, Agenda, semana na virada de mês, Agentes, Revisão, Integrações e API de notificações.
- Navegador: indisponível na sessão após troca de login; a ferramenta retorna que o navegador local está desativado. Validação visual e interações desktop/mobile permanecem pendentes.

## Estado externo observado

- Duas metas empresariais iniciais foram salvas e confirmadas após reload na produção. A rotina pessoal também foi submetida; a confirmação após reload ficou pendente quando o navegador deixou de estar disponível. Progresso inicial zero; nenhum resultado financeiro/produtivo foi inventado.
- CRM_MCP_URL de produção foi corrigida de um deployment removido para `https://crm.aglabs.api.br/api/mcp`. Ainda precisa de um novo deployment para tornar a configuração efetiva e validar o token existente.
- Produção possui VAULT_GITHUB_TOKEN, CRM e Telegram configurados. Não possui GITHUB_INBOX_TOKEN nem N8N_INSTANCES. Configuração não comprova resposta ou entrega.
- Monitores de links dos dois n8n possuem integração Órbita ativa. Produção mostrava 34 endereços e dois monitores. O monitor de domínios também tem envio configurado; a busca de execuções retornou apenas duas execuções manuais antigas, não comprovando execução agendada do envio novo.
- Não foram enviadas mensagens Telegram, executados fluxos de alertas, criadas credenciais amplas nem feitas alterações no CRM de clientes.
- Uma tentativa de atualização manual de domínios em produção foi bloqueada pela revisão automática por uso inseguro de bearer em linha de comando e falta de autorização específica daquele envio. Ela não foi executada nem repetida por outro método.

## Próxima validação

1. Reabrir o mesmo projeto em sessão com navegador disponível e testar desktop/mobile, arraste/clique no grafo, quatro modos do calendário, troca de espaços e sino.
2. Publicar o commit revisado mediante autorização de produção; executar o diagnóstico usando as variáveis reais do deployment.
3. Para PRs de todos os repositórios privados, configurar token dedicado de leitura com a lista de repositórios desejados. O token Knowledge só garante a cobertura já concedida.
4. Para listar todos os workflows pela aplicação, configurar as chaves de leitura da API pública dos n8n. Os conectores do chat continuam disponíveis, mas suas credenciais não são exportadas para a aplicação.
