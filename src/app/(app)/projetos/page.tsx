import { FolderKanban } from "lucide-react";
import Link from "next/link";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { PageHeader } from "@/components/ui/card";
import { listProjects } from "@/server/projects";
import { taskScope } from "@/lib/task-scope";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ escopo?: string; novo?: string }> }) {
  const sp = await searchParams;
  const scope = taskScope(sp.escopo);
  const projects = await listProjects(true, scope);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={<FolderKanban />} title={scope === "empresa" ? "Projetos da empresa" : "Projetos pessoais"} description={scope === "empresa" ? "Frentes de trabalho da AG LABS." : "Frentes de estudo, saúde e vida pessoal."} />
      <nav aria-label="Espaço dos projetos" className="mb-4 flex gap-2 text-sm"><Link href="/projetos" className={scope === "pessoal" ? "font-medium text-accent" : "text-muted"}>Pessoal</Link><span className="text-faint">/</span><Link href="/projetos?escopo=empresa" className={scope === "empresa" ? "font-medium text-accent" : "text-muted"}>Empresa</Link></nav>
      <ProjectsGrid key={`${scope}:${sp.novo ?? "list"}`} projects={projects} scope={scope} />
    </div>
  );
}
