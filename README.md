# Órbita

Central operacional pessoal e da AG LABS: tarefas, hábitos, metas, agenda, vault do Obsidian, status ao vivo da operação e ponto de conexão dos agentes.

Uso pessoal, um único usuário. Em produção: Vercel (região `gru1`, São Paulo) + Neon (Postgres, São Paulo).

## O que tem

| Área | Páginas |
| --- | --- |
| Núcleo | Início e Empresa (capa, saudação, captura rápida, cards personalizáveis), Tarefas, Projetos, Kanban, Agenda, Notas |
| Vida | Metas, Hábitos, Academia, Finanças, Leitura, Foco |
| Operação | Vault (editor estilo Obsidian, wikilinks, backlinks, grafo), Operação (status ao vivo), Automações, Agentes |
| Insights | Revisão, IA (chat com ações e plano do dia), Integrações, Configurações |

Botão **+** abre os atalhos rápidos, inclusive tarefa por voz. No iPhone, “E aí Siri, Órbita” registra pelo app Atalhos.

## Princípios

- **O vault é a fonte canônica.** Servidores, agentes, apps e regras ficam no vault (`aglabs-core/ag-labs-knowledge`). A Órbita lê de lá e não duplica.
- **O GitHub é o backup do vault.** Cada salvamento no editor vira um commit; o Obsidian sincroniza pelo obsidian-git.
- **O n8n coleta, a Órbita guarda e mostra.** Os monitores enviam links, domínios e falhas para `/api/ops/ingest`; a Órbita registra histórico, incidentes e a batida de cada monitor.
- **Visão dos aplicativos na IA:** ORBE Empresa usa `metricas_produto({produto})`; agentes Admin usam `orbita_metricas_produto`. A mesma função do painel mantém fonte, horário e ausência separados de zero. Métricas não concedem acesso administrativo ao app. Contrato e proposta de evolução: [conexões operacionais](docs/conexoes-operacionais.md).

- **Agentes entram por MCP com perfis explícitos.** Tom, Hermes Oracle e Hermes EasyPanel usam Administrador; os demais começam em leitura (Contexto e Status). Cada agente tem seu token revogável. Admin libera as ações da IA, contexto pessoal e escrita versionada no vault; o nome nunca concede permissão.
- **Sem acumular lixo.** Uma vez por dia a Órbita apaga o que envelheceu: atividade de agentes (30 dias), falhas de workflow e avisos (30 dias), incidentes resolvidos (90 dias) e endereços, monitores e domínios que pararam de ser enviados.
- **Falha de uma fonte não derruba a tela.** Se o GitHub recusar o token do vault, as páginas seguem funcionando e mostram o motivo e como corrigir.

## Evolução e triagem no GitHub

O painel separa **Fila de execução**, **Decisão de Antonio** e **A classificar**, sem esconder correções ainda abertas. Regras, rótulos e critérios de fechamento em [docs/triagem-evolucao.md](docs/triagem-evolucao.md). A classificação não ativa automações nem dispensa revisão, testes ou verificação do deploy.

## Qualidade da ORBE

O chat tem modo **Somente leitura**, consultas explícitas visíveis e interrupção com preservação dos recibos já recebidos. Interromper não desfaz escritas iniciadas; confira a origem antes de repetir. Conversas ficam guardadas por 60 dias e a ORBE mantém uma memória curta e editável (ORBE → Memória); veja [docs/orbe-memoria-escopo.md](docs/orbe-memoria-escopo.md). Ela também consulta e envia pedidos aos agentes (status_agentes, pedir_a_agente). Contrato, limites e matriz de avaliação em [docs/orbe-qualidade.md](docs/orbe-qualidade.md).

## Endpoints

