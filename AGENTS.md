<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Órbita — central operacional de Antonio Garcia e da AG LABS

Uso exclusivo do proprietário: sem página pública, sem SEO. Reúne o estado ao vivo da operação, o vault da empresa, o ponto de conexão dos agentes por MCP e a organização pessoal de Antonio.

## Antes de abrir PR

```bash
npm run check
```

Roda `typecheck → testes → build`, o mesmo que o CI (`.github/workflows/quality.yml`, Node 24). Os testes usam PGlite em memória; nenhum deles precisa de `.env.local`, rede ou credencial.

Depois de mudar `src/db/schema.ts`: `npm run db:generate`. As migrações rodam no `npm start` (`scripts/migrate.mjs`), então uma migration mesclada é aplicada quando o servidor sobe com a versão nova. Mesclar na `main` não publica: a produção (VPS-03) é atualizada à parte, e `GET /api/health` informa o `commit` que está no ar.

## Onde fica cada coisa

- `src/app/(app)/` — telas; `src/components/shell/nav.ts` é o mapa único da navegação e dos dois espaços.
- `src/server/` — toda a lógica de servidor, um arquivo por domínio (`ops-live`, `agents`, `crm`, `journal`, `orbe-*`, `social-*`, `hermes-*`).
- `src/server/agents.ts` — servidor MCP: ferramenta nova entra aqui com escopo, registro de atividade e teste.
- `src/db/schema.ts` — schema Drizzle (Neon em produção).
- `tests/unit`, `tests/db`, `tests/postgres` — testes; `docs/` — contratos de integração.

## Regras que o código precisa respeitar

- **Pessoal e Empresa não se misturam.** Toda leitura e escrita carrega o espaço; token de leitura nunca alcança dado pessoal.
- **A Órbita não copia o que tem fonte própria.** Vault vem do GitHub, clientes e tarefas comerciais vêm do CRM por MCP, métricas de produto vêm do aplicativo. Fonte ausente aparece como indisponível, nunca como zero.
- **Configurado não é executado.** Diagnóstico e status distinguem configuração, resposta recebida, ausência e dado desatualizado.
- **Escrita no vault** é commit na `main` do repositório do vault, com conferência de SHA.
- **Banco dorme entre batidas.** Evite consulta em laço ou a cada requisição: o Neon cobra por tempo acordado, e os monitores só falam com a Órbita quando algo muda ou uma vez por hora.

## Não mexer sem pedido explícito

Autenticação e 2FA, escopos e tokens do MCP, OAuth, despacho para Hermes e OpenClaw, retenção e exclusão de dados, e qualquer migration destrutiva.

## Documentação

Contrato durável vai para `docs/` com nome do assunto (`jornal-orbita.md`, `hermes-dispatch.md`). Relato datado de uma rodada de trabalho não é documentação: fica na descrição do PR.
