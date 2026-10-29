import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let root: string;
beforeEach(async () => {
  vi.resetModules();
  root = await fs.mkdtemp(path.join(os.tmpdir(), "orbita-vault-"));
  vi.stubEnv("VAULT_LOCAL_PATH", root);
  vi.stubEnv("VAULT_GITHUB_TOKEN", "fixture-token");
  vi.stubEnv("VAULT_GITHUB_REPO", "fixture/knowledge");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await fs.rm(root, { recursive: true, force: true });
});

describe("local vault snapshot", () => {
  it("returns the same version from write and list for editor continuity", async () => {
    const { getVaultProvider } = await import("@/server/vault/provider");
    const provider = getVaultProvider()!;
    const saved = await provider.write("folder/note.md", "Note", { message: "fixture" });
    expect((await provider.list()).entries.find(entry => entry.path === "folder/note.md")?.sha).toBe(saved.sha);
  });

  it("does not substitute files with the same size and mtime on rebuild", async () => {
    const time = new Date("2026-01-01T00:00:00Z");
    for (const [name, content] of [["a.md", "Alpha"], ["b.md", "Bravo"]]) {
      await fs.writeFile(path.join(root, name), content);
      await fs.utimes(path.join(root, name), time, time);
    }
    const { getVaultIndex } = await import("@/server/vault/index");
    await getVaultIndex();
    await fs.writeFile(path.join(root, "c.md"), "New note");
    const index = await getVaultIndex(true);
    expect(index.notes.get("a.md")?.body).toBe("Alpha");
    expect(index.notes.get("b.md")?.body).toBe("Bravo");
  });

  it("detects an older file edit even when count and latest mtime stay unchanged", async () => {
    await fs.writeFile(path.join(root, "latest.md"), "Latest");
    const future = new Date("2030-01-01T00:00:00Z");
    await fs.utimes(path.join(root, "latest.md"), future, future);
    await fs.writeFile(path.join(root, "older.md"), "Old");
    const { getVaultIndex } = await import("@/server/vault/index");
    const first = await getVaultIndex();
    await fs.writeFile(path.join(root, "older.md"), "Updated");
    const second = await getVaultIndex(true);
    expect(second.version).not.toBe(first.version);
    expect(second.notes.get("older.md")?.body).toBe("Updated");
    expect((await getVaultIndex(true)).version).toBe(second.version);
  });
});

describe("GitHub vault coverage and public errors", () => {
  async function github(response: Response) {
    vi.stubEnv("VAULT_LOCAL_PATH", "");
    const fetcher = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetcher);
    return { fetcher, ...(await import("@/server/vault/index")) };
  }

  it.each([
    { sha: "tree", truncated: true, tree: [] },
    { sha: "tree", truncated: false, tree: [{ path: "note.md", type: "blob" }] },
    { sha: "tree", tree: [] },
  ])("refuses incomplete or invalid listings instead of reporting an empty healthy vault (%j)", async (tree) => {
    const { vaultHealth } = await github(Response.json(tree));
    expect(await vaultHealth()).toMatchObject({ configured: true, ok: false, notes: 0, error: expect.stringContaining("incompleto ou inválido") });
  });

  it("does not propagate the provider response body into health or logs", async () => {
    const sentinel = "private-provider-payload";
    const { vaultHealth, fetcher } = await github(new Response(sentinel, { status: 502 }));
    const health = await vaultHealth();
    expect(health.ok).toBe(false);
    expect(health.error).toContain("502");
    expect(JSON.stringify(health)).not.toContain(sentinel);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(sentinel);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", redirect: "error" });
  });

  it("does not report a cached snapshot as healthy after a failed forced refresh", async () => {
    const { getVaultIndex, vaultHealth, fetcher } = await github(Response.json({ sha: "initial", truncated: false, tree: [] }));
    await getVaultIndex();
    fetcher.mockImplementation(async () => Response.json({ sha: "partial", truncated: true, tree: [] }));
    await expect(getVaultIndex(true)).rejects.toThrow("incompleto ou inválido");
    expect(await vaultHealth()).toMatchObject({ ok: false, error: expect.stringContaining("incompleto ou inválido") });
  });

  it("does not propagate network exceptions or malformed JSON", async () => {
    const { vaultHealth, fetcher } = await github(new Response("private-json-payload"));
    const invalidJson = await vaultHealth();
    fetcher.mockRejectedValue(new Error("private-network-payload"));
    const network = await vaultHealth();
    for (const health of [invalidJson, network]) {
      expect(health.ok).toBe(false);
      expect(health.error).toBe("Não foi possível consultar o vault. Tente novamente mais tarde.");
    }
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private-");
  });

  it("accepts a validated full tree and retains immutable blob caching", async () => {
    const { getVaultIndex, fetcher } = await github(Response.json({ sha: "tree", truncated: false, tree: [
      { path: "note.md", type: "blob", sha: "blob", size: 4 },
    ] }));
    fetcher.mockResolvedValueOnce(Response.json({ sha: "tree", truncated: false, tree: [
      { path: "note.md", type: "blob", sha: "blob", size: 4 },
    ] })).mockResolvedValueOnce(new Response("Note"));
    expect((await getVaultIndex()).notes.get("note.md")?.body).toBe("Note");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ cache: "force-cache", redirect: "error" });
  });
});

describe("vault search", () => {
  it("does not load the vault for blank queries", async () => {
    vi.stubEnv("VAULT_LOCAL_PATH", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { searchVault } = await import("@/server/vault/index");
    expect(await searchVault(" \n\t ")).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("preserves ranking on repeated searches and refreshes after content changes", async () => {
    await fs.writeFile(path.join(root, "a.md"), "---\ntitle: Segurança\ntags: [proteção]\n---\nSegurança dos agentes.");
    await fs.writeFile(path.join(root, "b.md"), "---\ntitle: Operação\n---\nSegurança na operação.");
    const { searchVault, getVaultIndex } = await import("@/server/vault/index");
    const first = await searchVault("seguranca");
    expect(first.map(note => note.path)).toEqual(["a.md", "b.md"]);
    expect(await searchVault("seguranca")).toEqual(first);
    expect((await searchVault("protecao"))[0].path).toBe("a.md");
    await fs.writeFile(path.join(root, "a.md"), "Content replaced");
    await getVaultIndex(true);
    expect((await searchVault("seguranca")).map(note => note.path)).toEqual(["b.md"]);
  });
});
