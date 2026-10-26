import { toolGroups, type CatalogTool } from "@/lib/agent-handbook";

export function ToolCatalog({ tools }: { tools: readonly CatalogTool[] }) {
  return <div className="mt-4 space-y-6">{toolGroups(tools).map(group => <section key={group.category}>
    <h3 className="text-sm font-semibold">{group.category} <span className="font-normal text-muted">({group.tools.length})</span></h3>
    <ul className="mt-3 grid gap-3 md:grid-cols-2">{group.tools.map(tool => <li key={tool.name} className="min-w-0 rounded-lg bg-surface-2/60 p-3">
      <div className="flex flex-wrap items-center gap-2"><code className="break-all text-xs">{tool.name}</code><span className="rounded bg-surface-3 px-1.5 text-[11px] text-muted">{tool.scope}</span></div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{tool.description}</p>
    </li>)}</ul>
  </section>)}</div>;
}
