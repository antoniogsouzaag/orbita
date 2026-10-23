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

## Continuação — Metas

- Filtros Todas/Pessoal/Empresa com contagens. Estudos, saúde e finanças pertencem ao filtro Pessoal; Empresa usa a área explícita, sem inferir pelo título.
- Nova meta assume a área do filtro selecionado. O formulário reinicia ao abrir, preserva os campos em falha e informa erros de salvamento/exclusão.
- Controles de progresso ficam desabilitados durante a atualização; alvo zero não conclui automaticamente a meta.
- TypeScript e suíte completa passaram: 19 arquivos, 83 testes. Sem alteração de schema.
- Navegador de produção disponível, mas a Agenda observada ainda contém só Mês/Lista, portanto não valida o checkpoint local com quatro modos.
- A tentativa de iniciar Next na porta 3012 anunciou Ready, mas encerrou ao detectar outro servidor do projeto na porta 3000 (PID 12312). O navegador recusou conexão na porta 3012 por localhost e pelo IP de rede anunciado. Validação visual das mudanças locais continua pendente. Nenhum deploy executado nesta continuação.

## Integração e publicação — continuação de 23/10

- `d4f1add` publicado na main e em produção; a configuração corrigida do CRM entrou em vigor. O diagnóstico real retornou resumo e tarefas pelo MCP.
- Banco verificado; Vault retornou 87 notas; monitores retornaram 2/2 batidas recentes. Telegram confirmou bot e destino, sem envio real de teste.
- Token GitHub dedicado criado com autorização explícita, restrito a Issues/Pull requests/Metadata em leitura para aglabs, viajeki, members, mecard, marketing, barberias, crm-dash e ag-labs-knowledge. Salvo como segredo de produção; o diagnóstico retornou 60 de 60 PRs/propostas visíveis. Expiração informada pelo GitHub: 22/11/2026.
- Chaves n8n criadas com autorização explícita, limitadas a `workflow:list` e `execution:list`. A captura inicial leu o campo visual abreviado, resultando em HTTP 401. Estado intermediário resolvido no fechamento abaixo.
- A revisão automática bloqueou a tentativa de salvar chaves temporárias em JSON local. O arquivo não foi criado (confirmado por Test-Path). O cadastro na Vercel foi feito diretamente pela interface, como Secret e somente Production.
- `73f754b` publicado e READY na Vercel (`dpl_8K5b3GhuixFSp4ortPvbS4cQ1wmp`): o grafo evita enquadrar coordenadas ainda indefinidas ao pausar/filtrar, e Automações deixa de classificar workflows como ausentes quando alguma API falha.
- Navegador real: quatro modos da Agenda abriram; filtro Empresa mostrou duas metas e Nova meta abriu com área Empresa; grafo carregou 87 notas/505 conexões, foco mostrou 40 notas/171 conexões, e pausa seguida de foco manteve zoom numérico após a correção. Arraste executado e abertura de nota confirmada pelo explorador. Interação mobile ainda não concluída: a tentativa de override 390×844 continuou reportando 1920 px; não vale como evidência mobile.
- Build local completo e 83 testes passaram antes das duas correções finais de UI. Lint e TypeScript dos arquivos finais passaram; o build de produção das correções também passou. Consulta de logs error/fatal do último deployment, janela de 15 min às 09:35 de São Paulo, não retornou entradas.
- A autorização específica para executar o monitor e seus possíveis alertas foi recebida; a execução está registrada no fechamento abaixo. Calendários externos não foram inventados nem conectados sem uma fonte do usuário.

### Fechamento das integrações — 09:41, São Paulo

- O usuário concluiu a rotação das duas chaves n8n. Os valores completos foram capturados pelo botão Copy, após a confirmação de cópia, e salvos diretamente em `N8N_INSTANCES` como Secret/Production na Vercel. Nenhum segredo foi gravado em arquivo local.
- Redeploy `dpl_CiVcZMUBiN23Kq5P6AzVnuEZxVy2`, commit `887023c`, READY e associado a `orb.aglabs.api.br`.
- Diagnóstico real: 12/12 configurações presentes, 7 sondagens verificadas, sem warning/error. Os demais itens continuam como configurados, sem afirmar testes que o diagnóstico não executa. n8n: duas instâncias, 105 workflows, 33 ativos. GitHub: 60 PRs/propostas visíveis. Monitores: 3/3 com batidas recentes.
- Monitor de domínios executado com a autorização explícita: execução `10039`, gatilho `a cada 3 dias às 10h`, modo production. O workflow não guarda execuções bem-sucedidas, portanto o detalhe posterior não estava disponível. A Órbita confirmou oito domínios com vencimentos e a nova batida do monitor; nenhum domínio abaixo de 45 dias. Não foi confirmada entrega de mensagem Telegram.
- IA respondeu “Conexão validada” ao teste que proibia ferramentas e mudanças em registros.
- Nota canônica “Monitoramento de Disponibilidade” alinhada aos três endereços já monitorados (Hermes Maia, Hermes Bia e healthz do webhook n8n), commit Knowledge `e86e43fe055bfee42f81b8fb3d400ffa922d2599`.
- Captura final: `orbita-integracoes-verificadas.png`, na pasta de visualizações desta sessão. Credenciais vencem em novembro de 2026 e exigirão renovação.
