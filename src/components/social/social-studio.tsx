"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, LayoutGrid, Plus, Sun, BarChart3, Trash2, Upload } from "lucide-react";
import { createSocialPostAction, deleteSocialPostAction, scheduleSocialPostAction, duplicateSocialPostAction, moveSocialPostAction, updateSocialPostAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { SocialPost } from "@/db/schema";
import {
  BRAND_LABELS, CAPTION_LIMITS, NETWORK_LABELS, SOCIAL_BRANDS, SOCIAL_FORMATS, SOCIAL_NETWORKS, SOCIAL_STAGES, STAGE_LABELS,
  calendarGaps, deliveryChecks, qualityScore, type SocialBrand, type SocialNetwork, type SocialStage,
} from "@/lib/social-pipeline";

type Tab = "hoje" | "producao" | "calendario" | "metricas";
const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "hoje", label: "Hoje", icon: <Sun className="size-4" /> },
  { key: "producao", label: "Produção", icon: <LayoutGrid className="size-4" /> },
  { key: "calendario", label: "Calendário", icon: <CalendarDays className="size-4" /> },
  { key: "metricas", label: "Métricas", icon: <BarChart3 className="size-4" /> },
];
const fmt = (d: Date | string | null) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem data";
const quality = (p: SocialPost) => qualityScore({ ...p, network: p.network as SocialNetwork });