| Rota | Autenticação | Uso |
| --- | --- | --- |
| `POST /api/ops/ingest` | `Bearer OPS_TOKEN` | n8n envia status de links, domínios, falhas de workflow e batidas |
| `GET /api/ops/alvos` | `Bearer OPS_TOKEN` | n8n lê a lista de endereços a monitorar (nota “Monitoramento de Disponibilidade”) |
| `/api/mcp` | `Bearer orb_…` (criado em **Agentes**) | Servidor MCP (Streamable HTTP) para agentes, Claude Code e Codex |
| `GET /api/context` | `Bearer CONTEXT_TOKEN` ou sessão | Contexto operacional em markdown/JSON |
| `GET /api/calendar/feed.ics?token=…` | `CALENDAR_FEED_TOKEN` | Feed para assinar no iPhone |
| `POST /api/capture` | `Bearer cap_…` (gerada em **Configurações → iPhone**) | Atalho do iPhone/Siri: `{ texto, modo? }` → `{ ok, mensagem }` |
| `POST /api/ai/ask` | sessão | Chat com a IA (texto em streaming, com ações) |
| `GET /api/avatar` | sessão | Foto do perfil |
| `GET /api/health` | pública | Verificação de disponibilidade |

### Conectar um agente

Para o plugin no ChatGPT web, use OAuth com login e consentimento na Órbita. O pacote em `plugins/orbita/`, os requisitos de publicação e o roteiro de instalação estão em [Plugin Órbita](docs/plugin-orbita.md). A conexão web é instalada na conta; configurar um MCP local não a instala automaticamente.

Em **Agentes → Criar acesso**, escolha o nome e as permissões. O token aparece uma única vez, com os comandos prontos:

```bash
claude mcp add --transport http orbita https://orb.aglabs.api.br/api/mcp --header "Authorization: Bearer orb_..."
```

```toml
# ~/.codex/config.toml
[mcp_servers.orbita]
url = "https://orb.aglabs.api.br/api/mcp"
http_headers = { Authorization = "Bearer orb_..." }
```

| Escopo | Ferramentas |
| --- | --- |
| todos | `documentacao` (manual) |
| `contexto` | `contexto_operacional`, `buscar`, `ler_nota_do_vault` |
| `status` | `status_ao_vivo`, `pendencias_github`, `automacoes_operacionais` |
| `tarefas` | Criar, consultar, assumir, dividir, atualizar e liberar tarefas empresariais |
| `eventos` | `registrar_evento`, `pedidos_recebidos`, `registrar_resultado` |
| `admin` | Todos os escopos anteriores, `contexto_pessoal` e o catálogo da IA com prefixo `orbita_`, inclusive escrita versionada no vault |

Para Hermes, validação de conexão e o caminho inverso (Órbita → agente), veja [Integração dos gestores](docs/integracao-gestores.md). Criar o token não configura o runtime nem comprova uma conexão ativa.

## Pessoal e Empresa

A Órbita tem dois espaços, alternados no topo da barra lateral (ou pelo ícone à esquerda do dock):

| Espaço | O que tem |
| --- | --- |
| **Pessoal** | Início, tarefas pessoais, agenda, notas, hábitos, metas, finanças, academia, leitura, foco e revisão |
| **Empresa** | Visão geral, tarefas da empresa, projetos, kanban, operação, automações e agentes |

O **Vault** é compartilhado pelos dois espaços, na seção Geral. A barra lateral flutua sobre a mesma capa, com animação e navegação móvel. CRM e GitHub carregam independentemente dos dados locais da Empresa; a navegação exibe um estado de carregamento sem travar os controles.

O grafo oferece busca por nota/pasta/tag, filtros, foco em conexões diretas ou de dois níveis, zoom, pausa e tela cheia. Clique em um nó para abrir a nota; arraste para reorganizar. O explorador lateral oferece os mesmos links pelo teclado.

A Agenda tem mês, semana, dia e lista, separa compromissos simultâneos e permite consultar eventos de calendários assinados. A sincronização externa acontece depois da resposta e também pelo botão de atualização. Eventos ICS são editados na origem. A Revisão compara períodos de 7, 14 ou 30 dias; ausência de check-in continua como ausência de registro.

As notificações consultam pendências, eventos e incidentes a cada minuto e ao retornar à janela. A leitura fica salva neste navegador. Erros de consulta são indicados sem afirmar que está tudo em dia.

Cada tarefa tem um escopo (`pessoal` ou `empresa`). Pedidos de agentes e tarefas de projetos da empresa entram como `empresa`; a IA escolhe o escopo pelo pedido.

A **Visão geral da Empresa** segue o formato do Início: capa própria do Unsplash, captura (tarefa da empresa, pergunta à IA no contexto da AG LABS ou nota) e cards que se escondem e reordenam em **Personalizar**:

