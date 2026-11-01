// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/app/actions/core", () => ({ autosaveNote: vi.fn(), createNote: vi.fn(), deleteNote: vi.fn(), saveNote: vi.fn(), setNoteArchived: vi.fn() }));
vi.mock("@/components/markdown/editor", () => ({ MarkdownEditor: () => createElement("textarea", { "aria-label": "Editor" }) }));
vi.mock("@/components/markdown/view", () => ({ MarkdownView: ({ content }: { content: string }) => createElement("p", null, content) }));
import { NotesPage } from "@/components/notes/notes-page";
import type { Note } from "@/db/schema";

it("abre leitura no painel e só libera edição após escolha explícita", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const note: Note = { id: "11111111-1111-4111-8111-111111111111", title: "Nota de exemplo", content: "Detalhes da nota", tags: [], pinned: false, createdAt: new Date(), updatedAt: new Date() };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(NotesPage, { notes: [note], selected: note, scope: "empresa" })); });
  const title = container.querySelector<HTMLInputElement>('[aria-label="Título da nota"]')!;
  expect(title.readOnly).toBe(true);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  const edit = [...container.querySelectorAll("button")].find(button => button.textContent === "Editar")!;
  await act(async () => { edit.click(); });
  expect(title.readOnly).toBe(false);
  expect(container.querySelector('[aria-label="Editor"]')).not.toBeNull();
  const item = [...container.querySelectorAll("button")].find(button => button.textContent?.includes("Nota de exemplo"))!;
  await act(async () => { item.click(); });
  expect(title.readOnly).toBe(true);
  expect(push).toHaveBeenCalledWith(`/notas?escopo=empresa&id=${note.id}`);
  await act(async () => { root.unmount(); });
  container.remove();
});
