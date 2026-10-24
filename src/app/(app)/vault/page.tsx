import { LibraryBig } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { VaultPage, type VaultFileView } from "@/components/vault/vault-page";
import { basename } from "@/lib/wikilinks";
import { buildTree, getVaultIndex, getVaultProvider, vaultConfig } from "@/server/vault";

export const metadata = { title: "Vault" };

let defaultFolderCache: string | null = null;

/** Pasta padrão para notas novas (configuração do Obsidian), lida uma vez por processo. */
async function defaultNewFileFolder(provider: NonNullable<ReturnType<typeof getVaultProvider>>): Promise<string> {
  if (defaultFolderCache !== null) return defaultFolderCache;
  let folder = "";
  try {
    const app = JSON.parse(await provider.read(".obsidian/app.json"));
    if (typeof app.newFileFolderPath === "string") folder = app.newFileFolderPath;
  } catch {}
  defaultFolderCache = folder;
  return folder;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const provider = getVaultProvider();
  if (!provider) {
    const c = vaultConfig();
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <PageHeader icon={<LibraryBig />} title="Vault" />
        <Card>
          <EmptyState
            icon={<LibraryBig />}
            title="Conecte o vault do Obsidian"
            description={`Defina VAULT_GITHUB_TOKEN (token fine-grained com “Contents: read & write” só em ${c.repo}) ou VAULT_LOCAL_PATH. Veja Integrações.`}
          />
        </Card>
      </div>
    );
  }

  let idx;
  try {
    idx = await getVaultIndex();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <PageHeader icon={<LibraryBig />} title="Vault" />
        <Card><EmptyState icon={<LibraryBig />} title="Não consegui ler o vault" description={e instanceof Error ? e.message : String(e)} /></Card>
      </div>
    );
  }

  const defaultFolder = await defaultNewFileFolder(provider);

  let file: VaultFileView | null = null;
  const entry = p ? idx.files.find((f) => f.path === p) : undefined;
  if (entry) {
    const note = idx.notes.get(entry.path);
    if (note) {
      const backlinks = (idx.backlinks.get(note.path) ?? []).map((bp) => {
        const b = idx.notes.get(bp)!;
        const name = basename(note.path).toLowerCase();
        const line = b.body.split("\n").find((l) => l.toLowerCase().includes(`[[${name}`) || l.toLowerCase().includes(`/${name}`)) ?? "";
        return { path: bp, title: b.title, snippet: line.replace(/[#>*|`-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) };
      });
      file = {
        path: note.path,
        sha: note.sha,
        kind: "md",
        content: note.content,
        title: note.title,
        frontmatter: note.frontmatter,
        body: note.body,
        headings: note.headings,
        tags: note.tags,
        links: note.links.map((l) => ({ path: l, title: idx.notes.get(l)?.title ?? basename(l) })),
        unresolved: note.unresolved,
        backlinks,
        webUrl: provider.webUrl(note.path),
      };
    } else {
      const isImage = /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(entry.path);
      const isText = /\.(html?|txt|json|css|js|ts|ya?ml|csv|xml)$/i.test(entry.path) && entry.size < 400_000;
      file = {
        path: entry.path,
        sha: entry.sha,
        kind: isImage ? "image" : isText ? "text" : "binary",
        content: isText ? await provider.read(entry.path, provider.kind === "github" ? entry.sha : undefined) : null,
        title: basename(entry.path),
        frontmatter: {},
        body: "",
        headings: [],
        tags: [],
        links: [],
        unresolved: [],
        backlinks: [],
        webUrl: provider.webUrl(entry.path),
      };
    }
  }

  const mdPaths = [...idx.notes.keys()];
  const folders = [...new Set(idx.files.map((f) => f.path.split("/").slice(0, -1).join("/")).filter(Boolean))].sort();
  const links = [...idx.notes.values()].reduce((s, n) => s + n.links.length, 0);

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
      <VaultPage
        tree={buildTree(idx.files)}
        file={file}
        mdPaths={mdPaths}
        folders={folders}
        source={`${provider.kind === "github" ? "GitHub" : "Local"} · ${provider.label}`}
        stats={{ notes: idx.notes.size, files: idx.files.length, links }}
        defaultFolder={defaultFolder}
      />
    </div>
  );
}
