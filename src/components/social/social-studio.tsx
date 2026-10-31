"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, LayoutGrid, Loader2, Plus, Sun, BarChart3, Trash2, Upload } from "lucide-react";
import { createSocialPostAction, deleteSocialPostAction, scheduleSocialPostAction, moveSocialPostAction, updateSocialPostAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { SocialPost } from "@/db/schema";
import {
  BRAND_LABELS, CAPTION_LIMITS, NETWORK_LABELS, SOCIAL_BRANDS, SOCIAL_FORMATS, SOCIAL_NETWORKS, STAGE_LABELS,
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
      <DialogContent wide className="max-w-4xl" title={editing === "new" ? "Novo post" : "Editar post"}>{editing !== null && <PostForm post={editing === "new" ? null : editing} defaultBrand={brand === "todas" ? "aglabs" : brand} onDone={() => setEditing(null)} />}</DialogContent>
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

/** Aprova ou avança um post. Aprovar agenda no Postiz em todas as redes da marca, e isso leva alguns segundos. */
function useAdvance() {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const advance = async (p: SocialPost, to: SocialStage) => {
    setBusyId(p.id);
    const id = to === "aprovado" ? toast.loading("Aprovando e agendando no Postiz…") : undefined;
    try {
      const r = await moveSocialPostAction(p.id, to);
      if (!r.ok) return void toast.error(r.error, { id });
      if (r.data.aviso) toast.warning(r.data.aviso, { id, duration: 10_000 });
      else toast.success(r.data.post.stage === "agendado" ? `Agendado para ${fmt(r.data.post.scheduledAt)}` : `Movido para ${STAGE_LABELS[to]}`, { id });
      router.refresh();
    } finally { setBusyId(null); }
  };
  return { busyId, advance };
}

/** Grade única: a etapa aparece no próprio card e é o sistema que move. Ordem: o que espera você primeiro. */
function Board({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const { busyId, advance } = useAdvance();
  const order: SocialStage[] = ["revisao", "falhou", "aprovado", "rascunho", "briefing", "ideia", "agendado", "publicado"];
  const shown = [...posts].sort((a, b) => order.indexOf(a.stage as SocialStage) - order.indexOf(b.stage as SocialStage)
    || new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
  return !shown.length ? <Card className="p-8 text-center text-sm text-muted">Nenhum post ainda.</Card>
    : <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4">{shown.map(p => <PostCard key={p.id} post={p} onOpen={() => onOpen(p)} onAdvance={to => void advance(p, to)} busy={busyId === p.id} />)}</div>;
}

function PostCard({ post: p, onOpen, onAdvance, busy }: { post: SocialPost; onOpen: () => void; onAdvance: (to: SocialStage) => void; busy: boolean }) {
  const q = quality(p);
  // Você só aprova: o resto das etapas é do sistema.
  const next = p.stage === "revisao" ? "aprovado" as SocialStage : null;
  return <article aria-busy={busy} className={`relative overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/30 ${busy ? "pointer-events-none" : ""}`}>
    {busy && <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 backdrop-blur-[1px]"><span className="flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white"><Loader2 className="size-3.5 animate-spin" />Agendando nas redes…</span></div>}
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
      {next && <button type="button" disabled={busy} onClick={() => onAdvance(next)} className="flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent hover:bg-accent/25 disabled:opacity-70">{busy ? <><Loader2 className="size-3 animate-spin" />Agendando…</> : "Aprovar"}</button>}
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
    keyword: post?.checks?.keyword ?? "", pageUrl: post?.checks?.pageUrl ?? "", deliveryMessage: post?.checks?.deliveryMessage ?? "",
  });
  const checks = { keyword: f.keyword.trim() || null, pageUrl: f.pageUrl.trim() || null, deliveryMessage: f.deliveryMessage.trim() || null, mediaId: post?.checks?.mediaId ?? null, n8nCodeDone: post?.checks?.n8nCodeDone, n8nPostDone: post?.checks?.n8nPostDone };
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
  const [view, setView] = React.useState<"conteudo" | "entregas">("conteudo");
  const tab = (k: typeof view, label: string, badge?: string) => <button type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 text-xs ${view === k ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>{label}{badge && <span className="ml-1 text-warning">{badge}</span>}</button>;
  const { busyId, advance } = useAdvance();
  const approving = busyId === post?.id;
  const postiz = post?.checks?.postiz as { scheduledFor: string; canais?: Record<string, unknown>; erros?: Record<string, string> } | undefined;
  const pendentes = postiz?.erros ? Object.entries(postiz.erros).filter(([, m]) => m !== "sem canal") : [];
  const hasMedia = /^https?:\/\//.test(f.mediaUrl);
  return <div className="grid gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <aside className="space-y-2">
      <MediaGallery postId={post?.id ?? null} cover={f.mediaUrl} />
      <div className="flex gap-2">
        <label className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs hover:bg-surface-2 ${uploading ? "pointer-events-none opacity-60" : ""}`}><Upload className="size-3.5" />{uploading ? "Enviando…" : hasMedia ? "Trocar capa" : "Enviar capa"}
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="sr-only" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} /></label>
        {post && <SlidesUpload postId={post.id} onDone={() => router.refresh()} />}
      </div>
    </aside>
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{post ? STAGE_LABELS[post.stage as SocialStage] : "Novo"}</span>
        {post?.scheduledAt && <span className="text-[11px] text-muted">{fmt(post.scheduledAt)}</span>}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${q.blocking.length ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>{q.blocking.length ? `faltam ${q.blocking.length}` : "pronto"}</span>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-border pb-2">{tab("conteudo", "Conteúdo")}{tab("entregas", "Entregas", q.blocking.length ? String(q.blocking.length) : undefined)}</div>
      {view === "conteudo" && <div className="space-y-3">
        {!post && <div className="grid grid-cols-3 gap-2">
          <Field label="Marca"><Select value={f.brand} onChange={e => set("brand", e.target.value as SocialBrand)}>{SOCIAL_BRANDS.map(b => <option key={b} value={b}>{BRAND_LABELS[b]}</option>)}</Select></Field>
          <Field label="Rede"><Select value={f.network} onChange={e => set("network", e.target.value as SocialNetwork)}>{SOCIAL_NETWORKS.map(n => <option key={n} value={n}>{NETWORK_LABELS[n]}</option>)}</Select></Field>
          <Field label="Formato"><Select value={f.format} onChange={e => set("format", e.target.value)}>{SOCIAL_FORMATS.map(n => <option key={n} value={n}>{n}</option>)}</Select></Field>
        </div>}
        <Field label="Título"><Input value={f.title} onChange={e => set("title", e.target.value)} maxLength={200} /></Field>
        <Field label={`Legenda · ${f.caption.length.toLocaleString("pt-BR")}/${limit.toLocaleString("pt-BR")}`}><Textarea rows={12} value={f.caption} onChange={e => set("caption", e.target.value)} className={f.caption.length > limit ? "border-warning" : ""} /></Field>
      </div>}
      {view === "entregas" && <div className="space-y-3">
        <Field label="Palavra-chave (só Instagram)"><Input className="uppercase" value={f.keyword} onChange={e => set("keyword", e.target.value.replace(/\s/g, ""))} maxLength={40} placeholder="Vazio = sem entrega" /></Field>
        {f.keyword.trim() && <>
          <Field label="Página gratuita"><Input value={f.pageUrl} onChange={e => set("pageUrl", e.target.value)} /></Field>
          <Field label="Mensagem da DM"><Textarea rows={3} value={f.deliveryMessage} onChange={e => set("deliveryMessage", e.target.value)} /></Field>
        </>}
        <ul className="grid gap-1 border-t border-border pt-3 text-xs sm:grid-cols-2">{[...q.checks.filter(c => c.required), ...deliveries].map(c => <li key={c.key} className="flex gap-1.5">{c.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-warning" />}<span className={c.ok ? "text-muted" : ""}>{c.label}</span></li>)}</ul>
        <p className="text-[11px] text-faint">Nas outras redes o último slide vira a tela final (curte, comenta, compartilha), porque só o Instagram tem a automação da palavra-chave.</p>
      </div>}
      {postiz && <p className="text-[11px] text-muted">Agendado para {fmt(postiz.scheduledFor)}{postiz.canais ? ` em ${Object.keys(postiz.canais).map(n => NETWORK_LABELS[n as SocialNetwork] ?? n).join(", ")}` : ""}.{pendentes.length ? ` Falhou: ${pendentes.map(([n]) => NETWORK_LABELS[n as SocialNetwork] ?? n).join(", ")}.` : ""}</p>}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {post && <Button size="sm" variant="ghost" className="mr-auto text-muted" disabled={pending || approving} onClick={remove}><Trash2 />Excluir</Button>}
        {post && (pendentes.length > 0 || (post.stage === "aprovado" && !postiz) || (post.stage === "agendado" && postiz && !postiz.canais)) && <Button variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await scheduleSocialPostAction(post.id); if (!r.ok) toast.error(r.error); else { toast.success("Agendado nas redes"); router.refresh(); onDone(); } })}>{pending && <Loader2 className="animate-spin" />}Agendar nas outras redes</Button>}
        <Button variant="ghost" disabled={pending || approving || !f.title.trim()} onClick={save}>{pending ? "Salvando…" : "Salvar"}</Button>
        {post?.stage === "revisao" && <Button disabled={approving || pending || q.blocking.length > 0} onClick={() => void (async () => {
          const r = await updateSocialPostAction(post.id, payload());
          if (!r.ok) return void toast.error(r.error);
          await advance(post, "aprovado"); onDone();
        })()}>{approving ? <><Loader2 className="animate-spin" />Agendando…</> : "Aprovar"}</Button>}
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

type MediaItem = { id: string; filename: string; contentType: string; url: string };
async function fetchPostMedia(postId: string): Promise<MediaItem[]> {
  const res = await fetch(`/api/redes/midia?postId=${postId}`, { cache: "no-store" });
  const json = (await res.json()) as { midias?: MediaItem[] };
  const n = (f: string) => Number(/(\d+)\.[a-z0-9]+$/i.exec(f)?.[1] ?? 999);
  return (json.midias ?? []).filter((m, i, all) => all.findIndex(o => o.filename === m.filename) === i).sort((a, b) => n(a.filename) - n(b.filename));
}
/** Prévia grande do post com setas: capa primeiro e depois os slides, na ordem em que vão para o Postiz. */
function MediaGallery({ postId, cover }: { postId: string | null; cover: string }) {
  const [items, setItems] = React.useState<MediaItem[] | null>(null);
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (!postId) return;
    let alive = true;
    void fetchPostMedia(postId).then(list => { if (alive) setItems(list); });
    return () => { alive = false; };
  }, [postId, cover]);
  const urls = items?.length ? items.map(m => m.url) : /^https?:\/\//.test(cover) ? [cover] : [];
  const at = Math.min(i, Math.max(urls.length - 1, 0));
  const go = (d: number) => setI(Math.max(0, Math.min(urls.length - 1, at + d)));
  return <div className="space-y-2 outline-none" tabIndex={-1} onKeyDown={e => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
    <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-border bg-black/80">
      {urls.length ? <MediaPreview key={urls[at]} url={urls[at]} controls fit="contain" className="size-full rounded-none bg-transparent" /> : <span className="px-4 text-center text-[11px] text-faint">Sem capa ainda</span>}
      {urls.length > 1 && <>
        <button type="button" aria-label="Anterior" disabled={at === 0} onClick={() => go(-1)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"><ChevronLeft className="size-5" /></button>
        <button type="button" aria-label="Próxima" disabled={at === urls.length - 1} onClick={() => go(1)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"><ChevronRight className="size-5" /></button>
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white">{at + 1}/{urls.length}</span>
      </>}
    </div>
    {urls.length > 1 && <div className="flex justify-center gap-1.5">{urls.map((u, k) => <button key={u} type="button" aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === at ? "w-5 bg-accent" : "w-1.5 bg-border-strong hover:bg-muted"}`} />)}</div>}
  </div>;
}

/** Envia slides e vídeo do post (o número no fim do nome define a ordem: …-01, …-02). */
function SlidesUpload({ postId, onDone }: { postId: string; onDone: () => void }) {
  const [busy, setBusy] = React.useState(false);
  const send = async (files: FileList) => {
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.set("file", file); body.set("postId", postId);
        const res = await fetch("/api/redes/midia", { method: "POST", body });
        if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `Falha em ${file.name}`);
      }
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no envio."); }
    finally { setBusy(false); }
  };
  return <label className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-1.5 text-xs text-muted hover:bg-surface-2 ${busy ? "pointer-events-none opacity-60" : ""}`}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}{busy ? "Enviando…" : "Enviar slides"}
    <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4" className="sr-only" disabled={busy} onChange={e => { const fl = e.target.files; if (fl?.length) void send(fl); e.target.value = ""; }} /></label>;
}
