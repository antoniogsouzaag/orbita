import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "@/server/vault/provider";

const { provider } = vi.hoisted(() => ({
  provider: { kind: "github", list: vi.fn(), read: vi.fn() },
}));
vi.mock("@/server/vault/provider", () => ({ getVaultProvider: () => provider }));

const CAPACITY = 256;
const entry = (sha: string): VaultEntry => ({ path: `${sha}.md`, sha, size: 1 });

beforeEach(() => {
  vi.resetModules();
  provider.list.mockReset();
  provider.read.mockReset().mockImplementation(async (path: string) => `read:${path}`);
});

// Every build has a new tree version, so assertions exercise the blob cache,
// not the separate index cache. No real provider or vault is accessed.
async function buildWith(shas: string[], version: string) {
  provider.list.mockResolvedValue({ version, entries: shas.map(entry) });
  const { getVaultIndex } = await import("@/server/vault/index");
  return getVaultIndex(true);
}

describe("bounded vault blob cache", () => {
  it("refreshes an existing SHA when remembered without consuming another slot", async () => {
    const { rememberBlob } = await import("@/server/vault/index");
    for (let i = 0; i < CAPACITY; i++) rememberBlob(`sha-${i}`, `cached:${i}`);
    rememberBlob("sha-0", "cached:0");
    rememberBlob("sha-new", "new");

    const index = await buildWith(["sha-0", "sha-2", "sha-1"], "tree-1");

    expect(index.notes.get("sha-0.md")?.content).toBe("cached:0");
    expect(index.notes.get("sha-2.md")?.content).toBe("cached:2");
    expect(provider.read).toHaveBeenCalledExactlyOnceWith("sha-1.md", "sha-1");
  });

  it("refreshes recency on cache hits, including empty content", async () => {
    const { rememberBlob } = await import("@/server/vault/index");
    for (let i = 0; i < CAPACITY; i++) rememberBlob(`sha-${i}`, i === 0 ? "" : `cached:${i}`);
    await buildWith(["sha-0"], "tree-1");
    expect(provider.read).not.toHaveBeenCalled();
    rememberBlob("sha-new", "new");

    const index = await buildWith(["sha-0", "sha-1"], "tree-2");

    expect(index.notes.get("sha-0.md")?.content).toBe("");
    expect(provider.read).toHaveBeenCalledExactlyOnceWith("sha-1.md", "sha-1");
  });

  it("bounds blobs loaded during index builds as well as remembered blobs", async () => {
    await buildWith(Array.from({ length: CAPACITY + 1 }, (_, i) => `sha-${i}`), "tree-1");
    provider.read.mockClear();

    const index = await buildWith(["sha-256", "sha-0"], "tree-2");

    expect(index.notes.size).toBe(2);
    expect(provider.read).toHaveBeenCalledExactlyOnceWith("sha-0.md", "sha-0");
  });

  it("evicts the oldest blob remembered beyond 256 entries", async () => {
    const { rememberBlob } = await import("@/server/vault/index");
    for (let i = 0; i <= CAPACITY; i++) rememberBlob(`sha-${i}`, `cached:${i}`);

    const index = await buildWith(["sha-1", "sha-256", "sha-0"], "tree-1");

    expect(index.notes.get("sha-1.md")?.content).toBe("cached:1");
    expect(index.notes.get("sha-256.md")?.content).toBe("cached:256");
    expect(index.notes.get("sha-0.md")?.content).toBe("read:sha-0.md");
    expect(provider.read).toHaveBeenCalledExactlyOnceWith("sha-0.md", "sha-0");
  });
});
