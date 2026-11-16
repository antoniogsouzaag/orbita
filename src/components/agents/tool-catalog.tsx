import { toolGroups, type CatalogTool } from "@/lib/agent-handbook";

export function ToolCatalog({ tools }: { tools: readonly CatalogTool[] }) {
  return <div className="mt-3 space-y-2">{toolGroups(tools).map(group => <details key={group.category} className="rounded-lg border border-border px-3 py-2">
    <summary className="cursor-pointer text-xs font-medium">{group.category} <span className="font-normal text-muted">({group.tools.length})</span></summary>
    <ul className="mt-2 grid gap-2 md:grid-cols-2">{group.tools.map(tool => <li key={tool.name} className="min-w-0 rounded-lg bg-surface-2/60 p-2.5">
      <div className="flex flex-wrap items-center gap-2"><code className="break-all text-xs">{tool.name}</code><span className="rounded bg-surface-3 px-1.5 text-[11px] text-muted">{tool.scope}</span></div>
      <p className="mt-2 text-xs leading-relaxed text-muted">{tool.description}</p>
    </li>)}</ul>
  </details>)}</div>;
}
