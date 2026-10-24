"use client";

import { ChevronRight, FileCode2, FileImage, FileText, Folder, FolderOpen } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/server/vault";

function FileIcon({ name, className }: { name: string; className?: string }) {
  if (/\.md$/i.test(name)) return <FileText className={className} />;
  if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(name)) return <FileImage className={className} />;
  return <FileCode2 className={className} />;
}

export function VaultTree({ nodes, current, filter }: { nodes: TreeNode[]; current: string | null; filter: string }) {
  return (
    <div className="space-y-px">
      {nodes.map((n) => (
        <TreeItem key={n.path} node={n} current={current} filter={filter.toLowerCase()} depth={0} />
      ))}
    </div>
  );
}

function matches(n: TreeNode, f: string): boolean {
  if (!f) return true;
  if (n.type === "file") return n.path.toLowerCase().includes(f);
  return n.children?.some((c) => matches(c, f)) ?? false;
}

function TreeItem({ node, current, filter, depth }: { node: TreeNode; current: string | null; filter: string; depth: number }) {
  const containsCurrent = current?.startsWith(`${node.path}/`) ?? false;
  const [open, setOpen] = React.useState(containsCurrent);
  // Abre a pasta quando a nota atual passa a estar dentro dela (ajuste durante o render, sem efeito).
  const [wasContaining, setWasContaining] = React.useState(containsCurrent);
  if (containsCurrent !== wasContaining) {
    setWasContaining(containsCurrent);
    if (containsCurrent) setOpen(true);
  }
  if (!matches(node, filter)) return null;
  const pad = { paddingLeft: 8 + depth * 14 };
  if (node.type === "dir") {
    const isOpen = open || Boolean(filter);
    return (
      <div>
        <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[13px] text-muted hover:bg-surface-2 hover:text-fg" style={pad}>
          <ChevronRight className={cn("size-3.5 shrink-0 transition", isOpen && "rotate-90")} />
          {isOpen ? <FolderOpen className="size-3.5 shrink-0" /> : <Folder className="size-3.5 shrink-0" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && node.children?.map((c) => <TreeItem key={c.path} node={c} current={current} filter={filter} depth={depth + 1} />)}
      </div>
    );
  }
  const active = current === node.path;
  return (
    <Link href={`/vault?p=${encodeURIComponent(node.path)}`} className={cn("flex items-center gap-1.5 rounded-md py-1 pr-2 text-[13px]", active ? "bg-accent/15 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")} style={{ paddingLeft: 8 + depth * 14 + 18 }}>
      <FileIcon name={node.name} className={cn("size-3.5 shrink-0", active && "text-accent")} />
      <span className="truncate">{node.name.replace(/\.md$/i, "")}</span>
    </Link>
  );
}
