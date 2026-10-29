import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";

/** Only adapter-owned messages may leave the vault boundary. */
export class VaultProviderError extends Error {}

const treeSchema = z.object({
  sha: z.string().min(1),
  truncated: z.literal(false),
  tree: z.array(z.object({
    path: z.string().min(1), type: z.string().min(1), sha: z.string().min(1),
    size: z.number().nonnegative().optional(),
  })),
});

export type VaultEntry = { path: string; sha: string; size: number };

export interface VaultProvider {
  kind: "github" | "local";
  label: string;
  /** Lista arquivos e uma "versão" da árvore para cache. */
  list(): Promise<{ version: string; entries: VaultEntry[] }>;
  read(path: string, sha?: string): Promise<string>;
  readBinary(path: string): Promise<Buffer>;
  write(path: string, content: string, opts: { message: string; sha?: string }): Promise<{ sha: string }>;
  remove(path: string, opts: { message: string; sha?: string }): Promise<void>;
  webUrl(path: string): string | null;
}

const IGNORED = /(^|\/)(\.git|\.obsidian|\.trash|node_modules)(\/|$)/;

function localSha(relativePath: string, stat: { mtimeMs: number; ctimeMs: number; size: number }) {
  return createHash("sha256").update(JSON.stringify([relativePath, stat.mtimeMs, stat.ctimeMs, stat.size])).digest("hex");
}

class LocalProvider implements VaultProvider {
  kind = "local" as const;
  constructor(private root: string) {}
  get label() {
    return this.root;
  }
  private abs(p: string) {
    const full = path.resolve(this.root, p);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Caminho inválido");
    return full;
  }
  async list() {
    const entries: VaultEntry[] = [];
    const walk = async (dir: string) => {
      for (const d of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, d.name);
        const rel = path.relative(this.root, full).split(path.sep).join("/");
        if (IGNORED.test(rel)) continue;
        if (d.isDirectory()) await walk(full);
        else {
          const st = await fs.stat(full);
          // Different paths can have identical timestamps and sizes. Include
          // ctime as well so ordinary writes with restored mtime are detected.
          const sha = localSha(rel, st);
          entries.push({ path: rel, sha, size: st.size });
        }
      }
    };
    await walk(this.root);
    entries.sort((a, b) => a.path.localeCompare(b.path, "en"));
    const version = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
    return { version, entries };
  }
  async read(p: string) {
    return fs.readFile(this.abs(p), "utf8");
  }
  async readBinary(p: string) {
    return fs.readFile(this.abs(p));
  }
  async write(p: string, content: string) {
    const full = this.abs(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    const st = await fs.stat(full);
    return { sha: localSha(path.relative(this.root, full).split(path.sep).join("/"), st) };
  }
  async remove(p: string) {
    await fs.unlink(this.abs(p));
  }
  webUrl() {
    return null;
  }
}

/** Explica em português o que fazer quando o GitHub recusa o token do vault. */
function githubHint(status: number, repo: string): string | null {
  const owner = repo.split("/")[0];
  if (status === 404)
    return `O token do vault não enxerga ${repo} (GitHub 404). Crie um token fine-grained com “Resource owner” = ${owner} (não a conta pessoal), selecione só este repositório e dê “Contents: Read and write”. Se a organização pedir aprovação, aprove em github.com/organizations/${owner}/settings/personal-access-token-requests. Depois atualize VAULT_GITHUB_TOKEN na Vercel e publique de novo.`;
  if (status === 401) return "O token do vault é inválido ou expirou (GitHub 401). Gere outro e atualize VAULT_GITHUB_TOKEN na Vercel.";
  if (status === 403) return `O GitHub recusou o token do vault (403): falta a permissão “Contents” em ${repo}, a organização bloqueia tokens fine-grained ou o limite de requisições foi atingido.`;
  return null;
}

class GitHubProvider implements VaultProvider {
  kind = "github" as const;
  constructor(private repo: string, private branch: string, private token: string) {}
  get label() {
    return `${this.repo}@${this.branch}`;
  }
  private async api(url: string, init: RequestInit = {}) {
    const res = await fetch(`https://api.github.com${url}`, {
      ...init,
      // Blob SHAs identify immutable content. Persist these reads across cold
      // starts; the branch tree and path reads must still see current content.
      cache: url.includes("/git/blobs/") ? "force-cache" : "no-store",
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "orbita-vault",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    if (!res.ok) {
      throw new VaultProviderError(githubHint(res.status, this.repo) ?? `GitHub indisponível (HTTP ${res.status}). Tente novamente mais tarde.`);
    }
    return res;
  }
  private enc(p: string) {
    return p.split("/").map(encodeURIComponent).join("/");
  }
  async list() {
    const res = await this.api(`/repos/${this.repo}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`);
    const result = treeSchema.safeParse(await res.json());
    if (!result.success) throw new VaultProviderError("Inventário do vault incompleto ou inválido; não é possível confirmar a cobertura das notas.");
    const json = result.data;
    const entries = json.tree.filter((t) => t.type === "blob" && !IGNORED.test(t.path)).map((t) => ({ path: t.path, sha: t.sha, size: t.size ?? 0 }));
    return { version: json.sha, entries };
  }
  async read(p: string, sha?: string) {
    if (sha) {
      const res = await this.api(`/repos/${this.repo}/git/blobs/${sha}`, { headers: { accept: "application/vnd.github.raw+json" } });
      return res.text();
    }
    const res = await this.api(`/repos/${this.repo}/contents/${this.enc(p)}?ref=${encodeURIComponent(this.branch)}`, { headers: { accept: "application/vnd.github.raw+json" } });
    return res.text();
  }
  async readBinary(p: string) {
    const res = await this.api(`/repos/${this.repo}/contents/${this.enc(p)}?ref=${encodeURIComponent(this.branch)}`, { headers: { accept: "application/vnd.github.raw+json" } });
    return Buffer.from(await res.arrayBuffer());
  }
  async write(p: string, content: string, opts: { message: string; sha?: string }) {
    const res = await this.api(`/repos/${this.repo}/contents/${this.enc(p)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: opts.message, content: Buffer.from(content, "utf8").toString("base64"), sha: opts.sha, branch: this.branch }),
    });
    const json = (await res.json()) as { content: { sha: string } };
    return { sha: json.content.sha };
  }
  async remove(p: string, opts: { message: string; sha?: string }) {
    await this.api(`/repos/${this.repo}/contents/${this.enc(p)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: opts.message, sha: opts.sha, branch: this.branch }),
    });
  }
  webUrl(p: string) {
    return `https://github.com/${this.repo}/blob/${this.branch}/${this.enc(p)}`;
  }
}

export function vaultConfig() {
  const local = process.env.VAULT_LOCAL_PATH;
  const token = process.env.VAULT_GITHUB_TOKEN;
  const repo = process.env.VAULT_GITHUB_REPO ?? "aglabs-core/ag-labs-knowledge";
  const branch = process.env.VAULT_GITHUB_BRANCH ?? "main";
  return { local, token, repo, branch, configured: Boolean(local || token) };
}

let provider: VaultProvider | null | undefined;

export function getVaultProvider(): VaultProvider | null {
  if (provider !== undefined) return provider;
  const c = vaultConfig();
  provider = c.local ? new LocalProvider(path.resolve(c.local)) : c.token ? new GitHubProvider(c.repo, c.branch, c.token) : null;
  return provider;
}
