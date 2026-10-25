import Link from "next/link";
import { Plug } from "lucide-react";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Integrações" };
export default async function Page() {
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<Plug />} title="Integrações" description="Acessos do time e conexões utilizadas pela central." />
    <Link href="/integracoes/mcp" className="block rounded-2xl border border-border bg-surface p-6 transition hover:border-accent/40"><p className="text-xs uppercase tracking-widest text-accent">Agentes · MCP</p><h2 className="mt-2 text-lg font-semibold">Acessos e configuração ↗</h2><p className="mt-2 text-sm text-muted">Endpoints, tokens individuais e permissões do time.</p></Link>
  </div>;
}
