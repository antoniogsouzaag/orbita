import type { InboxItem } from "@/server/github-inbox";

export const ANSWERED_TAG = "resposta:antonio";
export type ProposalSource = { kind: "github"; repo: string; number: number } | { kind: "task"; id: string };
export type ReplyTask = { id: string; tags: string[]; notes: string | null; status: string };

export function githubSourceTag(url: string): string | null {
  try {
    const u = new URL(url);
    const match = /^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)\/issues\/([1-9]\d*)$/.exec(u.pathname);
    return u.origin === "https://github.com" && !u.search && !u.hash && match ? `proposta:github:${match[1]}/${match[2]}#${match[3]}` : null;
  } catch { return null; }
}

export function latestReplyAt(notes: string | null): string | null {
  const matches = [...(notes ?? "").matchAll(/<!-- orbita-reply:[a-f0-9-]{36} at:(\d{4}-\d\d-\d\dT[\d:.]+Z) -->/g)];
  return matches.at(-1)?.[1] ?? null;
}

export function awaitsOwner(item: InboxItem, replies: ReplyTask[]): boolean {
  if (item.kind !== "proposta" || item.stage !== "decision") return false;
  const source = githubSourceTag(item.url);
  const reply = source && replies.find(task => task.tags.includes(source) && task.tags.includes(ANSWERED_TAG));
  const at = reply ? latestReplyAt(reply.notes) : null;
  return !at || Date.parse(item.updatedAt) > Date.parse(at);
}

export function replyText(id: string, message: string, origin: string, now = new Date()): string {
  return `\n\n---\nResposta de Antonio · ${now.toISOString()}\nOrigem: ${origin}\n\n${message}\n<!-- orbita-reply:${id} at:${now.toISOString()} -->`;
}

export function proposalDisplayNotes(notes: string): string {
  return notes.replace(/<!-- orbita-(?:reply:[a-f0-9-]{36} at:[^>]+|progress:[a-f0-9-]{36}) -->/g, "").trim();
}
