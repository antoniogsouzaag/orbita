import { FolderKanban } from "lucide-react";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { PageHeader } from "@/components/ui/card";
import { listProjects } from "@/server/projects";

export const metadata = { title: "Projetos" };

export default async function ProjectsPage() {
  const projects = await listProjects(true);
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHeader icon={<FolderKanban />} title="Projetos" description="Frentes de trabalho, estudo e vida pessoal." />
      <ProjectsGrid projects={projects} />
    </div>
  );
}
