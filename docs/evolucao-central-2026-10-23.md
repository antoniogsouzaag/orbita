# Evolução da central — 23/10/2026

## Mudanças e verificações

Topo transparente em qualquer posição; alternância da sidebar sem duplicação e notificações apenas no sino. Automações mostra workflows primeiro e falhas numa coluna auxiliar compacta, com deduplicação por URL de execução. Grafo preserva busca, filtros, foco e controles, com nós menores, arestas discretas, órfãs vazadas, posição fixada após arraste e ajuste de tamanho.

GitHub possui página própria e calendário real de contribuições. O calendário não apresenta contribuições como commits e informa fonte, período e cache. Redes sociais consulta a API pública do Postiz e mantém séries originais, sem somar seguidores ou confundir ausência de dado com zero. Exige credencial própria no ambiente da Órbita.

Os perfis MCP agora incluem admin, que expõe todas as ações disponíveis na IA, contexto pessoal e escrita versionada do vault. O token conserva a permissão no banco, independentemente do nome; downgrade e revogação são verificados a cada requisição. Os coordenadores têm atalhos explícitos de criação de acesso. Nenhum token foi criado ou distribuído nesta revisão.

Memória compartilhada: registros de decisões explicitamente solicitadas pelo usuário, em Markdown no vault, com fonte e timestamp; as últimas entradas ativas acompanham a IA e o contexto MCP, e o restante segue pesquisável. Resumos transitórios usam eventos operacionais, não as notas canônicas. O último resumo por origem nas últimas 24 horas entra na central e no bom dia. Essa implementação não importa históricos de Hermes/OpenClaw nem conecta o Léo automaticamente.

## Auditoria real do vault

Snapshot de leitura do Knowledge: 87 notas. O mesmo indexador e resolver usados pela aplicação identificaram zero wikilinks sem destino, zero notas isoladas, zero títulos repetidos e zero notas sem type/status (excluindo templates). A ficha da Órbita ainda descreve o modelo antigo sem administradores; deve acompanhar a publicação. Não há justificativa estrutural para reorganizar pastas ou duplicar fichas de produto/infraestrutura.

Preservar a separação canônica: vault para decisões/processos, Órbita para estado e pendências, CRM para contatos e interações, Git para código e histórico, provedores para segredos. Memórias particulares dos agentes permanecem nos próprios runtimes; o vault oferece o contexto comum. Uma camada semântica externa só deve ser adicionada por necessidade medida, com retenção, fonte e controle de acesso claros.

## Evidência externa antes da publicação

Consulta de produção em 23/10, 11:41 (São Paulo): banco e vault responderam, 87 notas; GitHub 60/60 PRs/propostas visíveis; CRM retornou resumo e tarefas; dois n8n responderam com 33/105 workflows ativos; três monitores com batidas recentes. Bot e destino do Telegram responderam sem envio de mensagem. Agenda possui duas fontes iPhone ativas, sem erro e sem sincronização pendente; eventos de outubro foram observados.

## Limites e próximos conectores

- Zero tokens MCP ativos em produção antes desta alteração. Criar e distribuir cada token requer a conexão posterior do agente; apenas documentar o time não conecta processos.
- Léo: enviar registrar_evento com tipo resumo; dados de clientes continuam no CRM.
- Postiz: configurar POSTIZ_API_URL e POSTIZ_API_KEY no ambiente da central e validar a versão instalada e permissões de cada rede.
- Telegram existente envia avisos e bom dia; conversa de entrada não está implementada. Discord pode usar webhook autenticado, mas ainda não está configurado.
- Chamadas de saída para Hermes/OpenClaw dependem de endpoints e autenticação dedicados, com idempotência e histórico de execução. Um cliente MCP conectado à Órbita não implica callback disponível.
- Codex pode ser integrado programaticamente por SDK/CLI com um executor controlado. A documentação oficial permite threads e turns via app-server, mas classifica o comando e transporte WebSocket como experimentais e sem suporte para produção; não expor esse listener como endpoint público. Isso não dá acesso automático à sessão desktop deste chat.

## Validação de código

Suíte completa passou: 22 arquivos e 89 testes, incluindo autorização/admin/downgrade, conflitos de versão e caminhos do vault, séries Postiz e auditoria estrutural. Build final Next.js e TypeScript passaram. A validação visual de publicação é acompanhada no deployment e na conversa desta revisão. O lint global identifica 30 erros e dois avisos preexistentes em efeitos, refs e renderização de outros fluxos; não devem ser confundidos com uma revisão completa e resolvida desse passivo.

Fontes consultadas: https://learn.chatgpt.com/docs/app-server ; https://hermes-agent.nousresearch.com/docs/user-guide/features/memory-providers ; https://docs.openclaw.ai/concepts/memory-architecture ; código oficial gitroomhq/postiz-app (PublicIntegrationsController e AnalyticsData).


## Continuação — experiência pessoal

- Menu do dock redesenhado com bolhas como na referência; portal dentro da camada da aplicação e fora do backdrop-filter do dock. Uma única animação, rótulos por hover/foco, Escape e navegação por setas.
- Menus comuns passam a não modais. Modais mantêm o espaço da barra de rolagem com scrollbar-gutter estável, sem compensação dupla do Radix.
- Hero com máscara de múltiplos estágios, eliminando a concentração da transição numa faixa estreita.
- Corrigido o contexto da captura rápida e ditado: agora preservam Pessoal/Empresa.
- Adicionado card Próxima ação à personalização do Início, com regras locais e vínculo direto ao timer.
- Corrigido Pular no foco: não registra minutos que não aconteceram. Pausas sobrevivem ao reload; sessões recebem id para gravação idempotente e horário de conclusão explícito.
- Notas combinam patches de título e conteúdo e serializam as escritas. A troca de nota descarrega o debounce anterior; fechamento da página avisa se há gravação pendente.
- Jev confirmado na documentação oficial da TypeSafe; não é um produto da OpenAI. A seleção opcional é restrita a tarefas existentes, por ação explícita do usuário, e sem mutações. Credencial da TypeSafe não foi criada nesta revisão e não houve chamada real de decisão.

Fontes Jev: https://docs.typesafe.ai/models ; https://docs.typesafe.ai/api/system-one ; https://docs.typesafe.ai/primitives/choice ; https://docs.typesafe.ai/confidence . Os thresholds são uma escolha conservadora inicial da aplicação, não uma medida comprovada de precisão na agenda de Antonio.
