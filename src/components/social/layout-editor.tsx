"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CornerLeftUp, EyeOff, ImageDown, Loader2, Minus, PencilRuler, Plus, Redo2, RotateCcw, Save, Undo2 } from "lucide-react";
import { socialLayoutAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { embeddedFontCSS, renderPiece } from "@/components/social/layout-render";
import { LAYOUT_FILENAME, LAYOUT_TYPE, layoutFonts, parseTranslate, slideFileNames, toHex } from "@/lib/social-layout";

/**
 * Editor do layout do post. O slides.html abre num iframe sem scripts e tudo roda no navegador:
 * clicar seleciona, arrastar move, duplo clique edita o texto na própria arte, e o dock ajusta cor, fonte e tamanho.
 * Gerar imagens tira os JPGs ali mesmo; o servidor só guarda os arquivos.
 */
export function LayoutEditorButton({ postId, imageNames, onSaved }: { postId: string; imageNames: string[]; onSaved: (coverUrl: string | null) => void }) {
  const [open, setOpen] = React.useState(false);
  const [html, setHtml] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const load = async () => {
    setLoading(true);
    const r = await socialLayoutAction(postId);
    setLoading(false);
    if (!r.ok) return void toast.error(r.error);
    if (!r.data) return void toast.error("Este post ainda não tem layout anexado.");
    setHtml(r.data.html);
    setOpen(true);
  };
  return <>
    <button type="button" onClick={() => void load()} disabled={loading} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs hover:bg-surface-2 disabled:opacity-60">
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : <PencilRuler className="size-3.5" />}Editar layout
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      {open && html && <DialogContent title="Editar layout" description="Clique para selecionar · arraste para mover · duplo clique edita o texto" wide className="top-[2vh] max-h-[96vh] max-w-[min(1180px,98vw)] p-3 sm:p-4">
        <Editor postId={postId} html={html} imageNames={imageNames} onDone={url => { setOpen(false); onSaved(url); }} />
      </DialogContent>}
    </Dialog>
  </>;
}

const EDITOR_CSS = "[data-orbita-sel]{outline:4px solid #ff6a00!important;outline-offset:2px;cursor:move!important}[data-orbita-sel][contenteditable]{outline-style:dashed!important;cursor:text!important}img{-webkit-user-drag:none;user-select:none}html,body{cursor:default}";
const WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];

