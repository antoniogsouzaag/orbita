import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

/** Cabeçalho padrão dos widgets: ícone + título + meta + link "Ver ↗". */
export function CardHeader({
  icon,
  title,
  meta,
  href,
  hrefLabel,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-5 pt-4 pb-3", className)}>
      {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
      <h3 className="text-[14px] font-semibold tracking-tight">{title}</h3>
      {meta && <span className="truncate text-[12.5px] text-faint">{meta}</span>}
      <div className="ml-auto flex items-center gap-1">
        {actions}
        {href && (
          <Link href={href} className="flex items-center gap-0.5 text-[12.5px] text-faint transition hover:text-fg">
            {hrefLabel ?? "Ver"} <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-3.5">
        {icon && (
          <span className="card grid size-10 shrink-0 place-items-center !rounded-2xl text-accent [&_svg]:size-[20px]">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-[23px] font-semibold leading-[1.15] tracking-[-0.025em]">{title}</h1>
          {description && <p className="mt-1 text-[13.5px] leading-snug text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: {
  icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-6 text-center", className)}>
      {icon && <div className="mb-1 rounded-2xl bg-surface-2 p-3 text-muted [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-xs text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-faint", className)}>{children}</div>;
}
