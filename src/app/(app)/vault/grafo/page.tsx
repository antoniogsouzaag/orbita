import { Network } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { VaultGraph } from "@/components/vault/graph";
import { prepareGraph } from "@/components/vault/graph-model";
import { VaultBanner } from "@/components/vault/vault-banner";
import { getVaultIndexSafe, getVaultProvider } from "@/server/vault";

export const metadata = { title: "Grafo do vault" };

export default async function Page() {
  if (!getVaultProvider()) return <div className="mx-auto max-w-3xl px-4">Vault não configurado.</div>;
  const idx = await getVaultIndexSafe();
  if (!idx) return <div className="mx-auto max-w-3xl px-4 sm:px-6"><VaultBanner /></div>;
  const links: { source: string; target: string }[] = [];
  for (const n of idx.notes.values())
    for (const l of n.links) {
      links.push({ source: n.path, target: l });
    }
  const nodes = [...idx.notes.values()].map((n) => ({ id: n.path, name: n.title, group: n.path.includes("/") ? n.path.split("/")[0] : "", degree: 0, tags: n.tags }));
  const graph = prepareGraph({ nodes, links });
  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6">
      <PageHeader icon={<Network />} title="Grafo do vault" description="Uma visão conectada do conhecimento pessoal e da empresa. Explore relações, encontre contexto e abra qualquer nota." actions={<Button size="sm" asChild><Link href="/vault">← Vault</Link></Button>} />
      <VaultGraph data={graph} />
    </div>
  );
}
