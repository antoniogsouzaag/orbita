import { afterEach, expect, it, vi } from "vitest";
import { Client } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dbModule from "@/db";

// Real installed HTTP and WebSocket Drizzle adapters; only the network is replaced.
// Never connect to Neon or require production credentials in this regression.
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each(["callback", "begin", "commit", "connect"] as const)("closes the per-reservation session on %s failure", async failureAt => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@ep-test.neon.tech/test");
  const failure = new Error(`failed at ${failureAt}`);
  vi.spyOn(Client.prototype, "connect").mockImplementation((async () => {
    if (failureAt === "connect") throw failure;
  }) as never);
  const end = vi.spyOn(Client.prototype, "end").mockResolvedValue(undefined as never);
  const statements: string[] = [];
  vi.spyOn(Client.prototype, "query").mockImplementation((async (query: { text: string }) => {
    const statement = query.text.trim();
    statements.push(statement);
    if (statement === failureAt) throw failure;
    return { rows: [], rowCount: 0 };
  }) as never);
  let callbackRan = false;
  await expect(dbModule.withDbTransaction(async tx => {
    callbackRan = true;
    await tx.execute(sql`select 1`);
    if (failureAt === "callback") throw failure;
  })).rejects.toThrow();
  expect(callbackRan).toBe(failureAt !== "connect" && failureAt !== "begin");
  expect(statements).toEqual({
    callback: ["begin", "select 1", "rollback"],
    begin: ["begin"],
    commit: ["begin", "select 1", "commit", "rollback"],
    connect: [],
  }[failureAt]);
  expect(end).toHaveBeenCalledTimes(1);
});

it("opens independent clients for concurrent reservations", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@ep-test.neon.tech/test");
  vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined as never);
  const end = vi.spyOn(Client.prototype, "end").mockResolvedValue(undefined as never);
  const clients: unknown[] = [];
  vi.spyOn(Client.prototype, "query").mockImplementation((async function(this: Client) {
    clients.push(this);
    return { rows: [], rowCount: 0 };
  }) as never);
  await Promise.all([1, 2].map(value => dbModule.withDbTransaction(async tx => {
    await tx.execute(sql`select ${value}`);
  })));
  expect(new Set(clients).size).toBe(2);
  expect(end).toHaveBeenCalledTimes(2);
});

it("keeps ordinary Neon reads on HTTP but reserves with a native interactive transaction", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@ep-test.neon.tech/test");
  const callback = vi.fn();
  await expect((await dbModule.getDb()).transaction(callback)).rejects.toThrow("No transactions support in neon-http driver");
  expect(callback).not.toHaveBeenCalled();

  const connect = vi.spyOn(Client.prototype, "connect").mockResolvedValue(undefined as never);
  const end = vi.spyOn(Client.prototype, "end").mockResolvedValue(undefined as never);
  const statements: string[] = [];
  vi.spyOn(Client.prototype, "query").mockImplementation((async (query: { text: string }) => {
    statements.push(query.text.trim());
    return { rows: [], rowCount: 0 };
  }) as never);

  const result = await dbModule.withDbTransaction(async tx => {
    await tx.execute(sql`select 1`);
    await tx.execute(sql`select 2`);
    return "reserved";
  });
  expect(result).toBe("reserved");
  expect(statements).toEqual(["begin", "select 1", "select 2", "commit"]);
  expect(connect).toHaveBeenCalledTimes(1);
  expect(end).toHaveBeenCalledTimes(1);
});
