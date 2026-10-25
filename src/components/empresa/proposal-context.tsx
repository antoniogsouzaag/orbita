import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { proposalDisplayNotes } from "@/lib/proposals";

function MarkdownBlock({ content }: { content: string }) {
  return <ReactMarkdown skipHtml remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span className="text-muted">[Imagem: {alt || "anexo na origem"}]</span>, a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{content}</ReactMarkdown>;
}

/** Reconhece só o invólucro de histórico do GitHub; HTML arbitrário nunca é executado. */
export function ProposalContext({ content }: { content: string }) {
  const markdown = proposalDisplayNotes(content);
  const sections = [];
  let from = 0;
  for (const match of markdown.matchAll(/<details(?:\s[^>]*)?>\s*<summary(?:\s[^>]*)?>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi)) {
    const index = match.index!;
    if (index > from) sections.push(<MarkdownBlock key={`text-${from}`} content={markdown.slice(from, index)} />);
    const summary = match[1].replace(/<[^>]*>/g, "").trim() || "Histórico da proposta";
    sections.push(<details key={`history-${index}`} className="my-3 rounded-xl border border-border p-3"><summary className="cursor-pointer text-xs font-medium text-muted">{summary}</summary><div className="mt-3"><MarkdownBlock content={match[2]} /></div></details>);
    from = index + match[0].length;
  }
  if (from < markdown.length) sections.push(<MarkdownBlock key={`text-${from}`} content={markdown.slice(from)} />);
  return <div className="prose-orbita break-words text-[13px]">{sections}</div>;
}
