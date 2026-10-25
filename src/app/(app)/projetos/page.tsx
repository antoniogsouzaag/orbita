import { FolderKanban } from "lucide-react";
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
      <ProjectsGrid key={`${scope}:${sp.novo ?? "list"}`} projects={projects} scope={scope} />
    </div>
  );
}
