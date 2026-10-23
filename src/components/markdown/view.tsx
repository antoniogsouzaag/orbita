"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Converte [[alvo|apelido]] e ![[anexo]] em links markdown com protocolos internos. */
export function preprocessWikilinks(md: string): string {
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/g);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part.replace(/(!?)\[\[([^\[\]\n]+?)\]\]/g, (_, bang: string, inner: string) => {
        const [left, ...rest] = inner.split(/\\?\|/);
        const alias = rest.length ? rest.join(" ").trim() : undefined;
        const [target, heading] = left.split("#");
        const label = (alias ?? (heading ? `${target.trim()} › ${heading.trim()}` : target.trim())).replace(/[[\]]/g, "");
        const dest = `${bang ? "embed" : "wikilink"}:${encodeURIComponent(target.trim())}${heading ? `#${encodeURIComponent(heading.trim())}` : ""}`;
        return bang ? `![${label}](${dest})` : `[${label}](${dest})`;
      });
    })
    .join("");
}

export function slugHeading(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function textOf(children: React.ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  if (children && typeof children === "object" && "props" in children) return textOf((children as { props: { children?: React.ReactNode } }).props.children);
  return "";
}

export function MarkdownView({
  content,
  resolve,
  embedUrl,
  className,
}: {
  content: string;
  /** Resolve um alvo de wikilink em href (ou null se não existir). */
  resolve?: (target: string, heading?: string) => string | null;
  embedUrl?: (target: string) => string | null;
  className?: string;
}) {
  const H = (Tag: "h1" | "h2" | "h3" | "h4") =>
    function Heading({ children }: { children?: React.ReactNode }) {
      return <Tag id={slugHeading(textOf(children))}>{children}</Tag>;
    };
  return (
    <div className={cn("prose-orbita", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          h1: H("h1"),
          h2: H("h2"),
          h3: H("h3"),
          h4: H("h4"),
          a({ href, children }) {
            if (href?.startsWith("wikilink:")) {
              const [rawTarget, rawHeading] = href.slice(9).split("#");
              const target = decodeURIComponent(rawTarget);
              const heading = rawHeading ? decodeURIComponent(rawHeading) : undefined;
              const to = resolve?.(target, heading) ?? null;
              if (!to) return <span className="wikilink unresolved" title="Nota não encontrada">{children}</span>;
              return <Link href={to} className="wikilink">{children}</Link>;
            }
            const external = href && /^https?:/.test(href);
            return (
              <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                {children}
              </a>
            );
          },
          img({ src, alt }) {
            const s = typeof src === "string" ? src : "";
            if (s.startsWith("embed:")) {
              const target = decodeURIComponent(s.slice(6).split("#")[0]);
              const url = embedUrl?.(target);
              if (url && /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(target)) {
                // eslint-disable-next-line @next/next/no-img-element
                return <img src={url} alt={alt ?? target} />;
              }
              const to = resolve?.(target);
              return to ? <Link href={to} className="wikilink">↪ {alt}</Link> : <span className="wikilink unresolved">{alt}</span>;
            }
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={s} alt={alt ?? ""} />;
          },
          input(props) {
            return <input {...props} disabled />;
          },
        }}
      >
        {preprocessWikilinks(content)}
      </ReactMarkdown>
    </div>
  );
}