/** As peças a exportar: os slides id="s1".."sN" (render.mjs) ou, na peça única, a página inteira. */
function pieces(d: Document): HTMLElement[] {
  const slides = [...d.querySelectorAll<HTMLElement>("[id^='s']")].filter(s => /^s\d+$/.test(s.id)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  if (slides.length) return slides;
  const only = d.body.children.length === 1 ? (d.body.firstElementChild as HTMLElement) : null;
  return [only && only.offsetWidth >= 1000 ? only : d.body];
}

function Editor({ postId, html, imageNames, onDone }: { postId: string; html: string; imageNames: string[]; onDone: (coverUrl: string | null) => void }) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const [height, setHeight] = React.useState(1350);
  const [count, setCount] = React.useState(0);
  const [sel, setSel] = React.useState<HTMLElement | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const history = React.useRef<{ undo: string[]; redo: string[]; key: string; at: number }>({ undo: [], redo: [], key: "", at: 0 });
  const selRef = React.useRef<HTMLElement | null>(null);
  const fonts = React.useMemo(() => layoutFonts(html), [html]);
  const doc = () => frame.current?.contentDocument ?? null;

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    // Um slide inteiro cabe na tela: a escala segue a menor folga (largura ou altura).
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.width - 2) / 1080, (e.contentRect.height - 8) / 1350)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => { const d = doc(); if (d) setHeight(d.documentElement.scrollHeight); };
  const stopEditing = () => {
    const t = selRef.current;
    if (t?.hasAttribute("contenteditable")) { t.removeAttribute("contenteditable"); measure(); }
    setEditing(false);
  };
  const select = (el: HTMLElement | null) => {
    stopEditing();
    doc()?.querySelectorAll("[data-orbita-sel]").forEach(n => n.removeAttribute("data-orbita-sel"));
    el?.setAttribute("data-orbita-sel", "");
    selRef.current = el;
    setSel(el);
  };
  /** Guarda o estado antes de mudar. Mudanças seguidas no mesmo ajuste viram um passo só. */
  const before = (key: string) => {
    const d = doc(), h = history.current, now = Date.now();
    if (!d || (h.key === key && now - h.at < 1200)) { h.at = now; return; }
    h.undo.push(d.body.innerHTML); if (h.undo.length > 60) h.undo.shift();
    h.redo = []; h.key = key; h.at = now;
  };
  const restore = (from: "undo" | "redo") => {
    const d = doc(), h = history.current;
    const snap = h[from].pop();
    if (!d || snap === undefined) return;
    select(null);
    h[from === "undo" ? "redo" : "undo"].push(d.body.innerHTML);
    d.body.innerHTML = snap; h.key = "";
    d.querySelectorAll("[data-orbita-sel],[contenteditable]").forEach(n => { n.removeAttribute("data-orbita-sel"); n.removeAttribute("contenteditable"); });
    measure();
  };
  const change = (key: string, fn: (el: HTMLElement) => void) => { const el = selRef.current; if (!el) return; before(key); fn(el); bump(); measure(); };
  const move = (dx: number, dy: number) => change("move", el => { const [x, y] = parseTranslate(el.style.translate); el.style.translate = `${Math.round(x + dx)}px ${Math.round(y + dy)}px`; });
  /** Liga a edição no próprio slide. Com o ponto do duplo clique, já seleciona a palavra embaixo do mouse. */
  const editText = (el: HTMLElement, at?: { x: number; y: number }) => {
    if (!el.textContent?.trim()) return;
    before("text");
    el.setAttribute("contenteditable", "true");
    el.focus();
    const d = el.ownerDocument, s = d.getSelection();
    const range = at ? d.caretRangeFromPoint?.(at.x, at.y) : null;
    if (s && range && el.contains(range.startContainer)) {
      s.removeAllRanges(); s.addRange(range);
      s.modify?.("move", "backward", "word"); s.modify?.("extend", "forward", "word");
    } else if (s) { s.selectAllChildren(el); s.collapseToEnd(); }
    setEditing(true);
  };

  const onLoad = () => {
    const d = doc();
    if (!d) return;
    const st = d.createElement("style"); st.id = "orbita-editor"; st.textContent = EDITOR_CSS; d.head.appendChild(st);
    const pick = (t: EventTarget | null) => { const el = t as HTMLElement; return el === d.body || el === d.documentElement ? null : el; };
    // Arrastar o selecionado move; clique sem arrastar só seleciona.
    let drag: { x: number; y: number; ox: number; oy: number; moved: boolean } | null = null;
    d.addEventListener("pointerdown", e => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable) return;
      const el = pick(t);
      if (el !== selRef.current) { select(el); if (!el) return; }
      const [ox, oy] = parseTranslate(el!.style.translate);
      drag = { x: e.clientX, y: e.clientY, ox, oy, moved: false };
      e.preventDefault();
    });
    d.addEventListener("pointermove", e => {
      const el = selRef.current;
      if (!drag || !el) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      if (!drag.moved) { before(`drag${Date.now()}`); drag.moved = true; }
      el.style.translate = `${Math.round(drag.ox + dx)}px ${Math.round(drag.oy + dy)}px`;
    });
    d.addEventListener("pointerup", () => { if (drag?.moved) bump(); drag = null; });
    d.addEventListener("click", e => { if (!(e.target as HTMLElement).isContentEditable) e.preventDefault(); }, true);
    d.addEventListener("dblclick", e => { const el = pick(e.target); if (el) { if (el !== selRef.current) select(el); editText(el, { x: e.clientX, y: e.clientY }); } });
    d.addEventListener("keydown", e => {
      if ((e.target as HTMLElement).isContentEditable) { if (e.key === "Escape") { e.preventDefault(); stopEditing(); bump(); } return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); restore(e.shiftKey ? "redo" : "undo"); return; }
      keys(e);
    });
    d.addEventListener("focusout", e => { if ((e.target as HTMLElement).isContentEditable) { stopEditing(); bump(); } });
    setCount(pieces(d).length);
    measure();
    void d.fonts?.ready.then(measure);
  };
  /** Setas movem (Shift = 10 px), Esc solta a seleção. Vale com o foco na arte ou no dock. */
  const keys = (e: KeyboardEvent | React.KeyboardEvent) => {
    if (!selRef.current || (e.target as HTMLElement).closest?.("input,select")) return;
    if (e.key === "Escape") { e.preventDefault(); select(null); return; }
    const step = e.shiftKey ? 10 : 2;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    if (d) { e.preventDefault(); move(d[0], d[1]); }
  };

  /** HTML final sem as marcas do editor. */
  const serialize = () => {
    const d = doc();
    if (!d) throw new Error("Layout não carregou.");
    const root = d.documentElement.cloneNode(true) as HTMLElement;
    root.querySelector("#orbita-editor")?.remove();
    root.querySelectorAll("[data-orbita-sel]").forEach(n => n.removeAttribute("data-orbita-sel"));
    root.querySelectorAll("[contenteditable]").forEach(n => n.removeAttribute("contenteditable"));
    return `<!doctype html>\n${root.outerHTML}`;
  };
  const upload = async (file: File, cover = false) => {
    const body = new FormData();
    body.set("file", file); body.set("postId", postId);
    if (cover) body.set("capa", "1");
    const res = await fetch("/api/redes/midia", { method: "POST", body });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !json.url) throw new Error(json.error ?? `Falha ao enviar ${file.name}.`);
    return json.url;
  };
  const saveLayout = () => upload(new File([serialize()], LAYOUT_FILENAME, { type: LAYOUT_TYPE }));

  const save = async () => {
    select(null);
    setBusy("Salvando…");
    try { await saveLayout(); toast.success("Layout salvo"); onDone(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(null); }
  };
  const exportSlides = async () => {
    const d = doc();
    if (!d) return;
    const list = pieces(d);
    if (list.length > 10) return void toast.error(`${list.length} slides; o Instagram aceita até 10.`);
    select(null);
    setBusy("Salvando layout…");
    try {
      await saveLayout();
      setBusy("Carregando fontes…");
      const fontCSS = await embeddedFontCSS(d);
      const ids = list.filter(s => s !== d.body).map(s => s.id).filter(id => /^s\d+$/.test(id));
      const names = slideFileNames(list.length, imageNames);
      let cover: string | null = null;
      for (const [i, s] of list.entries()) {
        setBusy(`Gerando ${i + 1}/${list.length}…`);
        // Janela de 1080 px como no render.mjs; a altura é a do slide (1350 no feed, 1920 na capa de reel).
        const slide = ids.includes(s.id);
        const h = slide ? s.offsetHeight : Math.max(1350, Math.min(s.offsetHeight || 1350, 1920));
        const blob = await renderPiece(d, { keepId: slide ? s.id : null, allIds: ids, width: 1080, height: h, fontCSS });
        const url = await upload(new File([blob], names[i], { type: "image/jpeg" }), i === 0);
        if (i === 0) cover = url;
      }
      toast.success(list.length > 1 ? `${list.length} slides gerados e salvos no post` : "Imagem gerada e salva no post");
      // Slides antigos com número maior continuam no post e iriam junto no carrossel.
      const prefix = names[0].replace(/-\d{2}\.jpg$/, "");
      const stale = imageNames.filter(f => { const m = /^(.*)-(\d{2})\.(jpe?g|png|webp)$/i.exec(f); return m && m[1] === prefix && Number(m[2]) > list.length; });
      if (stale.length) toast.warning(`O post ainda tem ${stale.length} slide(s) antigo(s) além do ${list.length} (${stale.join(", ")}). Eles vão junto no carrossel: peça ao agente para tirar ou reenvie o layout com esses slides.`);
      onDone(cover);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar as imagens."); }
    finally { setBusy(null); }
  };

  return <div className="flex flex-col gap-2" onKeyDown={e => keys(e)}>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">{count > 1 ? `${count} slides` : "Peça única"}</span>
      <Button size="sm" variant="ghost" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" className="ml-2" onClick={() => restore("undo")}><Undo2 /></Button>
      <Button size="sm" variant="ghost" title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" onClick={() => restore("redo")}><Redo2 /></Button>
      <div className="ml-auto flex gap-1.5">
        <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void save()}><Save />Salvar layout</Button>
        <Button size="sm" disabled={Boolean(busy)} onClick={() => void exportSlides()}>{busy ? <><Loader2 className="animate-spin" />{busy}</> : <><ImageDown />Gerar imagens</>}</Button>
      </div>
    </div>
    <div className="relative">
      <div ref={box} className="h-[calc(96vh-8.5rem)] min-h-80 overflow-auto rounded-xl border border-border bg-[#2a2a2c] pb-16">
        <div style={{ width: 1080 * scale, height: height * scale }} className="mx-auto">
          <iframe ref={frame} title="Layout do post" sandbox="allow-same-origin" srcDoc={html} onLoad={onLoad}
            style={{ width: 1080, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block" }} />
        </div>
      </div>
      {sel && <Dock el={sel} editing={editing} fonts={fonts} change={change} move={move}
        onParent={() => { const p = sel.parentElement; if (p && p !== sel.ownerDocument.body) select(p); }}
        onEdit={() => editText(sel)} onClose={() => select(null)} />}
    </div>
  </div>;
}

/** Barra flutuante com os ajustes do elemento selecionado. */
function Dock({ el, editing, fonts, change, move, onParent, onEdit, onClose }: {
  el: HTMLElement; editing: boolean; fonts: string[];
  change: (key: string, fn: (el: HTMLElement) => void) => void; move: (dx: number, dy: number) => void;
  onParent: () => void; onEdit: () => void; onClose: () => void;
}) {
  const cs = el.ownerDocument.defaultView?.getComputedStyle(el);
  const family = cs?.fontFamily.split(",")[0].replace(/["']/g, "").trim() ?? "";
  const size = Math.round(parseFloat(cs?.fontSize ?? "16"));
  const [tx, ty] = parseTranslate(el.style.translate);
  const hasText = Boolean(el.textContent?.trim());
  const isImg = el.tagName === "IMG";
  const changed = Boolean(el.getAttribute("style")?.match(/translate|color|font|visibility|background/));
  const sep = <span className="mx-0.5 h-5 w-px shrink-0 bg-border" />;
  const icon = "grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg";
  const swatch = (label: string, value: string, key: string, apply: (el: HTMLElement, v: string) => void) =>
    <label title={label} className="relative grid size-7 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-surface-2">
      <span className="size-4 rounded-full border border-border-strong" style={{ background: value }} />
      <input type="color" aria-label={label} value={value} onChange={e => change(key, n => apply(n, e.target.value))} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>;
  return <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center px-2" onPointerDown={e => e.stopPropagation()}>
    <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border-strong bg-surface/95 p-1 shadow-soft backdrop-blur">
      {hasText && !isImg && <>
        <button type="button" onClick={onEdit} disabled={editing} className={`h-7 shrink-0 rounded-md px-2 text-xs ${editing ? "bg-accent/15 text-accent" : "hover:bg-surface-2"}`}>{editing ? "Editando… Esc sai" : "Editar texto"}</button>
        {sep}
        {swatch("Cor do texto", toHex(cs?.color ?? "") ?? "#000000", "color", (n, v) => { n.style.color = v; })}
      </>}
      {swatch("Fundo", toHex(cs?.backgroundColor ?? "") ?? "#ffffff", "bg", (n, v) => { n.style.backgroundColor = v; })}
      {hasText && !isImg && <>
        {sep}
        <select aria-label="Fonte" title="Fonte" value={family} onChange={e => change("font", n => { n.style.fontFamily = `"${e.target.value}"`; })} className="h-7 max-w-40 shrink-0 rounded-md bg-transparent px-1 text-xs hover:bg-surface-2">
          {[family, ...fonts.filter(f => f !== family)].filter(Boolean).map(f => <option key={f}>{f}</option>)}
        </select>
        <button type="button" aria-label="Diminuir fonte" className={icon} onClick={() => change("size", n => { n.style.fontSize = `${Math.max(6, size - 2)}px`; })}><Minus className="size-3.5" /></button>
        <input aria-label="Tamanho da fonte" type="number" min={6} max={400} value={size} onChange={e => { const v = Number(e.target.value); if (v >= 6) change("size", n => { n.style.fontSize = `${v}px`; }); }} className="h-7 w-11 shrink-0 rounded-md bg-transparent text-center text-xs tabular-nums hover:bg-surface-2" />
        <button type="button" aria-label="Aumentar fonte" className={icon} onClick={() => change("size", n => { n.style.fontSize = `${size + 2}px`; })}><Plus className="size-3.5" /></button>
        <select aria-label="Peso" title="Peso" value={cs?.fontWeight ?? "400"} onChange={e => change("weight", n => { n.style.fontWeight = e.target.value; })} className="h-7 shrink-0 rounded-md bg-transparent px-1 text-xs hover:bg-surface-2">
          {WEIGHTS.map(w => <option key={w}>{w}</option>)}
        </select>
      </>}
      {sep}
      <button type="button" aria-label="Mover para a esquerda" className={icon} onClick={() => move(-10, 0)}><ArrowLeft className="size-3.5" /></button>
      <button type="button" aria-label="Mover para cima" className={icon} onClick={() => move(0, -10)}><ArrowUp className="size-3.5" /></button>
      <button type="button" aria-label="Mover para baixo" className={icon} onClick={() => move(0, 10)}><ArrowDown className="size-3.5" /></button>
      <button type="button" aria-label="Mover para a direita" className={icon} onClick={() => move(10, 0)}><ArrowRight className="size-3.5" /></button>
      {(tx !== 0 || ty !== 0) && <span className="shrink-0 px-1 text-[10px] tabular-nums text-faint">{tx},{ty}</span>}
      {sep}
      <button type="button" title="Esconder" aria-label="Esconder elemento" className={icon} onClick={() => change("hide", n => { n.style.visibility = "hidden"; })}><EyeOff className="size-3.5" /></button>
      <button type="button" title="Selecionar o bloco de fora" aria-label="Selecionar o bloco de fora" className={icon} onClick={onParent}><CornerLeftUp className="size-3.5" /></button>
      {changed && <button type="button" title="Desfazer os ajustes deste elemento" aria-label="Voltar ao original" className={icon} onClick={() => change("reset", n => { for (const p of ["translate", "color", "background-color", "font-family", "font-size", "font-weight", "visibility"]) n.style.removeProperty(p); })}><RotateCcw className="size-3.5" /></button>}
      <button type="button" onClick={onClose} className="h-7 shrink-0 rounded-md px-2 text-xs text-muted hover:bg-surface-2">OK</button>
    </div>
  </div>;
}
