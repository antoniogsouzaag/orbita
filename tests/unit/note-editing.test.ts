// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { NotesPage } from "@/components/notes/notes-page";
import type { Note } from "@/db/schema";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => (props: { value: string }) => createElement("textarea", { "aria-label": "Editor de teste", defaultValue: props.value }) }));
vi.mock("@/app/actions/core", () => ({ autosaveNote: vi.fn(), createNote: vi.fn(), deleteNote: vi.fn(), saveNote: vi.fn(), setNoteArchived: vi.fn() }));
afterEach(() => { document.body.innerHTML = ""; });
it("duplo clique abre o editor; Escape retorna à leitura e não chega ao atalho da sidebar", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div"); document.body.append(host);
  const root = createRoot(host);
  const note = { id: "00000000-0000-4000-8000-000000000001", title: "Teste", content: "Texto da nota", tags: [], pinned: false, scope: "empresa", createdAt: new Date(), updatedAt: new Date() } as Note;
  const sidebarShortcut = vi.fn(); window.addEventListener("keydown", sidebarShortcut);
  try {
    await act(async () => root.render(createElement(NotesPage, { notes: [note], selected: note, scope: "empresa" })));
    await act(async () => host.querySelector(".prose-orbita")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    const editor = host.querySelector('[aria-label="Editor de teste"]')!;
    expect(editor).not.toBeNull(); expect(host.querySelector('[data-shell-layer="open"]')).not.toBeNull();
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    await act(async () => editor.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true); expect(sidebarShortcut).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Editor de teste"]')).toBeNull();
    expect(host.querySelector(".prose-orbita")?.textContent).toContain("Texto da nota");
  } finally { window.removeEventListener("keydown", sidebarShortcut); await act(async () => root.unmount()); }
});
