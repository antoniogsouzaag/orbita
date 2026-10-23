# Órbita

Central operacional pessoal e da AG LABS: tarefas, hábitos, metas, agenda, vault do Obsidian, status ao vivo da operação e ponto de conexão dos agentes.

Uso pessoal, um único usuário. Em produção: Vercel (região `gru1`, São Paulo) + Neon (Postgres, São Paulo).

## O que tem

| Área | Páginas |
| --- | --- |
| Núcleo | Início (capa, saudação, captura rápida, widgets), Tarefas, Projetos, Kanban, Agenda, Notas |
| Vida | Metas, Hábitos, Academia, Finanças, Leitura, Foco |
| Operação | Vault (editor estilo Obsidian, wikilinks, backlinks, grafo), Operação (status ao vivo), Automações, Agentes |
| Insights | Revisão, IA (chat e plano do dia), Integrações, Configurações |

Botão **+** abre os atalhos rápidos, inclusive tarefa por voz.

## Princípios

- **O vault é a fonte canônica.** Servidores, agentes, apps e regras ficam no vault (`aglabs-core/ag-labs-knowledge`). A Órbita lê de lá e não duplica.
- **O GitHub é o backup do vault.** Cada salvamento no editor vira um commit; o Obsidian sincroniza pelo obsidian-git.
- **O n8n coleta, a Órbita guarda e mostra.** Os monitores enviam links, domínios e falhas para `/api/ops/ingest`; a Órbita registra histórico, incidentes e a batida de cada monitor.
- **Agentes entram por MCP com acesso mínimo.** Cada agente tem um token próprio com escopos; nenhum vê dados pessoais nem edita o vault.

## Endpoints

| Rota | Autenticação | Uso |
| --- | --- | --- |
| `POST /api/ops/ingest` | `Bearer OPS_TOKEN` | n8n envia status de links, domínios, falhas de workflow e batidas |
| `GET /api/ops/alvos` | `Bearer OPS_TOKEN` | n8n lê a lista de endereços a monitorar (nota “Monitoramento de Disponibilidade”) |
| `/api/mcp` | `Bearer orb_…` (criado em **Agentes**) | Servidor MCP (Streamable HTTP) para agentes, Claude Code e Codex |
| `GET /api/context` | `Bearer CONTEXT_TOKEN` ou sessão | Contexto operacional em markdown/JSON |
| `GET /api/calendar/feed.ics?token=…` | `CALENDAR_FEED_TOKEN` | Feed para assinar no iPhone |
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
| `N8N_INSTANCES` | Opcional: API de cada n8n para listar workflows |
| `UNSPLASH_ACCESS_KEY`, `GITHUB_USER`, `GITHUB_TOKEN` | Opcionais: capas e sequência de commits |

## Segurança

- Usuário único; senha com hash scrypt; 2FA TOTP opcional (Configurações).
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
npm run typecheck
npm run db:generate          # após mudar src/db/schema.ts
```

As migrações rodam no build da Vercel (`scripts/migrate.mjs`).

Stack: Next.js 16 (App Router), React 19, Tailwind v4, Drizzle ORM, Neon, jose, OpenAI SDK, MCP SDK.
