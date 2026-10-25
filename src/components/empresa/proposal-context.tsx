import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { proposalDisplayNotes } from "@/lib/proposals";

/** Markdown sem HTML cru e sem carregar imagens remotas do conteúdo da origem. */
export function ProposalContext({ content }: { content: string }) {
  return <div className="prose-orbita break-words text-[13px]"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ alt }) => <span className="text-muted">[Imagem: {alt || "anexo na origem"}]</span>, a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{proposalDisplayNotes(content)}</ReactMarkdown></div>;
}