| Card | O que mostra |
| --- | --- |
| Aguardando você | Pedidos dos agentes, tarefas da empresa vencidas ou de hoje e suas tarefas no CRM |
| Operação agora | Endereços no ar, falhas de workflow em 24h, domínios perto de vencer e monitores |
| Tarefas, Projetos, Metas | Só o que é da área Empresa |
| CRM | Receita do mês, funil, oportunidades, clientes e tarefas do time (Maia, Léo, técnico) |
| PRs e propostas | PRs abertos e issues `proposta` da `aglabs-core` (com `GITHUB_INBOX_TOKEN`) |
| Atividade dos agentes, Incidentes e falhas, Domínios, Agenda | Histórico recente da operação |

## Central dos agentes e diagnóstico

**Agentes** reúne conexões MCP, escopos, último acesso, chamadas/falhas nas últimas 24 horas, pedidos abertos e o time documentado no Registro de Agentes do vault. O status do vault é documental; último acesso não confirma que o agente continua online. A criação e revogação de acessos ficam no painel recolhido de configuração. O escopo `contexto` permite ler o vault conectado; dados pessoais continuam indisponíveis para perfis de leitura; administradores têm contexto pessoal e as ações da IA.

**`diagnostico_integracoes` no MCP administrativo** executa sondagens de leitura em banco, vault, GitHub, CRM, n8n, Telegram e consulta as batidas dos monitores. Não envia mensagens nem executa workflows. “Configurado” significa que a configuração existe; “Verificado” confirma a sondagem descrita, no horário exibido. O Telegram pode aceitar um aviso sem confirmar entrega.

A página Integrações mantém apenas conexões que o proprietário configura ou gerencia, como acessos MCP. O diagnóstico das dependências internas não aparece no painel. O mesmo diagnóstico operacional está em `GET /api/integrations/status`, autenticado pela sessão do dono ou pelo `CONTEXT_TOKEN` já usado para leitura de contexto. A resposta não contém credenciais e não é armazenada em cache público.

Para a consulta de workflows, crie uma chave em **Settings → n8n API → Custom** em cada servidor, com apenas `workflow:list` e `execution:list`. Salve `N8N_INSTANCES` como segredo de produção na Vercel: uma lista de objetos com `name`, `url` e `apiKey`. Use o botão **Copy** do n8n: o campo visível da chave pode conter um valor abreviado. Após salvar ou trocar as chaves, faça um novo deployment e execute o diagnóstico pelo MCP. Acompanhe a validade das credenciais; uma recusa da API não significa que os workflows desapareceram.

**GitHub** permite filtrar por tipo, título, repositório e autor. A credencial segue a precedência `GITHUB_INBOX_TOKEN` → `GITHUB_TOKEN` → `VAULT_GITHUB_TOKEN`. O token do Knowledge pode ser reutilizado com as permissões atuais, mas só enxerga os repositórios liberados para ele. Para visão do ecossistema, prefira um `GITHUB_INBOX_TOKEN` separado, de leitura, com os repositórios desejados. A busca carrega até 100 PRs e 100 propostas e informa quando os resultados são parciais.

## CRM

A Órbita conversa com o CRM (`aglabs-core/crm-dash`) pelo servidor MCP dele (`/api/mcp`, documentado em `docs/mcp.md` daquele repositório). A Órbita pede, o CRM executa com as próprias regras: sem acesso direto ao Supabase, sem e-mail ou telefone dos contatos, sem mudar etapa do funil e sem apagar nada.

- **Empresa → CRM**: resumo do funil, receita e tarefas, com cache de 1 minuto.
- **Bom dia**: oportunidades, receita do mês, suas tarefas do CRM e tarefas vencidas do time.
- **IA**: busca contatos, abre a ficha, cria tarefa para Maia, Léo, Antonio ou técnico, conclui com motivo e registra interações. E-mail para um contato vira tarefa para o Léo, que já faz o envio.

Configuração: `CRM_MCP_URL` (`https://crm.aglabs.api.br/api/mcp`) e `CRM_MCP_TOKEN` na Vercel da Órbita; o mesmo token em `CRM_MCP_TOKENS="orbita:<token>:leitura,tarefas,atividades"` na Vercel do CRM. Para trocar o token, gere outro (`openssl rand -hex 32`) e atualize os dois lados. Enquanto o CRM não aceita o token, o card mostra o motivo.

