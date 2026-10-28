# Neon: interactive reservation transactions

`getDb()` deliberately keeps the Neon HTTP adapter for ordinary reads/writes.
Drizzle's `neon-http` adapter rejects callback transactions before executing the
callback; PGlite-only tests did not expose that production failure.

Only the generic Hermes and maintenance reservations use `withDbTransaction()`.
For Neon this opens a request-local `@neondatabase/serverless` **Client** and uses
`drizzle-orm/neon-serverless`'s native callback transaction. Non-Neon Postgres and
PGlite retain their existing transaction-capable adapters. No migrations, indexes,
locks, reservation queries, idempotency keys, or delivery rules change.

## Supported APIs and lifecycle

Verified against the installed driver README (`@neondatabase/serverless` 1.2.0,
“Pool and Client”) and Drizzle 0.45.4's neon-serverless driver/session:

- [Neon driver: sessions, transactions and Client](https://github.com/neondatabase/serverless#sessions-transactions-and-node-postgres-compatibility)
- [Drizzle Neon connection](https://orm.drizzle.team/docs/connect-neon)
- Node 22+ provides the global WebSocket constructor; production/CI uses Node 24.
  Node 20 needs an explicitly supplied supported WebSocket implementation for
  this path; this change does not add one or change other drivers.
- Each reservation owns a single Client, never cached across serverless requests.
  `connect()` and the native transaction run inside `try`; `await client.end()`
  runs in `finally`, including connection, BEGIN, callback and COMMIT failures.
- Drizzle emits BEGIN/COMMIT, or ROLLBACK on callback/commit failure, on the same
  client. A dedicated Client also avoids depending on pool lease release if BEGIN
  itself fails. There is no sequential-write transaction emulation.
- Successful commit and awaited close precede delivery. An ambiguous commit or
  close failure does not trigger delivery or an automatic retry. Existing durable
  reservation/idempotency rules still require consulting the stored operation.

## Regression coverage and acceptance boundary

`tests/unit/db-transaction.test.ts` reproduces the real installed HTTP adapter's
unsupported callback error, then exercises the selected native Drizzle adapter
with only Client network methods stubbed. It checks ordered BEGIN/queries/COMMIT,
ROLLBACK, cleanup on four failure stages and separate concurrent clients.
The service DB tests assert both reservation services select the helper and retain
atomic task/dispatch creation, invalid-task rollback, retries and exclusivity.

No production credentials or real-database writes are used by these tests. They
prove adapter selection and lifecycle, not a live Neon network roundtrip. A fresh
independent review and post-deploy real MCP dispatch/readback remain acceptance
steps for the parent operator; do not equate PR checks with production acceptance.
