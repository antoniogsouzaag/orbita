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


## Alinhamento posterior — manual da empresa e conectores

O vault permanece como manual e inventário canônico. Foi retirada a ferramenta registrar_memoria_compartilhada e a injeção da pasta avulsa no contexto. Não foi criada nem apagada nenhuma nota de memória nesta etapa. Histórico transitório continua em eventos/tarefas da central; notas canônicas podem ser editadas com fonte e controle de versão. Memória de um aplicativo de chat pertence ao runtime/conta: não se transfere automaticamente para a API usada pela Órbita.

Jev agora usa OPENROUTER_API_KEY e OPENROUTER_JEV_MODEL (typesafe/jev-1.14), pela API alpha/decisions do OpenRouter. A chave já existente foi confirmada como variável de produção. O diagnóstico autentica a chave por GET /api/v1/key, sem inferência. O uso de decisão continua limitado a uma sugestão solicitada entre pelo menos duas tarefas abertas; com zero ou uma tarefa não há chamada. Outros candidatos futuros são classificação de capturas ambíguas e triagem de alertas, apenas quando regras locais forem insuficientes. Não usar Jev para aprovar pagamentos, acesso, merge ou substituir explicações e planejamento.

Postiz: instância autenticada v2.24.0 conferida no navegador. API pública retornou 14 canais e séries de analytics (HTTP200); chave existente reaproveitada na Vercel como sensível, sem rotação. Redes sociais oferece seleção de todos os canais com métricas por canal sob demanda e cache de uma hora. Isso evita 8 consultas sequenciais e a cobertura truncada anterior. O diagnóstico verifica a listagem, e a agenda só recebe verificado quando há fontes sincronizadas e sem erro. Unsplash agora tem sondagem de leitura.

Composio: conexão deste chat respondeu à leitura de perfil Instagram ag_labs e TikTok AG LABS. É um complemento para canais ausentes no Postiz; a conexão deste chat não provisiona COMPOSIO_API_KEY para a central. Manter Postiz como fonte principal para publicação/agendamento/analytics e acrescentar fontes só para lacunas identificadas, sem duplicar publicação.

Vault: leitura de blobs GitHub por SHA imutável usa cache persistente do Next; árvore da branch e leitura por caminho continuam atuais. Editor Markdown foi separado do bundle inicial. Grafo perdeu o cabeçalho externo, ocupa mais altura e interpola destaque/opacidade por cerca de 300ms; o redesenho contínuo termina após a transição, sem reaquecer a simulação. Rótulos vizinhos não são forçados pelo hover e aparecem conforme zoom. Respeita movimento reduzido.

GitHub migrou para Geral, preservando Pessoal/Empresa ao abrir. Página com estatísticas compactas, filtros por repositório e cobertura recolhida. Revisão de oito PRs e triagem de 52 propostas estão em revisao-github-2026-10-23.md. Billing de Actions confirmado pelas anotações oficiais nos oito PRs; nenhuma alteração em pagamento ou bypass de gate.

Referência Nexo (página sobre acessada no navegador): priorizar tarefa ligada a bloco de agenda/foco, revisão semanal e módulos opcionais. Não copiar por quantidade os módulos de dieta/saúde/estudos. O plano diário e o resumo já existentes devem ser o ponto de integração.

Codex/Claude locais: a arquitetura recomendada é uma fila na central consumida por um executor local autenticado, com diretórios permitidos, limites, aprovação e retorno de status. Ele pode usar Codex SDK/CLI e Claude Agent SDK/CLI, com continuidade por id de sessão. A máquina precisa estar ligada. Remote Control/Dispatch são interfaces dos respectivos produtos, não uma API pública que a Órbita possa assumir; não dá acesso automático ao chat atual. Esta etapa documenta a arquitetura, sem instalar worker ou abrir porta na máquina.

Fontes: https://openrouter.ai/docs/guides/community/jev ; https://docs.postiz.com/public-api/analytics/platform ; https://nexo.richardtjustke.tech/sobre ; https://developers.openai.com/codex/sdk/ ; https://code.claude.com/docs/en/headless ; https://code.claude.com/docs/en/remote-control .

Validação desta etapa: build de produção e TypeScript aprovados; lint dos componentes e integrações alterados sem erros; suíte completa de 94 testes passou com um worker e 10 testes focados de decisões, diagnóstico e seleção de canal passaram após as últimas alterações. A primeira execução concorrente excedeu os timeouts locais; a execução serial passou sem ampliar os timeouts. Não declara o lint global preexistente resolvido.