export function SocialStudio({ posts, metrics, initialTab = "hoje", dbError }: { posts: SocialPost[]; metrics: React.ReactNode; initialTab?: Tab; dbError?: string | null }) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [brand, setBrand] = React.useState<SocialBrand | "todas">("todas");
  const [editing, setEditing] = React.useState<SocialPost | "new" | null>(null);
  const visible = brand === "todas" ? posts : posts.filter(p => p.brand === brand);
  const select = (next: Tab) => { setTab(next); const u = new URL(window.location.href); u.searchParams.set("aba", next); window.history.replaceState(null, "", u); };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav role="tablist" aria-label="Seções de redes" className="flex gap-1 rounded-xl border border-border p-1">
        {TABS.map(t => <button key={t.key} role="tab" type="button" aria-selected={tab === t.key} onClick={() => select(t.key)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${tab === t.key ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"}`}>{t.icon}{t.label}</button>)}
      </nav>
      {tab !== "metricas" && <div className="flex gap-2">
        <Select aria-label="Marca" value={brand} onChange={e => setBrand(e.target.value as SocialBrand | "todas")} className="w-44"><option value="todas">Todas as marcas</option>{SOCIAL_BRANDS.map(b => <option key={b} value={b}>{BRAND_LABELS[b]}</option>)}</Select>
        <Button size="sm" onClick={() => setEditing("new")}><Plus />Novo post</Button>
      </div>}
    </div>
    {dbError && tab !== "metricas" && <p role="alert" className="rounded-xl border border-warning/30 p-4 text-sm text-warning">{dbError}</p>}
    {tab === "hoje" && <Today posts={visible} onOpen={setEditing} />}
    {tab === "producao" && <Board posts={visible} onOpen={setEditing} />}
    {tab === "calendario" && <Calendar posts={visible} brand={brand} onOpen={setEditing} />}
    {tab === "metricas" && metrics}
    <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent wide className="max-w-3xl" title={editing === "new" ? "Novo post" : "Editar post"}>{editing !== null && <PostForm post={editing === "new" ? null : editing} defaultBrand={brand === "todas" ? "aglabs" : brand} onDone={() => setEditing(null)} />}</DialogContent>
    </Dialog>
  </div>;
}

function Today({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const [now] = React.useState(() => Date.now());
  const next48 = posts.filter(p => p.scheduledAt && ["aprovado", "agendado"].includes(p.stage) && new Date(p.scheduledAt).getTime() - now < 172800000);
  const overdue = posts.filter(p => p.scheduledAt && ["aprovado", "agendado"].includes(p.stage) && new Date(p.scheduledAt).getTime() < now);
  const review = posts.filter(p => p.stage === "revisao");
  const failed = posts.filter(p => p.stage === "falhou");
  const gaps = calendarGaps(posts.map(p => ({ ...p, brand: p.brand as SocialBrand, stage: p.stage as SocialStage })), new Date(now), 7);
  const ready = posts.filter(p => p.stage === "aprovado").length;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Próximas 48h" value={next48.length} />
      <Kpi label="Aguardando revisão" value={review.length} tone={review.length ? "accent" : undefined} />
      <Kpi label="Aprovados em estoque" value={ready} />
      <Kpi label="Falhas / atrasados" value={failed.length + overdue.length} tone={failed.length + overdue.length ? "warning" : undefined} />
    </div>
    <Card className="p-5"><h3 className="text-sm font-semibold">Lacunas nos próximos 7 dias</h3><div className="mt-3 grid gap-2 sm:grid-cols-4">{gaps.map(g => <div key={g.brand} className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">{BRAND_LABELS[g.brand]}</p><p className={`mt-1 text-lg font-semibold ${g.gaps >= 4 ? "text-warning" : ""}`}>{g.gaps} {g.gaps === 1 ? "dia vazio" : "dias vazios"}</p></div>)}</div><p className="mt-3 text-[11px] text-faint">Conta só posts aprovados, agendados ou publicados com data. Adaptações do mesmo conteúdo em canais diferentes contam como presença, não como ideias novas.</p></Card>
    <PostList title="Precisa de atenção" posts={[...failed, ...overdue, ...review]} onOpen={onOpen} empty="Nada travado agora." />
    <PostList title="Saindo nas próximas 48h" posts={next48} onOpen={onOpen} empty="Nenhum post agendado para as próximas 48 horas." />
  </div>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warning" | "accent" }) {
  return <Card className="p-4"><p className="text-xs text-muted">{label}</p><p className={`mt-2 text-3xl font-semibold tabular-nums ${tone === "warning" ? "text-warning" : tone === "accent" ? "text-accent" : ""}`}>{value}</p></Card>;
}

function PostList({ title, posts, onOpen, empty }: { title: string; posts: SocialPost[]; onOpen: (p: SocialPost) => void; empty: string }) {
  return <Card className="p-5"><h3 className="text-sm font-semibold">{title}</h3>{posts.length ? <ul className="mt-3 divide-y divide-border">{posts.map(p => <li key={p.id}><button type="button" onClick={() => onOpen(p)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:text-accent"><span className="min-w-0"><span className="block truncate text-sm">{p.title}</span><span className="text-[11px] text-muted">{BRAND_LABELS[p.brand as SocialBrand]} · {NETWORK_LABELS[p.network as SocialNetwork]} · {fmt(p.scheduledAt)}</span></span><span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] ${p.stage === "falhou" ? "bg-warning/15 text-warning" : "bg-surface-2 text-muted"}`}>{STAGE_LABELS[p.stage as SocialStage]}</span></button></li>)}</ul> : <p className="mt-3 text-sm text-muted">{empty}</p>}</Card>;
}

function Board({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [stage, setStage] = React.useState<SocialStage | "todos">("todos");
  const move = (p: SocialPost, to: SocialStage) => start(async () => {
    const r = await moveSocialPostAction(p.id, to);
    if (!r.ok) return void toast.error(r.error);
    if (r.data.aviso) toast.warning(r.data.aviso, { duration: 10_000 });
    else toast.success(r.data.post.stage === "agendado" ? "Aprovado e agendado no Postiz" : `Movido para ${STAGE_LABELS[to]}`);
    router.refresh();
  });
  const count = (s: SocialStage) => posts.filter(p => p.stage === s).length;
  const stages = SOCIAL_STAGES.filter(s => s !== "falhou" || count(s) > 0);
  const shown = stage === "todos" ? posts : posts.filter(p => p.stage === stage);
  const chip = (active: boolean) => `shrink-0 rounded-full border px-3 py-1 text-xs transition ${active ? "border-accent/40 bg-accent/15 text-accent" : "border-border text-muted hover:text-fg"}`;
  return <div aria-busy={pending} className="space-y-4">
    <nav aria-label="Etapas" className="flex gap-1.5 overflow-x-auto pb-1">
      <button type="button" aria-pressed={stage === "todos"} onClick={() => setStage("todos")} className={chip(stage === "todos")}>Todos <span className="tabular-nums opacity-70">{posts.length}</span></button>
      {stages.map(s => <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)} className={chip(stage === s)}>{STAGE_LABELS[s]} <span className="tabular-nums opacity-70">{count(s)}</span></button>)}
    </nav>
    {!shown.length ? <Card className="p-8 text-center text-sm text-muted">Nenhum post nesta etapa.</Card>
      : <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">{shown.map(p => <PostCard key={p.id} post={p} onOpen={() => onOpen(p)} onAdvance={to => move(p, to)} pending={pending} />)}</div>}
  </div>;
}

function PostCard({ post: p, onOpen, onAdvance, pending }: { post: SocialPost; onOpen: () => void; onAdvance: (to: SocialStage) => void; pending: boolean }) {
  const q = quality(p);
  const i = SOCIAL_STAGES.indexOf(p.stage as SocialStage);
  const next = i >= 0 && i < SOCIAL_STAGES.length - 2 ? SOCIAL_STAGES[i + 1] : null;
  return <article className="overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/30">
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="relative aspect-[4/5] bg-surface-2">
        {p.mediaUrl ? <MediaPreview url={p.mediaUrl} className="absolute inset-0 size-full rounded-none" /> : <div className="grid size-full place-items-center text-[11px] uppercase tracking-wider text-faint">{p.format} · sem capa</div>}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">{STAGE_LABELS[p.stage as SocialStage] ?? p.stage}</span>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">{p.title}</p>
        <p className="text-[11px] text-muted">{BRAND_LABELS[p.brand as SocialBrand]} · {p.format} · {fmt(p.scheduledAt)}</p>
      </div>
    </button>
    <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11px]" title={q.blocking.map(c => c.label).join("\n") || "Pronto para aprovar"}>
        <span className="h-1 w-12 overflow-hidden rounded-full bg-surface-2"><span className={`block h-full ${q.blocking.length ? "bg-warning" : "bg-success"}`} style={{ width: `${q.score}%` }} /></span>
        <span className={q.blocking.length ? "text-warning" : "text-success"}>{q.score}%</span>
      </span>
      {next && <button type="button" disabled={pending} onClick={() => onAdvance(next)} className="text-[11px] text-accent hover:underline">→ {STAGE_LABELS[next]}</button>}
    </div>
  </article>;
}

function Calendar({ posts, brand, onOpen }: { posts: SocialPost[]; brand: SocialBrand | "todas"; onOpen: (p: SocialPost) => void }) {
  const rows = calendarGaps(posts.map(p => ({ ...p, brand: p.brand as SocialBrand, stage: p.stage as SocialStage })), new Date(), 14).filter(r => brand === "todas" || r.brand === brand);
  const days = rows[0]?.days.map(d => d.day) ?? [];
  const label = (k: string) => new Date(`${k}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
  return <Card className="overflow-x-auto p-4"><table className="w-full min-w-[900px] text-xs"><thead><tr><th className="w-28 text-left text-muted">Marca</th>{days.map(d => <th key={d} className="px-1 text-center font-normal text-muted">{label(d)}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.brand} className="border-t border-border"><td className="py-2 font-medium">{BRAND_LABELS[r.brand]}<span className="block text-[10px] font-normal text-faint">{r.gaps} vazios</span></td>{r.days.map(d => <td key={d.day} className="p-1 align-top">{d.posts.length ? d.posts.map(p => <button type="button" key={p.id} onClick={() => onOpen(p as SocialPost)} title={p.title as string} className={`mb-1 block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] ${p.stage === "publicado" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{NETWORK_LABELS[p.network as SocialNetwork]}</button>) : <span className="block h-6 rounded-md border border-dashed border-border" aria-label="Sem post" />}</td>)}</tr>)}</tbody></table>
    <p className="mt-3 text-[11px] text-faint">Azul: aprovado/agendado. Verde: publicado. Tracejado: dia sem post confirmado.</p></Card>;
}

function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const parts = new Date(d).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16);
  return parts.replace(" ", "T");
}

function PostForm({ post, defaultBrand, onDone }: { post: SocialPost | null; defaultBrand: SocialBrand; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [f, setF] = React.useState({
    brand: (post?.brand ?? defaultBrand) as SocialBrand, network: (post?.network ?? "instagram") as SocialNetwork, format: post?.format ?? "reels",
    title: post?.title ?? "", hook: post?.hook ?? "", caption: post?.caption ?? "", cta: post?.cta ?? "", mediaUrl: post?.mediaUrl ?? "",
    referenceUrl: post?.referenceUrl ?? "", publishedUrl: post?.publishedUrl ?? "", scheduledAt: toLocalInput(post?.scheduledAt ?? null), notes: post?.notes ?? "",
    brandReviewed: Boolean(post?.checks?.brandReviewed), ctaDeliverable: Boolean(post?.checks?.ctaDeliverable),
    keyword: post?.checks?.keyword ?? "", libraryNeeded: Boolean(post?.checks?.libraryNeeded), n8nDone: Boolean(post?.checks?.n8nDone), pageDone: Boolean(post?.checks?.pageDone), libraryDone: Boolean(post?.checks?.libraryDone), mediaId: post?.checks?.mediaId ?? "",
  });
  const checks = { brandReviewed: f.brandReviewed, ctaDeliverable: f.ctaDeliverable, keyword: f.keyword.trim() || null, libraryNeeded: f.libraryNeeded, n8nDone: f.n8nDone, pageDone: f.pageDone, libraryDone: f.libraryDone, mediaId: f.mediaId.trim() || null };
  const deliveries = deliveryChecks({ checks });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const q = qualityScore({ ...f, checks });
  const limit = CAPTION_LIMITS[f.network];
  const payload = () => ({ brand: f.brand, network: f.network, format: f.format, title: f.title, hook: f.hook, caption: f.caption, cta: f.cta, mediaUrl: f.mediaUrl, referenceUrl: f.referenceUrl, publishedUrl: f.publishedUrl, notes: f.notes, scheduledAt: f.scheduledAt ? new Date(`${f.scheduledAt}:00-03:00`).toISOString() : null, checks });
  const [uploading, setUploading] = React.useState(false);
  /** Guarda o arquivo na Órbita e usa o link como mídia principal. */
  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      if (post) { body.set("postId", post.id); body.set("capa", "1"); }
      const res = await fetch("/api/redes/midia", { method: "POST", body });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Falha no envio.");
      set("mediaUrl", json.url);
      toast.success("Mídia enviada");
      if (post) router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio."); }
    finally { setUploading(false); }
  };
  const save = () => start(async () => {
    const r = post ? await updateSocialPostAction(post.id, payload()) : await createSocialPostAction(payload());
    if (!r.ok) return void toast.error(r.error);
    toast.success("Post salvo"); router.refresh(); onDone();
  });
  const remove = () => post && confirm("Excluir este post do pipeline?") && start(async () => { const r = await deleteSocialPostAction(post.id); if (!r.ok) toast.error(r.error); else { router.refresh(); onDone(); } });
  const [view, setView] = React.useState<"conteudo" | "checklist" | "mais">("conteudo");
  const tab = (k: typeof view, label: string, badge?: string) => <button type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 text-xs ${view === k ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>{label}{badge && <span className="ml-1 text-warning">{badge}</span>}</button>;
  const hasMedia = /^https?:\/\//.test(f.mediaUrl);
  return <div className="grid gap-5 sm:grid-cols-[13rem_minmax(0,1fr)]">
    <aside className="space-y-2">
      <div className="grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-border bg-surface-2">
        {hasMedia ? <MediaPreview url={f.mediaUrl} controls fit="contain" className="size-full rounded-none" /> : <span className="px-4 text-center text-[11px] text-faint">Sem capa ainda</span>}
      </div>
      <label className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs hover:bg-surface-2 ${uploading ? "pointer-events-none opacity-60" : ""}`}><Upload className="size-3.5" />{uploading ? "Enviando…" : hasMedia ? "Trocar capa" : "Enviar capa"}
        <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="sr-only" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} /></label>
      {hasMedia && <a href={f.mediaUrl} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] text-muted hover:text-fg">Abrir em tamanho real</a>}
      <div className={`rounded-lg px-2.5 py-2 text-center text-xs ${q.blocking.length ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>Qualidade {q.score}%{q.blocking.length ? ` · faltam ${q.blocking.length}` : " · pronto"}</div>
    </aside>
    <div className="flex min-w-0 flex-col gap-3">
      <div role="tablist" className="flex gap-1 border-b border-border pb-2">{tab("conteudo", "Conteúdo")}{tab("checklist", "Checklist", q.blocking.length ? String(q.blocking.length) : undefined)}{tab("mais", "Mais")}</div>
      {view === "conteudo" && <div className="space-y-3">
        <Field label="Título"><Input value={f.title} onChange={e => set("title", e.target.value)} maxLength={200} placeholder="Ex.: 3 automações que economizam 5h/semana" /></Field>
        <Field label="Gancho"><Input value={f.hook} onChange={e => set("hook", e.target.value)} maxLength={300} /></Field>
        <Field label={`Legenda · ${f.caption.length.toLocaleString("pt-BR")}/${limit.toLocaleString("pt-BR")}`}><Textarea rows={5} value={f.caption} onChange={e => set("caption", e.target.value)} className={f.caption.length > limit ? "border-warning" : ""} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="CTA"><Input value={f.cta} onChange={e => set("cta", e.target.value)} placeholder='Comente "GUIA"' /></Field>
          <Field label="Data e hora"><Input type="datetime-local" value={f.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} /></Field>
        </div>
      </div>}
      {view === "checklist" && <div className="space-y-4">
        <ul className="space-y-1.5 text-xs">{q.checks.map(c => <li key={c.key} className="flex gap-2">{c.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : c.required ? <AlertTriangle className="size-3.5 shrink-0 text-warning" /> : <Circle className="size-3.5 shrink-0 text-faint" />}<span className={c.ok ? "text-muted" : ""}>{c.label}{!c.required && " (opcional)"}</span></li>)}</ul>
        <div className="space-y-1 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={f.brandReviewed} onChange={e => set("brandReviewed", e.target.checked)} />Revisei tom e marca</label><label className="flex items-center gap-2"><input type="checkbox" checked={f.ctaDeliverable} onChange={e => set("ctaDeliverable", e.target.checked)} />Material do CTA existe e foi testado</label></div>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-medium">Entregas do CTA</p>
          <Input aria-label="Palavra-chave" className="uppercase" value={f.keyword} onChange={e => set("keyword", e.target.value.replace(/\s/g, ""))} maxLength={40} placeholder="Palavra-chave (ex.: ROTINA)" />
          {f.keyword.trim() ? <div className="space-y-1 text-xs">
            <label className="flex items-center gap-2"><input type="checkbox" checked={f.libraryNeeded} onChange={e => set("libraryNeeded", e.target.checked)} />É de imagem ou motion</label>
            {deliveries.map(c => <label key={c.key} className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={c.ok} onChange={e => set(c.key as "n8nDone" | "pageDone" | "libraryDone", e.target.checked)} /><span className={c.ok ? "text-muted line-through" : ""}>{c.label}</span></label>)}
            <Input aria-label="media_id do Instagram" inputMode="numeric" value={f.mediaId} onChange={e => set("mediaId", e.target.value.replace(/\D/g, ""))} placeholder="media_id do Instagram (após publicar)" />
          </div> : <p className="text-[11px] text-faint">Sem palavra-chave, não há entregas.</p>}
        </div>
      </div>}
      {view === "mais" && <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Marca"><Select value={f.brand} onChange={e => set("brand", e.target.value as SocialBrand)}>{SOCIAL_BRANDS.map(b => <option key={b} value={b}>{BRAND_LABELS[b]}</option>)}</Select></Field>
          <Field label="Rede"><Select value={f.network} onChange={e => set("network", e.target.value as SocialNetwork)}>{SOCIAL_NETWORKS.map(n => <option key={n} value={n}>{NETWORK_LABELS[n]}</option>)}</Select></Field>
          <Field label="Formato"><Select value={f.format} onChange={e => set("format", e.target.value)}>{SOCIAL_FORMATS.map(n => <option key={n} value={n}>{n}</option>)}</Select></Field>
        </div>
        <Field label="Link da capa"><Input value={f.mediaUrl} onChange={e => set("mediaUrl", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Referência / fonte"><Input value={f.referenceUrl} onChange={e => set("referenceUrl", e.target.value)} placeholder="https://…" /></Field>
        {post?.stage === "publicado" && <Field label="Link do post publicado"><Input value={f.publishedUrl} onChange={e => set("publishedUrl", e.target.value)} /></Field>}
        <Field label="Notas e roteiro"><Textarea rows={6} value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
        {post && <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Select aria-label="Adaptar para outra rede" className="max-w-56" value="" disabled={pending} onChange={e => { const to = e.target.value as SocialNetwork; if (to) start(async () => { const r = await duplicateSocialPostAction(post.id, to); if (!r.ok) toast.error(r.error); else { toast.success(`Adaptação para ${NETWORK_LABELS[to]} criada em Rascunho`); router.refresh(); onDone(); } }); }}><option value="">Adaptar para outra rede…</option>{SOCIAL_NETWORKS.filter(n => n !== post.network).map(n => <option key={n} value={n}>{NETWORK_LABELS[n]}</option>)}</Select>
          <Button size="sm" variant="ghost" disabled={pending} onClick={remove}><Trash2 />Excluir</Button>
        </div>}
      </div>}
      {post?.checks?.postiz && <p className="text-[11px] text-muted">No Postiz para {fmt(post.checks.postiz.scheduledFor)}. Mudanças feitas aqui depois disso não vão para o Postiz.</p>}
      <div className="mt-auto flex justify-end gap-2 border-t border-border pt-3">
        {post?.stage === "aprovado" && !post.checks?.postiz && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await scheduleSocialPostAction(post.id); if (!r.ok) toast.error(r.error); else { toast.success("Agendado no Postiz"); router.refresh(); onDone(); } })}>Agendar no Postiz</Button>}
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
        <Button disabled={pending || !f.title.trim()} onClick={save}>{pending ? "Salvando…" : "Salvar"}</Button>
      </div>
    </div>
  </div>;
}

const VIDEO = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;
/** Prévia da mídia. "cover" preenche o card (miniatura); "contain" mostra a peça inteira, sem cortar. */
function MediaPreview({ url, className = "", controls = false, fit = "cover" }: { url: string; className?: string; controls?: boolean; fit?: "cover" | "contain" }) {
  const [broken, setBroken] = React.useState(false);
  const box = `overflow-hidden rounded-lg bg-surface ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`;
  if (broken) return <a href={url} target="_blank" rel="noopener noreferrer" className={`${box} grid min-h-16 place-items-center p-3 text-center text-[11px] text-warning`}>Mídia não carregou — abrir link</a>;
  return VIDEO.test(url)
    ? <video src={url} className={box} controls={controls} muted playsInline preload="metadata" onError={() => setBroken(true)} />
    // eslint-disable-next-line @next/next/no-img-element -- mídias vêm do storage de mídia e de links externos; next/image exigiria lista fixa de domínios
    : <img src={url} alt="" loading="lazy" className={box} onError={() => setBroken(true)} />;
}
