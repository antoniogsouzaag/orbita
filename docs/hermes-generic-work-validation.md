# Generic Hermes task dispatch — local validation

Base: `origin/main` at `620ae68b3cf0bbe00dcf21f2fc93ff0e906a9bd3`.
Branch: `feat/hermes-generic-task-dispatch`.

## Scope delivered

Órbita UI + authenticated MCP share `dispatchWork`. Fixed destination is Hermes Oracle VPS03; strict signed `task.dispatch` parameters are `{task_id,brief,acceptance}`. Server-side origin, transactional task/dispatch reservation, active-task unique index, actor/content idempotency key, no automatic resend, structured owner-scoped task context and verified completion persistence are implemented. Maintenance/analysis and old history remain available as secondary paths.

## TDD evidence

Vertical runs were observed before implementation:

1. Task-backed source: `Generic task dispatch not implemented` in the reserve-before-network test, then green after service/schema/migration implementation. PGlite initially rejected multi-statement prepared migration; statement-breakpoint markers fixed the real migration.
2. Completion proof: invalid `task_execution:false` incorrectly resolved completed, then green after correlated bounded proof validation and persistence.
3. MCP: authenticated tasks/admin catalogue lacked `encaminhar_trabalho_hermes`, then green through the actual `/api/mcp` route after registration and structured context readback.
4. Mounted UI: first button was `Acionar Hermes`, not `Encaminhar trabalho`, then green with the primary generic form and shared Server Action. Same-turn duplicate submit and uncertain retry preserve input.
5. History/polling: generic proof was not rendered and aggregate detail stayed unverified text, then green with verified generic guards.
6. Explicit new-work reset button was missing, then green with snapshot reset.

Additional regressions cover concurrent create/existing-task reservations, wrong grant despite the Hermes display name, foreign/personal/closed tasks, forbidden control fields, invalid UUID/length, transport before persistence, invalid proof/task correlation, bounded evidence, HTML-as-text and owner-only context readback.

## Final gates

- `env -u NODE_ENV npm test`: **85 files passed, 457 tests passed**.
- `npm run typecheck`: passed.
- `env -u NODE_ENV DATABASE_URL='' PGLITE_DIR=memory npm run build`: passed; 39 static pages generated.
- Targeted ESLint on all changed TS/TSX files: passed.
- `git diff --check`: passed.
- `npm ci --ignore-scripts`: succeeded; npm reported **4 moderate dependency advisories**. No dependency changes or automated audit upgrades were made.

## Review-blocker correction gates

- Default-off persisted `hermes-task-dispatch` gate before reservation, shared UI/MCP; admin activation via `configurar_encaminhamento_hermes` requires authenticated correlated diagnostics readiness. No Vercel configuration change needed; optional environment hard-disable only.
- Exact executor-only `consultar_despacho_hermes({id:UUID4})`, persisted origin and strict params; name without admin is denied, requester tasks scope cannot read executor descriptors.
- Exact completion proof requires bounded safe session ID and 1–12 meaningful evidence strings. Server also reads the assigned Empresa task in `done`. UI uses the same proof schema. This is task state plus native receipt, not independent effect verification.
- Generated `drizzle/meta/0008_snapshot.json` using drizzle-kit API from the existing schema and snapshot 0007. The diff was exactly two ADD COLUMN and two CREATE UNIQUE INDEX statements, no destructive changes. No existing SQL migration was replaced. Regression verifies snapshot-to-current diff is empty.
- TDD red observed: disabled dispatch incorrectly reserved, UI trigger remained enabled, missing activation service/MCP, omitted session/evidence accepted, task without done incorrectly completed, missing snapshot. Each fixed and retested.
- `env -u NODE_ENV npm test`: 88 files / 462 tests passed after corrections; expanded same-test security assertions also exercised in final rerun.
- `npm run typecheck`, targeted ESLint and `git diff --check`: passed.
- Deployment-equivalent `env -u NODE_ENV DATABASE_URL='' PGLITE_DIR=memory sh -c 'node scripts/migrate.mjs && npm run build'`: passed, 39 static pages. The migration script explicitly skipped without DATABASE_URL; DB tests apply real SQL migrations through PGlite, not a claim of PostgreSQL/Neon deployment.
- One initial full-suite run hit a 180-second tool timeout. Re-run with 600 seconds completed (approximately 304 seconds); no fabricated output or reduced acceptance gate.

## Not enabled or verified live

No push, merge, deployment, production migration, secret/gate change or live receiver call. Global VPS03 resource locking, fixed executor sandbox and task execution binding are receiver/runtime obligations, documented here but not implemented in the Órbita repository. Compatible receiver review and a separately authorized end-to-end UI/MCP execution are required before enabling this contract. Independent parent-agent review remains pending; local gates are not an independent security review.

Idempotency limitation is deliberate: identical normalized actor/input always recovers the existing reservation (even terminal); a distinct new job needs explicitly changed input. A commit-before-send crash remains `sending` and needs reconciliation, never blind resend.
