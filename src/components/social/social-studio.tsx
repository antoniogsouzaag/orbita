"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, LayoutGrid, Plus, Sun, BarChart3, Trash2 } from "lucide-react";
import { createSocialPostAction, deleteSocialPostAction, moveSocialPostAction, updateSocialPostAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { SocialPost } from "@/db/schema";
import {
  BRAND_LABELS, CAPTION_LIMITS, NETWORK_LABELS, SOCIAL_BRANDS, SOCIAL_FORMATS, SOCIAL_NETWORKS, SOCIAL_STAGES, STAGE_LABELS,
  calendarGaps, qualityScore, type SocialBrand, type SocialNetwork, type SocialStage,
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
        <Select aria-label="Marca" value={brand} onChange={e => setBrand(e.target.value as SocialBrand | "todas")} className="w-36"><option value="todas">Todas as marcas</option>{SOCIAL_BRANDS.map(b => <option key={b} value={b}>{BRAND_LABELS[b]}</option>)}</Select>
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

function Board({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const move = (p: SocialPost, stage: SocialStage) => start(async () => {
    const r = await moveSocialPostAction(p.id, stage);
    if (!r.ok) toast.error(r.error); else { toast.success(`Movido para ${STAGE_LABELS[stage]}`); router.refresh(); }
  });
  return <div aria-busy={pending} className="flex gap-3 overflow-x-auto pb-2">{SOCIAL_STAGES.map((stage, i) => {
    const items = posts.filter(p => p.stage === stage);
    return <section key={stage} className="w-64 shrink-0 rounded-2xl border border-border bg-surface p-3"
      onDragOver={e => e.preventDefault()} onDrop={e => { const p = posts.find(x => x.id === e.dataTransfer.getData("text/plain")); if (p && p.stage !== stage) move(p, stage); }}>
      <h3 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">{STAGE_LABELS[stage]}<span className="tabular-nums">{items.length}</span></h3>
      <div className="space-y-2">{items.map(p => { const q = quality(p); return <article key={p.id} draggable onDragStart={e => e.dataTransfer.setData("text/plain", p.id)} className="cursor-grab rounded-xl bg-surface-2 p-3">
        <button type="button" onClick={() => onOpen(p)} className="block w-full text-left"><p className="text-sm font-medium leading-snug">{p.title}</p><p className="mt-1 text-[11px] text-muted">{BRAND_LABELS[p.brand as SocialBrand]} · {NETWORK_LABELS[p.network as SocialNetwork]} · {p.format}</p><p className="mt-1 text-[11px] text-faint">{fmt(p.scheduledAt)}</p></button>
        <div className="mt-2 flex items-center justify-between"><span className={`text-[11px] font-medium ${q.blocking.length ? "text-warning" : "text-success"}`}>Qualidade {q.score}%</span>
          {i < SOCIAL_STAGES.length - 2 && <button type="button" disabled={pending} onClick={() => move(p, SOCIAL_STAGES[i + 1])} className="text-[11px] text-accent hover:underline">→ {STAGE_LABELS[SOCIAL_STAGES[i + 1]]}</button>}</div>
      </article>; })}</div>
    </section>;
  })}</div>;
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
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF(s => ({ ...s, [k]: v }));
  const q = qualityScore({ ...f, checks: { brandReviewed: f.brandReviewed, ctaDeliverable: f.ctaDeliverable } });
  const limit = CAPTION_LIMITS[f.network];
  const payload = () => ({ brand: f.brand, network: f.network, format: f.format, title: f.title, hook: f.hook, caption: f.caption, cta: f.cta, mediaUrl: f.mediaUrl, referenceUrl: f.referenceUrl, publishedUrl: f.publishedUrl, notes: f.notes, scheduledAt: f.scheduledAt ? new Date(`${f.scheduledAt}:00-03:00`).toISOString() : null, checks: { brandReviewed: f.brandReviewed, ctaDeliverable: f.ctaDeliverable } });
  const save = () => start(async () => {
    const r = post ? await updateSocialPostAction(post.id, payload()) : await createSocialPostAction(payload());
    if (!r.ok) return void toast.error(r.error);
    toast.success("Post salvo"); router.refresh(); onDone();
  });
  const remove = () => post && confirm("Excluir este post do pipeline?") && start(async () => { const r = await deleteSocialPostAction(post.id); if (!r.ok) toast.error(r.error); else { router.refresh(); onDone(); } });
  return <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Marca"><Select value={f.brand} onChange={e => set("brand", e.target.value as SocialBrand)}>{SOCIAL_BRANDS.map(b => <option key={b} value={b}>{BRAND_LABELS[b]}</option>)}</Select></Field>
        <Field label="Rede"><Select value={f.network} onChange={e => set("network", e.target.value as SocialNetwork)}>{SOCIAL_NETWORKS.map(n => <option key={n} value={n}>{NETWORK_LABELS[n]}</option>)}</Select></Field>
        <Field label="Formato"><Select value={f.format} onChange={e => set("format", e.target.value)}>{SOCIAL_FORMATS.map(n => <option key={n} value={n}>{n}</option>)}</Select></Field>
      </div>
      <Field label="Título interno"><Input value={f.title} onChange={e => set("title", e.target.value)} maxLength={200} placeholder="Ex.: 3 automações que economizam 5h/semana" /></Field>
      <Field label="Gancho (primeira linha / primeiros 3s)"><Input value={f.hook} onChange={e => set("hook", e.target.value)} maxLength={300} /></Field>
      <Field label={`Legenda · ${f.caption.length.toLocaleString("pt-BR")}/${limit.toLocaleString("pt-BR")}`}><Textarea rows={6} value={f.caption} onChange={e => set("caption", e.target.value)} className={f.caption.length > limit ? "border-warning" : ""} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="CTA"><Input value={f.cta} onChange={e => set("cta", e.target.value)} placeholder='Ex.: Comente "GUIA"' /></Field>
        <Field label="Data e hora (Brasília)"><Input type="datetime-local" value={f.scheduledAt} onChange={e => set("scheduledAt", e.target.value)} /></Field>
        <Field label="Link da mídia"><Input value={f.mediaUrl} onChange={e => set("mediaUrl", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Referência / fonte"><Input value={f.referenceUrl} onChange={e => set("referenceUrl", e.target.value)} placeholder="https://…" /></Field>
      </div>
      {post?.stage === "publicado" && <Field label="Link do post publicado"><Input value={f.publishedUrl} onChange={e => set("publishedUrl", e.target.value)} /></Field>}
      <Field label="Notas"><Textarea rows={2} value={f.notes} onChange={e => set("notes", e.target.value)} /></Field>
    </div>
    <aside className="space-y-3">
      <Card className="p-4"><p className="text-xs text-muted">Qualidade</p><p className={`text-3xl font-semibold ${q.blocking.length ? "text-warning" : "text-success"}`}>{q.score}%</p>
        <ul className="mt-3 space-y-1.5 text-[11px]">{q.checks.map(c => <li key={c.key} className="flex gap-1.5">{c.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : c.required ? <AlertTriangle className="size-3.5 shrink-0 text-warning" /> : <Circle className="size-3.5 shrink-0 text-faint" />}<span className={c.ok ? "text-muted" : ""}>{c.label}{!c.required && " (opcional)"}</span></li>)}</ul>
        <label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={f.brandReviewed} onChange={e => set("brandReviewed", e.target.checked)} />Revisei tom e marca</label>
        <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={f.ctaDeliverable} onChange={e => set("ctaDeliverable", e.target.checked)} />Material do CTA existe e foi testado</label>
        <p className="mt-3 text-[10px] text-faint">Itens obrigatórios bloqueiam Aprovado, Agendado e Publicado.</p>
      </Card>
      <Button className="w-full" disabled={pending || !f.title.trim()} onClick={save}>{pending ? "Salvando…" : "Salvar"}</Button>
      {post && <Button className="w-full" variant="ghost" disabled={pending} onClick={remove}><Trash2 />Excluir</Button>}
    </aside>
  </div>;
}
