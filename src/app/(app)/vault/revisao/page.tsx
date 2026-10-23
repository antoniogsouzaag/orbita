import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { auditVault } from "@/lib/vault-audit";
import { getVaultIndexSafe } from "@/server/vault";

export const metadata = { title: "Revisão do vault" };
export default async function Page() {
  const index = await getVaultIndexSafe();
  if (!index) return <Card className="mx-auto max-w-5xl p-5">Vault indisponível. Confira a conexão em Integrações.</Card>;
  const audit = auditVault([...index.notes.values()]);
  const sections = [
    { title: "Links sem destino", description: "Confirme se são notas a criar ou referências que precisam ser corrigidas.", items: audit.broken.map((item) => ({ path: item.path, detail: item.targets.join(", ") })) },
    { title: "Notas isoladas", description: "Sem links de entrada ou saída. Conecte a um índice ou processo relacionado.", items: audit.orphans.map((path) => ({ path, detail: "Sem conexões" })) },
    { title: "Metadados incompletos", description: "Notas sem type ou status. Templates são excluídos desta contagem.", items: audit.metadata.map((path) => ({ path, detail: "Revisar type/status" })) },
    { title: "Títulos repetidos", description: "Podem tornar wikilinks ambíguos. Prefira links com o caminho completo.", items: audit.duplicates.flatMap((paths) => paths.map((path) => ({ path, detail: "Título compartilhado" }))) },
  ];
  return <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
    <PageHeader icon={<FileSearch />} title="Revisão do vault" description={`${audit.total} notas · análise estrutural sem IA · índice consultado em ${new Date(index.builtAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`} />
    <p className="text-sm text-muted">O vault mantém decisões e contexto compartilhado; tarefas ficam na central, relações comerciais no CRM e credenciais nos provedores. Esta revisão identifica lacunas sem mover nem reescrever notas automaticamente.</p>
    <div className="grid items-start gap-4 lg:grid-cols-2">{sections.map((section) => <Card key={section.title} className="p-5">
      <h2 className="text-sm font-semibold">{section.title} · {section.items.length}</h2><p className="my-3 text-xs text-muted">{section.description}</p>
      <ul className="max-h-80 divide-y divide-border overflow-y-auto">{section.items.map((item) => <li key={item.path} className="py-2 text-xs"><Link href={`/vault?p=${encodeURIComponent(item.path)}`} className="text-accent hover:underline">{item.path}</Link><p className="mt-1 break-words text-faint">{item.detail}</p></li>)}</ul>
      {!section.items.length && <p className="text-xs text-muted">Nenhum item encontrado neste índice.</p>}
    </Card>)}</div>
  </div>;
}
