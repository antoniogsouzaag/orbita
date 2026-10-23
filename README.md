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
- **Agentes entram por MCP com acesso mínimo.** Cada agente tem um token próprio com escopos; nenhum vê dados pessoais nem edita o vault.
- **Sem acumular lixo.** Uma vez por dia a Órbita apaga o que envelheceu: atividade de agentes (30 dias), falhas de workflow e avisos (30 dias), incidentes resolvidos (90 dias) e endereços, monitores e domínios que pararam de ser enviados.
- **Falha de uma fonte não derruba a tela.** Se o GitHub recusar o token do vault, as páginas seguem funcionando e mostram o motivo e como corrigir.

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
| `contexto` | `contexto_operacional`, `buscar_no_vault`, `ler_nota_do_vault` |
| `status` | `status_ao_vivo` |
| `tarefas` | `criar_tarefa_para_antonio`, `minhas_tarefas` |
| `eventos` | `registrar_evento` |

## Pessoal e Empresa

A Órbita tem dois espaços, alternados no topo da barra lateral (ou pelo ícone à esquerda do dock):

| Espaço | O que tem |
| --- | --- |
| **Pessoal** | Início, tarefas pessoais, agenda, notas, hábitos, metas, finanças, academia, leitura, foco e revisão |
| **Empresa** | Visão geral, tarefas da empresa, projetos, kanban, operação, automações, agentes e vault |

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

## CRM

A Órbita conversa com o CRM (`aglabs-core/crm-dash`) pelo servidor MCP dele (`/api/mcp`, documentado em `docs/mcp.md` daquele repositório). A Órbita pede, o CRM executa com as próprias regras: sem acesso direto ao Supabase, sem e-mail ou telefone dos contatos, sem mudar etapa do funil e sem apagar nada.

- **Empresa → CRM**: resumo do funil, receita e tarefas, com cache de 1 minuto.
- **Bom dia**: oportunidades, receita do mês, suas tarefas do CRM e tarefas vencidas do time.
- **IA**: busca contatos, abre a ficha, cria tarefa para Maia, Léo, Antonio ou técnico, conclui com motivo e registra interações. E-mail para um contato vira tarefa para o Léo, que já faz o envio.

Para ligar: gere um token (`openssl rand -hex 32`), coloque `CRM_MCP_TOKENS="orbita:<token>:leitura,tarefas,atividades"` na Vercel do CRM e `CRM_MCP_URL` + `CRM_MCP_TOKEN` na Vercel da Órbita.

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
| `buscar_no_vault`, `ler_nota_do_vault` | Vault (só leitura) |
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
