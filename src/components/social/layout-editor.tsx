"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, ImageDown, Loader2, MousePointerClick, PencilRuler, Redo2, Save, Type, Undo2 } from "lucide-react";
import { socialLayoutAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LAYOUT_FILENAME, LAYOUT_TYPE, layoutFonts, parseTranslate, slideFileNames, toHex } from "@/lib/social-layout";

/**
 * Editor do layout do post. O slides.html abre num iframe sem scripts e tudo roda no navegador:
 * selecionar, trocar texto, cor, fonte, tamanho e posição, e gerar os JPGs. O servidor só guarda os arquivos.
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
      {open && html && <DialogContent title="Editar layout" description="Clique num elemento para ajustar. Setas movem (Shift = 10 px). Gerar imagens salva o layout e troca os slides do post." wide className="top-[2vh] max-h-[96vh] max-w-[min(1360px,98vw)]">
        <Editor postId={postId} html={html} imageNames={imageNames} onDone={url => { setOpen(false); onSaved(url); }} />
      </DialogContent>}
    </Dialog>
  </>;
}

const EDITOR_CSS = "[data-orbita-sel]{outline:4px solid #ff6a00!important;outline-offset:2px}[contenteditable]{outline:4px dashed #ff6a00!important;cursor:text!important}html,body{cursor:default}";
const WEIGHTS = ["400", "500", "600", "700", "800", "900"];

function Editor({ postId, html, imageNames, onDone }: { postId: string; html: string; imageNames: string[]; onDone: (coverUrl: string | null) => void }) {
  const frame = React.useRef<HTMLIFrameElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(0.5);
  const [height, setHeight] = React.useState(1350);
  const [sel, setSel] = React.useState<HTMLElement | null>(null);
  const [, bump] = React.useReducer((n: number) => n + 1, 0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const history = React.useRef<{ undo: string[]; redo: string[]; key: string; at: number }>({ undo: [], redo: [], key: "", at: 0 });
  const fonts = React.useMemo(() => layoutFonts(html), [html]);
  const doc = () => frame.current?.contentDocument ?? null;

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / 1080)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => { const d = doc(); if (d) setHeight(d.documentElement.scrollHeight); };
  const select = (el: HTMLElement | null) => {
    const d = doc();
    d?.querySelectorAll("[data-orbita-sel]").forEach(n => n.removeAttribute("data-orbita-sel"));
    el?.setAttribute("data-orbita-sel", "");
    setSel(el);
  };
  /** Guarda o estado antes de mudar. Mudanças seguidas no mesmo campo viram um passo só. */
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
    h[from === "undo" ? "redo" : "undo"].push(d.body.innerHTML);
    d.body.innerHTML = snap; h.key = "";
    select(null); measure();
  };
  const change = (key: string, fn: (el: HTMLElement) => void) => { if (!sel) return; before(`${key}`); fn(sel); bump(); measure(); };
  const move = (dx: number, dy: number) => change("move", el => { const [x, y] = parseTranslate(el.style.translate); el.style.translate = `${x + dx}px ${y + dy}px`; });

  const onLoad = () => {
    const d = doc();
    if (!d) return;
    const st = d.createElement("style"); st.id = "orbita-editor"; st.textContent = EDITOR_CSS; d.head.appendChild(st);
    d.addEventListener("click", e => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable) return;
      e.preventDefault();
      select(t === d.body || t === d.documentElement ? null : t);
    }, true);
    d.addEventListener("keydown", e => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable) { if (e.key === "Escape") t.blur(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); restore(e.shiftKey ? "redo" : "undo"); }
    });
    d.addEventListener("focusout", e => { const t = e.target as HTMLElement; if (t.isContentEditable) { t.removeAttribute("contenteditable"); measure(); } });
    measure();
    void d.fonts?.ready.then(measure);
  };
  // Setas movem o elemento selecionado, com o foco no editor (fora de campos de texto).
  const onKey = (e: React.KeyboardEvent) => {
    if (!sel || (e.target as HTMLElement).closest("input,textarea,select")) return;
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
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
    setBusy("Salvando…");
    try { await saveLayout(); toast.success("Layout salvo"); onDone(null); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(null); }
  };
  const exportSlides = async () => {
    const d = doc();
    if (!d) return;
    const slides = [...d.querySelectorAll<HTMLElement>(".slide[id^='s']")].filter(s => /^s\d+$/.test(s.id)).sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
    if (!slides.length) return void toast.error('Nenhum slide com id="s1".."sN" no layout.');
    if (slides.length > 10) return void toast.error(`${slides.length} slides; o Instagram aceita até 10.`);
    select(null);
    setBusy("Salvando layout…");
    try {
      await saveLayout();
      const { toBlob, getFontEmbedCSS } = await import("html-to-image");
      const fontEmbedCSS = await getFontEmbedCSS(slides[0]).catch(() => "");
      const names = slideFileNames(slides.length, imageNames);
      let cover: string | null = null;
      for (const [i, s] of slides.entries()) {
        setBusy(`Gerando ${i + 1}/${slides.length}…`);
        const blob = await toBlob(s, { width: s.offsetWidth, height: s.offsetHeight, pixelRatio: 1, quality: 0.94, type: "image/jpeg", backgroundColor: "#000", fontEmbedCSS, style: { margin: "0" } });
        if (!blob) throw new Error(`Não consegui gerar o slide ${i + 1}.`);
        const url = await upload(new File([blob], names[i], { type: "image/jpeg" }), i === 0);
        if (i === 0) cover = url;
      }
      toast.success(`${slides.length} slide(s) gerado(s) e salvos no post`);
      onDone(cover);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao gerar as imagens."); }
    finally { setBusy(null); }
  };

  const cs = sel?.ownerDocument.defaultView?.getComputedStyle(sel) ?? null;
  const leafText = sel && sel.children.length === 0 ? sel.textContent ?? "" : null;
  const [tx, ty] = parseTranslate(sel?.style.translate);
  const family = cs?.fontFamily.split(",")[0].replace(/["']/g, "").trim() ?? "";
  const where = sel ? `${sel.tagName.toLowerCase()}${sel.classList.length ? "." + [...sel.classList].filter(c => c !== "slide").join(".") : ""}${sel.closest(".slide")?.id ? ` · slide ${sel.closest(".slide")!.id.slice(1)}` : ""}` : "";

  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]" onKeyDown={onKey} tabIndex={-1}>
    <div ref={box} className="max-h-[78vh] overflow-auto rounded-xl border border-border bg-[#2a2a2c]">
      <div style={{ width: 1080 * scale, height: height * scale }}>
        <iframe ref={frame} title="Layout do post" sandbox="allow-same-origin" srcDoc={html} onLoad={onLoad}
          style={{ width: 1080, height, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", display: "block" }} />
      </div>
    </div>
    <aside className="space-y-3 text-xs">
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" title="Desfazer (Ctrl+Z)" onClick={() => restore("undo")}><Undo2 /></Button>
        <Button size="sm" variant="ghost" title="Refazer (Ctrl+Shift+Z)" onClick={() => restore("redo")}><Redo2 /></Button>
        {sel?.parentElement && sel.parentElement !== sel.ownerDocument.body && <Button size="sm" variant="ghost" className="ml-auto" onClick={() => select(sel.parentElement)}>Selecionar o de fora</Button>}
      </div>
      {!sel ? <p className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-muted"><MousePointerClick className="size-4 shrink-0" />Clique num texto, imagem ou bloco do slide para editar.</p> : <div className="space-y-3">
        <p className="truncate font-mono text-[11px] text-muted" title={where}>{where}</p>
        {leafText !== null && leafText.trim() !== "" && <label className="block space-y-1"><span className="text-muted">Texto</span>
          <textarea rows={3} value={leafText} onChange={e => change("text", el => { el.textContent = e.target.value; })} className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm" /></label>}
        {sel.textContent?.trim() && <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => { before("edit"); sel.setAttribute("contenteditable", "true"); sel.focus(); }}><Type />Editar texto direto no slide</Button>}
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1"><span className="text-muted">Cor do texto</span>
            <input type="color" value={toHex(cs?.color ?? "") ?? "#000000"} onChange={e => change("color", el => { el.style.color = e.target.value; })} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted">Fundo</span>
            <input type="color" value={toHex(cs?.backgroundColor ?? "") ?? "#ffffff"} onChange={e => change("bg", el => { el.style.backgroundColor = e.target.value; })} className="h-8 w-full cursor-pointer rounded border border-border bg-transparent" /></label>
          <label className="space-y-1"><span className="text-muted">Tamanho (px)</span>
            <input type="number" min={6} max={400} value={Math.round(parseFloat(cs?.fontSize ?? "16"))} onChange={e => { const v = Number(e.target.value); if (v >= 6) change("size", el => { el.style.fontSize = `${v}px`; }); }} className="h-8 w-full rounded border border-border bg-surface px-2" /></label>
          <label className="space-y-1"><span className="text-muted">Peso</span>
            <select value={cs?.fontWeight ?? "400"} onChange={e => change("weight", el => { el.style.fontWeight = e.target.value; })} className="h-8 w-full rounded border border-border bg-surface px-1">{WEIGHTS.map(w => <option key={w}>{w}</option>)}</select></label>
        </div>
        <label className="block space-y-1"><span className="text-muted">Fonte</span>
          <select value={family} onChange={e => change("font", el => { el.style.fontFamily = `"${e.target.value}"`; })} className="h-8 w-full rounded border border-border bg-surface px-1">
            {[family, ...fonts.filter(f => f !== family)].filter(Boolean).map(f => <option key={f}>{f}</option>)}
          </select></label>
        <div className="space-y-1">
          <span className="text-muted">Posição · {tx}, {ty} px</span>
          <div className="grid grid-cols-4 gap-1">
            <Button size="sm" variant="ghost" aria-label="Esquerda" onClick={() => move(-10, 0)}><ArrowLeft /></Button>
            <Button size="sm" variant="ghost" aria-label="Cima" onClick={() => move(0, -10)}><ArrowUp /></Button>
            <Button size="sm" variant="ghost" aria-label="Baixo" onClick={() => move(0, 10)}><ArrowDown /></Button>
            <Button size="sm" variant="ghost" aria-label="Direita" onClick={() => move(10, 0)}><ArrowRight /></Button>
          </div>
          {(tx !== 0 || ty !== 0) && <button type="button" className="text-muted underline" onClick={() => change("move", el => { el.style.translate = ""; })}>Voltar à posição original</button>}
        </div>
        <Button size="sm" variant="ghost" className="w-full justify-start" onClick={() => change("hide", el => { el.style.visibility = el.style.visibility === "hidden" ? "" : "hidden"; })}>
          {sel.style.visibility === "hidden" ? <><Eye />Mostrar elemento</> : <><EyeOff />Esconder elemento</>}
        </Button>
      </div>}
      <div className="space-y-2 border-t border-border pt-3">
        <Button className="w-full" disabled={Boolean(busy)} onClick={() => void exportSlides()}>{busy ? <><Loader2 className="animate-spin" />{busy}</> : <><ImageDown />Gerar imagens</>}</Button>
        <Button variant="ghost" className="w-full" disabled={Boolean(busy)} onClick={() => void save()}><Save />Só salvar o layout</Button>
        <p className="text-[11px] text-faint">As imagens saem no navegador, em 1080 px, com os mesmos nomes dos slides atuais. O post continua na mesma etapa.</p>
      </div>
    </aside>
  </div>;
}
