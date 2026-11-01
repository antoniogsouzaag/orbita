import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function journalContentUrl(value: string) {
  if (value.startsWith("#") || (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\"))) return value;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? value : ""; } catch { return ""; }
}

/** Untrusted submissions: server-rendered Markdown, no raw HTML or remote image requests. */
export function JournalArticleBody({ content }: { content: string }) {
  return <div className="prose-orbita overflow-x-auto"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img"]} urlTransform={journalContentUrl} components={{
    h1: ({ children }) => <h4>{children}</h4>, h2: ({ children }) => <h4>{children}</h4>,
    a: ({ href, children }) => href ? <a href={href} target={href.startsWith("https:") ? "_blank" : undefined} rel="noreferrer">{children}</a> : <span>{children}</span>,
  }}>{content}</ReactMarkdown></div>;
}
