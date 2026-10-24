"use client";

import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import * as React from "react";

const highlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.45em", fontWeight: "700", color: "var(--text)" },
  { tag: t.heading2, fontSize: "1.25em", fontWeight: "650", color: "var(--text)" },
  { tag: t.heading3, fontSize: "1.1em", fontWeight: "600", color: "var(--text)" },
  { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600", color: "var(--text)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--accent)" },
  { tag: t.monospace, color: "#f59e0b" },
  { tag: [t.processingInstruction, t.meta, t.contentSeparator], color: "var(--faint)" },
  { tag: t.quote, color: "var(--muted)", fontStyle: "italic" },
  { tag: t.list, color: "var(--muted)" },
  { tag: [t.keyword, t.atom], color: "#c084fc" },
  { tag: t.string, color: "#86efac" },
  { tag: t.comment, color: "var(--faint)" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--text)", backgroundColor: "transparent" },
  ".cm-content": { fontFamily: "var(--font-mono)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-activeLine": { backgroundColor: "transparent" },
});

/** Editor markdown com autocompletar de [[wikilinks]] e salvamento com Ctrl+S. */
export function MarkdownEditor({
  value,
  onChange,
  onSave,
  linkTargets = [],
  placeholder,
  minHeight = "60vh",
}: {
  value: string;
  onChange: (v: string) => void;
  onSave?: () => void;
  linkTargets?: string[];
  placeholder?: string;
  minHeight?: string;
}) {
  const targets = React.useRef(linkTargets);
  const save = React.useRef(onSave);
  React.useEffect(() => {
    targets.current = linkTargets;
    save.current = onSave;
  }, [linkTargets, onSave]);

  const extensions = React.useMemo(() => {
    const wikiComplete = (ctx: CompletionContext) => {
      const m = ctx.matchBefore(/\[\[[^\]\n]*/);
      if (!m) return null;
      const q = m.text.slice(2).toLowerCase();
      const options = targets.current
        .filter((n) => n.toLowerCase().includes(q))
        .slice(0, 50)
        .map((n) => ({ label: n, apply: `${n}]]`, type: "text" }));
      return { from: m.from + 2, options, validFor: /^[^\]\n]*$/ };
    };
    return [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      theme,
      // As refs só são lidas quando o usuário digita ou salva, nunca durante o render.
      // eslint-disable-next-line react-hooks/refs
      autocompletion({ override: [wikiComplete], icons: false }),
      // eslint-disable-next-line react-hooks/refs
      keymap.of([{ key: "Mod-s", preventDefault: true, run: () => (save.current?.(), true) }]),
    ];
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme="none"
      placeholder={placeholder}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
      style={{ minHeight }}
      minHeight={minHeight}
    />
  );
}