## Telegram

A Órbita envia direto pela API do bot, sem passar pelo n8n:

- **Bom dia às 7h** (agendador da Vercel → `GET /api/cron/brief` com `CRON_SECRET`): agenda, tarefas pessoais e da empresa, pedidos dos agentes, hábitos e operação.
- **Aviso imediato** quando um agente abre um pedido pelo MCP.

Os alertas de queda e de falha continuam saindo do n8n, de forma independente: se a Órbita cair, os alertas não param.

## Aparência

Superfícies em vidro (liquid glass: fundo translúcido, desfoque e brilho nas bordas internas). Atrás delas fica a capa do espaço atual (Pessoal ou Empresa), bem desfocada e escurecida, como o papel de parede do iPhone; no Início e na Empresa a foto nítida do topo se dissolve nela. Em **Configurações → Aparência** escolhem-se o modo (escuro, claro, sistema) e a cor de destaque. O componente `LiquidButton` (`src/components/ui/liquid-glass-button.tsx`) usa o mesmo vidro; o filtro SVG `#orbita-glass` é carregado uma vez no layout. Para prints sem acesso ao Unsplash: `MOCK_IMAGE=foto.jpg node scripts/shots.mjs /rota`.

## IA com ações

O chat (página **IA** e “Perguntar à IA” no Início) usa o modelo de `OPENAI_MODEL` (padrão `gpt-6-luna`) com ferramentas. Ele lê o dia (tarefas, hábitos, agenda, metas), consulta o vault e a operação e também age:

| Ferramenta | O que faz |
| --- | --- |
| `criar_tarefa`, `listar_tarefas`, `atualizar_tarefa` | Cria, lista, conclui e reorganiza tarefas (prazo, prioridade, projeto) |
| `criar_evento`, `ver_agenda` | Marca compromissos e lê a agenda, inclusive calendários assinados |
| `registrar_lancamento` | Registra despesa ou receita em Finanças |
| `criar_nota`, `buscar_notas` | Notas pessoais |
| `buscar`, `ler_nota_do_vault` | Consulta do vault |
| `salvar_nota_vault` | Cria/atualiza nota canônica com SHA; políticas, produtos e responsabilidades exigem aprovação explícita de Antonio |
| `status_operacao` | Sites fora do ar, incidentes, falhas, monitores e domínios |
| `crm_resumo`, `crm_tarefas`, `crm_buscar_contatos`, `crm_contato` | Funil, receita, tarefas do time e fichas do CRM (com o CRM conectado) |
| `crm_criar_tarefa`, `crm_concluir_tarefa`, `crm_registrar_atividade` | Tarefa para Maia, Léo, Antonio ou técnico; conclusão com motivo; interação na ficha |

Nada é apagado pela IA. Cada ação aparece como um selo na resposta, com link para a tela correspondente. O mesmo catálogo vale para Claude (`AI_PROVIDER=anthropic`).

## Atalho do iPhone

Em **Configurações → iPhone**, gere a chave (aparece uma vez) e monte o atalho **Órbita** no app Atalhos: *Ditar Texto* → *Obter Conteúdo do URL* (POST `https://orb.aglabs.api.br/api/capture`, cabeçalho `Authorization: Bearer cap_…`, corpo JSON `{ "texto": … }`) → *Obter Valor do Dicionário* `mensagem` → *Falar Texto*.

Sem `modo`, a IA entende e age (“comprar café amanhã às 9”, “gastei 32 no almoço”, “o que tenho hoje?”). Com `modo` `tarefa`, `nota` ou `gasto`, o registro é direto, sem IA.

## Variáveis de ambiente

Veja `.env.example`. As principais:

| Variável | Para quê |
| --- | --- |
| `ORBITA_PASSWORD_HASH` | Senha de acesso (gere com `npm run hash-password`) |
| `SESSION_SECRET` | Assinatura da sessão (32+ caracteres) |
| `DATABASE_URL` | Neon. Sem ela, usa PGlite local em `.data/` |
| `VAULT_GITHUB_TOKEN`, `VAULT_GITHUB_REPO`, `VAULT_GITHUB_BRANCH` | Vault no GitHub (token fine-grained, só “Contents: Read and write” neste repositório) |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | IA (padrão `gpt-6-luna`). Alternativa: `ANTHROPIC_API_KEY` + `AI_PROVIDER=anthropic` |
| `OPS_TOKEN`, `CONTEXT_TOKEN`, `CALENDAR_FEED_TOKEN` | Tokens das integrações (16+ caracteres) |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Envio pelo Telegram (bom dia e pedidos dos agentes) |
| `CRON_SECRET` | Autoriza o agendador da Vercel a chamar `/api/cron/brief` |
| `GITHUB_INBOX_TOKEN` | Opcional: PRs e propostas da `aglabs-core` na página Empresa (fine-grained, leitura de Pull requests, Issues e Metadata) |
| `CRM_MCP_URL`, `CRM_MCP_TOKEN` | Opcional: CRM na Empresa, no bom dia e na IA (veja **CRM**) |
| `N8N_INSTANCES` | Opcional: API de cada n8n para listar workflows |
| `UNSPLASH_ACCESS_KEY`, `GITHUB_USER`, `GITHUB_TOKEN` | Opcionais: capas e sequência de commits |

## Segurança

- Usuário único; senha com hash scrypt, trocável pelo app (desconecta os outros dispositivos); 2FA TOTP opcional (Configurações).
- Cookie `__Host-` httpOnly, sessão de 30 dias, “sair de todos os dispositivos”.
- Bloqueio de 5 min após 5 tentativas erradas, guardado no banco.
- Toda Server Action chama `requireAuth()` e toda rota de API valida sessão ou token (verificado em `tests/unit/security.test.ts`).
- Tokens de agentes guardados só como SHA-256; revogação imediata.
- Cabeçalhos: HSTS, `X-Frame-Options: DENY`, `nosniff`, `noindex`.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha ORBITA_PASSWORD (ou o hash) e o que for usar
npm run dev                  # http://localhost:3000
npm test                     # Vitest (banco PGlite em memória)
npx tsx scripts/seed-demo.mts # dados de exemplo no banco local (apaga os dados locais)
node scripts/shots.mjs /rota # prints das telas (Playwright)
npm run typecheck
npm run db:generate          # após mudar src/db/schema.ts
```

As migrações rodam no build da Vercel (`scripts/migrate.mjs`).

Stack: Next.js 16 (App Router), React 19, Tailwind v4, Drizzle ORM, Neon, jose, OpenAI SDK, MCP SDK.


## Evolução da central — 23/10/2026

- Topo transparente durante o scroll e somente um controle de sidebar. Notificações ficam no sino ao lado do avatar.
- Automações prioriza workflows e mostra falhas em uma coluna auxiliar compacta, sem repetir a mesma URL de execução nas duas fontes.
- **GitHub** (`/github`): inbox por repositório e autor + calendário real de contribuições (`GITHUB_USER`). Contribuições não equivalem a commits. A rota anterior redireciona.
- **Redes sociais** (`/redes`): API Postiz de leitura (`POSTIZ_API_URL` com base HTTPS completa até `/public/v1`, `POSTIZ_API_KEY`). Organiza canais por entidade/grupo explícito do Postiz, com janelas de 7 ou 30 dias e uma consulta de métricas por canal selecionado. Nomes/grupos têm cache de um minuto e métricas de uma hora; Atualizar agora expira os dois. Ausência de série não significa zero. A conexão do chat não fornece credenciais ao app.
- **Revisão do vault** (`/vault/revisao`): links sem destino, notas isoladas, títulos ambíguos e metadados incompletos. A análise é determinística e não modifica notas.
- **Contexto e memória**: o vault é o manual e inventário canônico, consultado pela IA e pelos agentes. Não há gravação automática nem injeção de uma pasta avulsa de memória compartilhada. Memórias e conversas particulares ficam nos respectivos runtimes; resumos transitórios ficam nos eventos operacionais da Órbita. Decisões duráveis aprovadas entram nas notas canônicas correspondentes.
- **Admin MCP**: todas as ações disponíveis na IA aparecem com prefixo `orbita_`, além de `contexto_pessoal`. Escrita de notas exige versão SHA e recusa conflitos. Perfil é atribuído explicitamente ao token; downgrade e revogação valem na próxima chamada. Não dá acesso a segredos, terminal ou ferramentas ainda não implementadas pela central.
- **Resumos dos agentes**: `registrar_evento` aceita `tipo: resumo`. A central mostra o último relato por origem nas últimas 24 horas e o bom dia inclui até cinco. O Léo ainda precisa ser conectado para enviar essa triagem; nenhum recebimento é simulado.

MCP é a entrada dos agentes na Órbita. A Órbita acionar Hermes/OpenClaw requer adaptadores de saída autenticados; observar contexto em Claude/Codex não cria um canal para iniciar uma sessão desktop. Telegram atual envia avisos e resumo; isso não é uma conversa bidirecional. Discord e dispatch externo dependem de configuração e validação próprias.


### Refinos da experiência pessoal

O + do dock abre bolhas flutuantes com rótulos no hover/foco, navegação por setas e Escape. A camada de atalhos fica fora do elemento com backdrop-filter, com uma única animação. Menus não modais não bloqueiam a rolagem; modais preservam o gutter da scrollbar para manter a largura estável. A capa usa uma máscara progressiva de múltiplos estágios.

A captura rápida e o ditado usam o espaço atual (Pessoal/Empresa). O Início oferece o card personalizável Próxima ação: prazos e prioridade ordenam as tarefas sem chamada de IA; Focar abre o timer com a tarefa vinculada. O timer preserva pausas após recarregar, registra apenas minutos realizados ao pular e usa idempotência por sessão para evitar duplicações. O salvamento das notas combina título/conteúdo e serializa as escritas antes de atualizar a tela.

**Jev (TypeSafe)** é opcional e sob demanda. `OPENROUTER_API_KEY` habilita Sugerir com Jev; `OPENROUTER_JEV_MODEL` fixa a versão (padrão `typesafe/jev-1.14`). Usa a API de decisões do OpenRouter, sem outra chave TypeSafe. A chamada envia somente id, título, prazo e prioridade de até 20 tarefas pessoais, escolhendo uma tarefa existente. Confiança abaixo de 0,75, probabilidade da opção abaixo de 0,65, resultado desconhecido ou indisponibilidade preservam as regras locais; não há fallback pago para outro modelo nem execução automática. A IA conversacional continua disponível para perguntas e planejamento aberto. A integração com o provedor real exige credencial e validação posterior; testes usam respostas simuladas.


## Órbitas, negócios e manual canônico

- Pessoal e Empresa mantêm tarefas, projetos, Kanban, busca, foco e contexto da IA separados. A tela empresarial combina seções distintas de tarefas internas e leitura do CRM, preservando as fontes.
- O + do dock abre um menu radial com overlay. Toque para escolher ou pressione, arraste até uma bolha e solte; fora dos alvos cancela. Tab/setas/Escape e movimento reduzido são suportados. O apóstrofo (`'`) alterna a sidebar sem interceptar digitação em campos ou editores.
- `/empresa/negocios` é o catálogo; `/empresa/negocios/barberias` é a primeira visão completa. A logo é o asset oficial; os demais produtos continuam acessíveis por suas fichas do vault.
- **Manual de entrada canônico:** `/documentacao`. A fonte única em `src/lib/agent-handbook.ts` também gera `GET /api/docs/agentes`, o resource MCP `orbita://manual`, a ferramenta `documentacao_canonica` e o prompt `iniciar_operacao`. A rota Markdown exige sessão, token individual ou CONTEXT_TOKEN. O catálogo efetivo de ações e schemas continua em `tools/list`.
- MCP v2 preserva as ferramentas anteriores. Contexto operacional começa pelo inventário (`ao_vivo: false`); consultas de estado são explícitas. Pedidos de agentes são empresariais e aceitam o vínculo `negocio`. O MCP recebe chamadas; pedidos aos runtimes saem pela ficha de diretores (Tom/OpenClaw e Hermes Oracle), com histórico e retorno. Hermes EasyPanel ainda depende de receptor próprio validado. Conexão MCP não inicia uma sessão desktop.

Procedimentos específicos dos gestores: [integração dos gestores](docs/integracao-gestores.md). Evidências desta revisão e próximos vínculos: [evolução das órbitas](docs/evolucao-orbitas-2026-10-23.md).
