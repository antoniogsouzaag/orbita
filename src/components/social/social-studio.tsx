"use client";
import { confirmAction } from "@/components/ui/confirm-action";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, LayoutGrid, Loader2, Pencil, Plus, RefreshCw, Send, Sun, BarChart3, Trash2, Upload, X } from "lucide-react";
import { createSocialPostAction, deleteSocialPostAction, externalSocialPostsAction, removeSocialMediaAction, requestSocialAdjustmentAction, scheduleSocialPostAction, moveSocialPostAction, syncSocialPostsAction, updateSocialPostAction } from "@/app/actions/social";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import { LayoutEditorButton } from "@/components/social/layout-editor";
import type { SocialPost } from "@/db/schema";
import type { ExternalPost } from "@/lib/social-postiz";
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
/** O que falta para aprovar, em itens objetivos. A porcentagem fica só para os agentes (MCP). */
const blockers = (p: SocialPost) => qualityScore({ ...p, network: p.network as SocialNetwork }).blocking.map(c => c.label);
type Postiz = { scheduledFor: string; canais?: Record<string, unknown>; erros?: Record<string, string> };
const postizOf = (p: SocialPost) => p.checks?.postiz as Postiz | undefined;
/** Mídia só muda antes de ir para o Postiz. */
const mediaEditable = (p: SocialPost) => ["ideia", "briefing", "rascunho", "revisao", "falhou"].includes(p.stage) || (p.stage === "aprovado" && !postizOf(p));

export function SocialStudio({ posts, metrics, initialTab = "hoje", dbError }: { posts: SocialPost[]; metrics: React.ReactNode; initialTab?: Tab; dbError?: string | null }) {
  const [tab, setTab] = React.useState<Tab>(initialTab);
  const [brand, setBrand] = React.useState<SocialBrand | "todas">("todas");
  const [editing, setEditing] = React.useState<SocialPost | "new" | null>(null);
  const visible = brand === "todas" ? posts : posts.filter(p => p.brand === brand);
  // Conciliação com o Postiz: só na primeira abertura do calendário (ou no botão), com cache no servidor.
  const [external, setExternal] = React.useState<{ posts: ExternalPost[]; checkedAt: string; error?: string } | null>(null);
  const [loadingExt, setLoadingExt] = React.useState(false);
  const loadExternal = React.useCallback(async (force = false) => {
    setLoadingExt(true);
    const r = await externalSocialPostsAction(force).catch(() => ({ ok: false as const, error: "Postiz indisponível" }));
    setExternal(prev => r.ok ? r.data : { posts: prev?.posts ?? [], checkedAt: prev?.checkedAt ?? "", error: r.error });
    setLoadingExt(false);
  }, []);
  const requested = React.useRef(false);
  const ensureExternal = () => { if (requested.current) return; requested.current = true; void loadExternal(); };
  const select = (next: Tab) => { if (next === "calendario") ensureExternal(); setTab(next); const u = new URL(window.location.href); u.searchParams.set("aba", next); window.history.replaceState(null, "", u); };

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
    {tab === "calendario" && external === null && !loadingExt && initialTab === "calendario" && <Button size="sm" variant="ghost" onClick={ensureExternal}>Conferir posts feitos fora da Órbita</Button>}
    {tab === "calendario" && <Calendar posts={visible} brand={brand} onOpen={setEditing} external={external} loading={loadingExt} onRefresh={() => void loadExternal(true)} />}
    {tab === "metricas" && metrics}
    <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
      <DialogContent wide className="max-w-4xl" title={editing === "new" ? "Novo post" : "Editar post"}>{editing !== null && <PostForm post={editing === "new" ? null : editing} defaultBrand={brand === "todas" ? "aglabs" : brand} onDone={() => setEditing(null)} />}</DialogContent>
    </Dialog>
  </div>;
}

function Today({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const [now] = React.useState(() => Date.now());
  const next48 = posts.filter(p => p.scheduledAt && ["aprovado", "agendado"].includes(p.stage) && new Date(p.scheduledAt).getTime() >= now && new Date(p.scheduledAt).getTime() - now < 172800000);
  const overdue = posts.filter(p => p.scheduledAt && ["aprovado", "agendado"].includes(p.stage) && new Date(p.scheduledAt).getTime() < now);
  const review = posts.filter(p => p.stage === "revisao");
  const failed = posts.filter(p => p.stage === "falhou");
  const pending = posts.filter(p => p.stage === "aprovado" && !overdue.includes(p));
  const gaps = calendarGaps(posts.map(p => ({ ...p, brand: p.brand as SocialBrand, stage: p.stage as SocialStage })), new Date(now), 7);
  const problems = [...failed, ...overdue, ...pending];
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
      <Kpi label="para aprovar" value={review.length} tone={review.length ? "accent" : undefined} />
      <Kpi label="nas próximas 48h" value={next48.length} />
      <Kpi label="aprovados sem agendar" value={pending.length} tone={pending.length ? "warning" : undefined} />
      <Kpi label="falhas e atrasos" value={failed.length + overdue.length} tone={failed.length + overdue.length ? "warning" : undefined} />
    </div>
    <ReviewQueue posts={review} onOpen={onOpen} />
    {problems.length > 0 && <PostList title="Falhas, atrasos e aprovados sem agendar" posts={problems} onOpen={onOpen} />}
    <PostList title="Próximas 48h" posts={next48} onOpen={onOpen} empty="Nada agendado." />
    <p className="text-[11px] text-faint" title="Conta posts aprovados, agendados ou publicados com data.">Dias vazios na semana: {gaps.map(g => <span key={g.brand} className={`mr-3 ${g.gaps >= 4 ? "text-warning" : ""}`}>{BRAND_LABELS[g.brand]} {g.gaps}</span>)}</p>
  </div>;
}

function Kpi({ label, value, tone }: { label: string; value: number; tone?: "warning" | "accent" }) {
  return <span><span className={`mr-1 text-sm font-semibold tabular-nums ${tone === "warning" ? "text-warning" : tone === "accent" ? "text-accent" : "text-fg"}`}>{value}</span>{label}</span>;
}

function stageNote(p: SocialPost) {
  if (p.stage === "aprovado" && p.checks?.agendamento?.pendente) return "agendamento pendente (limite do Postiz)";
  if (p.stage === "aprovado") return "aprovado, falta agendar";
  if (p.stage === "falhou") return "falhou no Postiz";
  return null;
}
function PostList({ title, posts, onOpen, empty }: { title: string; posts: SocialPost[]; onOpen: (p: SocialPost) => void; empty?: string }) {
  return <section className="space-y-1"><h3 className="text-xs font-medium text-muted">{title}</h3>{posts.length ? <ul className="divide-y divide-border rounded-xl border border-border">{posts.map(p => <li key={p.id}><button type="button" onClick={() => onOpen(p)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2/60"><span className="min-w-0 truncate text-[13px]">{p.title}<span className="ml-2 text-[11px] text-muted">{fmt(p.scheduledAt)}{stageNote(p) ? ` · ${stageNote(p)}` : ""}</span></span><span className={`shrink-0 text-[10px] ${p.stage === "falhou" ? "text-warning" : "text-muted"}`}>{STAGE_LABELS[p.stage as SocialStage]}</span></button></li>)}</ul> : <p className="text-xs text-faint">{empty}</p>}</section>;
}

type ScheduleOpts = { modo?: "auto" | "agora" | "data"; quando?: string | null };
/** Aprova um post. Aprovar agenda no Postiz em todas as redes da marca, e isso leva alguns segundos. */
function useAdvance() {
  const router = useRouter();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const advance = async (p: SocialPost, to: SocialStage, opts: ScheduleOpts = {}) => {
    setBusyId(p.id);
    const id = to === "aprovado" ? toast.loading(opts.modo === "agora" ? "Aprovando e publicando agora…" : "Aprovando e agendando no Postiz…") : undefined;
    try {
      const r = await moveSocialPostAction(p.id, to, opts);
      if (!r.ok) { toast.error(r.error, { id }); return false; }
      if (r.data.aviso) toast.warning(r.data.aviso, { id, duration: 12_000 });
      else toast.success(r.data.post.stage === "agendado" ? (opts.modo === "agora" ? "Enviado: o Postiz publica agora" : `Agendado para ${fmt(r.data.post.scheduledAt)}`) : `Movido para ${STAGE_LABELS[to]}`, { id });
      router.refresh();
      return true;
    } finally { setBusyId(null); }
  };
  return { busyId, advance };
}

function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const parts = new Date(d).toLocaleString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 16);
  return parts.replace(" ", "T");
}
const fromLocalInput = (v: string) => new Date(`${v}:00-03:00`).toISOString();

/**
 * Aprovar (regra automática: data do post se faltam mais de 2 h e o dia está livre, senão o próximo dia livre às 20h),
 * com duas saídas no menu: publicar agora ou aprovar para um horário escolhido (hoje, inclusive).
 */
function ApproveControl({ post, blocked, before, onDone }: { post: SocialPost; blocked: boolean; before?: () => Promise<boolean>; onDone?: () => void }) {
  const { busyId, advance } = useAdvance();
  const busy = busyId === post.id;
  const [picking, setPicking] = React.useState(false);
  const [when, setWhen] = React.useState(() => {
    const at = post.scheduledAt && new Date(post.scheduledAt).getTime() > Date.now() + 10 * 60_000 ? post.scheduledAt : new Date(Math.ceil((Date.now() + 3_600_000) / 900_000) * 900_000);
    return toLocalInput(at);
  });
  const go = async (opts: ScheduleOpts) => {
    if (opts.modo === "agora" && !(await confirmAction(`Publicar agora "${post.title}" em todas as redes da marca?`))) return;
    if (before && !(await before())) return;
    if (await advance(post, "aprovado", opts)) { setPicking(false); onDone?.(); }
  };
  if (busy) return <Button size="sm" variant="primary" disabled><Loader2 className="animate-spin" />Agendando…</Button>;
  if (picking) return <div className="flex flex-wrap items-center justify-end gap-2">
    <Input type="datetime-local" aria-label="Data e hora de publicação" value={when} onChange={e => setWhen(e.target.value)} className="h-7 w-auto text-xs" />
    <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>Cancelar</Button>
    <Button size="sm" variant="primary" disabled={blocked || !when} onClick={() => void go({ modo: "data", quando: fromLocalInput(when) })}><Clock />Aprovar</Button>
  </div>;
  return <div className="inline-flex">
    <Button size="sm" variant="primary" disabled={blocked} className="h-7 rounded-r-none px-2.5 text-xs" onClick={() => void go({ modo: "auto" })}>Aprovar</Button>
    <Menu>
      <MenuTrigger asChild><Button size="sm" variant="primary" disabled={blocked} aria-label="Outras formas de aprovar" className="h-7 rounded-l-none border-l border-black/15 px-1.5"><ChevronDown /></Button></MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => void go({ modo: "agora" })}><Send />Aprovar e publicar agora</MenuItem>
        <MenuItem onSelect={() => setPicking(true)}><Clock />Aprovar com horário</MenuItem>
      </MenuContent>
    </Menu>
  </div>;
}

/** Pedido de ajuste com motivo: o post volta para Rascunho com a nota, visível para o agente pelo MCP. */
function AdjustForm({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [nota, setNota] = React.useState("");
  const send = () => start(async () => { const r = await requestSocialAdjustmentAction(id, nota); if (!r.ok) toast.error(r.error); else { toast.success("Voltou para Rascunho com o pedido de ajuste"); onClose(); router.refresh(); } });
  return <div className="space-y-1.5">
    <Textarea rows={2} autoFocus value={nota} onChange={e => setNota(e.target.value)} placeholder="O que precisa mudar? Vai para o agente refazer." aria-label="Pedido de ajuste" />
    <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button><Button size="sm" disabled={pending || nota.trim().length < 3} onClick={send}>{pending && <Loader2 className="animate-spin" />}Enviar</Button></div>
  </div>;
}

/** Posts em Revisão: uma linha por post (miniatura, título, legenda curta, o que falta e os botões), para aprovar ali mesmo. */
function ReviewQueue({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  return <section aria-labelledby="para-aprovar" className="space-y-1">
    <h2 id="para-aprovar" className="text-xs font-medium text-muted">Para aprovar{posts.length ? ` · ${posts.length}` : ": nada esperando você"}</h2>
    {posts.length > 0 && <div className="divide-y divide-border rounded-xl border border-border">{posts.map(p => <ReviewCard key={p.id} post={p} onOpen={() => onOpen(p)} />)}</div>}
  </section>;
}

function ReviewCard({ post: p, onOpen }: { post: SocialPost; onOpen: () => void }) {
  const router = useRouter();
  const media = usePostMedia(p.id, p.mediaUrl ?? "");
  const [adjusting, setAdjusting] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const missing = [...blockers(p), ...(media.avisos ?? [])];
  const going = media.items?.filter(m => m.uso === "vai") ?? null;
  const caption = p.caption?.trim() ?? "";
  // Na prévia de duas linhas, linha em branco não ocupa espaço.
  const preview = caption.replace(/\n\s*\n+/g, "\n");
  const old = media.substituidas ?? 0;
  return <article className="flex gap-3 p-3">
    <div className="w-20 shrink-0 sm:w-24"><MediaGallery compact items={going} cover={p.mediaUrl ?? ""} /></div>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 truncate text-left text-sm font-medium hover:text-accent">{p.title}</button>
        <span className="shrink-0 text-[11px] text-faint">{fmt(p.scheduledAt)}</span>
      </div>
      <p className="truncate text-[11px] text-faint">{BRAND_LABELS[p.brand as SocialBrand]} · {p.format}{going ? ` · ${going.length} ${going.length === 1 ? "mídia" : "mídias"}` : ""}{p.checks?.keyword ? ` · ${p.checks.keyword}` : ""}</p>
      {caption
        ? <button type="button" onClick={() => setExpanded(e => !e)} title={expanded ? "Mostrar menos" : "Ler a legenda inteira"} className={`whitespace-pre-line text-left text-xs leading-relaxed text-muted ${expanded ? "" : "line-clamp-2"}`}>{expanded ? caption : preview}</button>
        : <p className="text-xs text-warning">Sem legenda.</p>}
      {missing.length > 0 && <p role="status" className="flex items-start gap-1 text-[11px] text-warning"><AlertTriangle className="mt-px size-3 shrink-0" /><span>{missing.join(" · ")}{(media.avisos?.length ?? 0) > 0 && <button type="button" onClick={onOpen} className="ml-1 text-accent hover:underline">resolver</button>}</span></p>}
      {old > 0 && <SupersededNotice postId={p.id} count={old} onDone={() => { media.reload(); router.refresh(); }} />}
      {adjusting && <AdjustForm id={p.id} onClose={() => setAdjusting(false)} />}
      {!adjusting && <div className="mt-auto flex items-center justify-end gap-1 pt-1">
        <Button size="icon-sm" variant="ghost" aria-label="Abrir e editar" title="Abrir e editar" onClick={onOpen}><Pencil /></Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setAdjusting(true)}>Pedir ajuste</Button>
        <ApproveControl post={p} blocked={media.items === null || missing.length > 0} />
      </div>}
    </div>
  </article>;
}

function SupersededNotice({ postId, count, onDone }: { postId: string; count: number; onDone: () => void }) {
  const [pending, start] = React.useTransition();
  const clean = () => start(async () => {
    const r = await removeSocialMediaAction(postId, [], true);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.data.removidas.length} versão(ões) antiga(s) removida(s)`);
    onDone();
  });
  return <p className="text-[11px] text-faint">{count} {count === 1 ? "versão antiga fica de fora" : "versões antigas ficam de fora"} · <button type="button" disabled={pending} onClick={clean} className="text-accent hover:underline disabled:opacity-50">{pending ? "removendo…" : "remover"}</button></p>;
}

/** Produção separada por etapa: o que espera você, o que está em produção, a fila do Postiz e o histórico. */
function Board({ posts, onOpen }: { posts: SocialPost[]; onOpen: (p: SocialPost) => void }) {
  const by = (stages: SocialStage[]) => posts.filter(p => stages.includes(p.stage as SocialStage)).sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
  const review = by(["revisao"]);
  const making = by(["ideia", "briefing", "rascunho"]);
  const queue = by(["aprovado", "agendado"]);
  const history = by(["publicado", "falhou"]).reverse();
  if (!posts.length) return <Card className="p-8 text-center text-sm text-muted">Nenhum post ainda.</Card>;
  const grid = (list: SocialPost[]) => <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">{list.map(p => <PostCard key={p.id} post={p} onOpen={() => onOpen(p)} />)}</div>;
  return <div className="space-y-6">
    <ReviewQueue posts={review} onOpen={onOpen} />
    {making.length > 0 && <section className="space-y-3"><h2 className="text-xs font-medium text-muted">Em produção <span className="font-normal">· {making.length}</span></h2>{grid(making)}</section>}
    {queue.length > 0 && <section className="space-y-3"><h2 className="text-xs font-medium text-muted">Na fila do Postiz <span className="font-normal">· {queue.length}</span></h2>{grid(queue)}</section>}
    {history.length > 0 && <details className="group space-y-3"><summary className="cursor-pointer list-none text-xs font-medium text-muted"><ChevronRight className="mr-1 inline size-4 transition group-open:rotate-90" />Histórico <span className="font-normal">· {history.length}</span></summary><div className="pt-3">{grid(history)}</div></details>}
  </div>;
}

function PostCard({ post: p, onOpen }: { post: SocialPost; onOpen: () => void }) {
  const missing = blockers(p);
  const note = stageNote(p);
  const status = p.stage === "agendado" ? `Sai ${fmt(postizOf(p)?.scheduledFor ?? p.scheduledAt)}`
    : p.stage === "publicado" ? (p.publishedUrl ? "Publicado" : "Publicado, sem link")
    : note ?? (missing.length ? `Falta ${missing.length} ${missing.length === 1 ? "item" : "itens"}` : "Pronto para revisão");
  const warn = p.stage === "falhou" || p.stage === "aprovado" || (["ideia", "briefing", "rascunho"].includes(p.stage) && missing.length > 0);
  return <article className="overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-accent/30">
    <button type="button" onClick={onOpen} className="block w-full text-left">
      <div className="relative aspect-[4/5] bg-surface-2">
        {p.mediaUrl ? <MediaPreview url={p.mediaUrl} className="absolute inset-0 size-full rounded-none" /> : <div className="grid size-full place-items-center text-[11px] uppercase tracking-wider text-faint">{p.format} · sem capa</div>}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">{STAGE_LABELS[p.stage as SocialStage] ?? p.stage}</span>
      </div>
      <div className="space-y-0.5 px-2.5 py-2">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{p.title}</p>
        <p className="text-[11px] text-muted">{BRAND_LABELS[p.brand as SocialBrand]} · {p.format} · {fmt(p.scheduledAt)}</p>
      </div>
    </button>
    <p title={missing.join("\n") || undefined} className={`truncate border-t border-border px-2.5 py-1.5 text-[11px] ${warn ? "text-warning" : "text-muted"}`}>{status}</p>
  </article>;
}

type CalendarExternal = { posts: ExternalPost[]; checkedAt: string; error?: string } | null;

function Calendar({ posts, brand, onOpen, external, loading, onRefresh }: { posts: SocialPost[]; brand: SocialBrand | "todas"; onOpen: (p: SocialPost) => void; external: CalendarExternal; loading: boolean; onRefresh: () => void }) {
  const ext = (external?.posts ?? []).map(e => ({ ...e, scheduledAt: new Date(e.scheduledAt), external: true as const }));
  const all = [...posts.map(p => ({ ...p, brand: p.brand as SocialBrand, stage: p.stage as SocialStage, external: false as const })), ...ext];
  const rows = calendarGaps(all, new Date(), 14).filter(r => brand === "todas" || r.brand === brand);
  const days = rows[0]?.days.map(d => d.day) ?? [];
  const label = (k: string) => new Date(`${k}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
  return <Card className="overflow-x-auto p-4"><table className="w-full min-w-[900px] text-xs"><thead><tr><th className="w-28 text-left text-muted">Marca</th>{days.map(d => <th key={d} className="px-1 text-center font-normal text-muted">{label(d)}</th>)}</tr></thead>
    <tbody>{rows.map(r => <tr key={r.brand} className="border-t border-border"><td className="py-2 font-medium">{BRAND_LABELS[r.brand]}<span className="block text-[10px] font-normal text-faint">{r.gaps} vazios</span></td>{r.days.map(d => <td key={d.day} className="p-1 align-top">{d.posts.length ? d.posts.map(p => <button type="button" key={p.id} onClick={() => p.external ? (p.publishedUrl && window.open(p.publishedUrl, "_blank", "noopener")) : onOpen(p as unknown as SocialPost)} title={`${p.title}${p.external ? " · feito fora da Órbita (Postiz)" : ""}`} className={`mb-1 block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] ${p.external ? "border border-dashed border-current " : ""}${p.stage === "publicado" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{NETWORK_LABELS[p.network as SocialNetwork]}</button>) : <span className="block h-6 rounded-md border border-dashed border-border" aria-label="Sem post" />}</td>)}</tr>)}</tbody></table>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-faint"><p>Azul: aprovado/agendado. Verde: publicado. Borda tracejada: post feito fora da Órbita, lido do Postiz. Célula tracejada: dia sem post.</p>
      <span className="flex items-center gap-2">{external?.error ? <span className="text-warning">Postiz: {external.error}</span> : external?.checkedAt ? <span>{ext.length} do Postiz · lido {fmt(external.checkedAt)}</span> : null}
        <Button size="sm" variant="ghost" disabled={loading} onClick={onRefresh}>{loading && <Loader2 className="animate-spin" />}Atualizar Postiz</Button></span></div></Card>;
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
  const payload = () => ({ brand: f.brand, network: f.network, format: f.format, title: f.title, hook: f.hook, caption: f.caption, cta: f.cta, mediaUrl: f.mediaUrl, referenceUrl: f.referenceUrl, publishedUrl: f.publishedUrl, notes: f.notes, scheduledAt: f.scheduledAt ? fromLocalInput(f.scheduledAt) : null, checks });
  const [uploading, setUploading] = React.useState(false);
  const media = usePostMedia(post?.id ?? null, f.mediaUrl);
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
  const remove = async () => post && await confirmAction("Excluir este post do pipeline? As mídias dele saem do armazenamento.") && start(async () => { const r = await deleteSocialPostAction(post.id); if (!r.ok) toast.error(r.error); else { router.refresh(); onDone(); } });
  const [view, setView] = React.useState<"conteudo" | "entregas">("conteudo");
  const missing = [...q.blocking.map(c => c.label), ...(media.avisos ?? [])];
  const tab = (k: typeof view, label: string, badge?: string) => <button type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`rounded-md px-2.5 py-1 text-xs ${view === k ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>{label}{badge && <span className="ml-1 text-warning">{badge}</span>}</button>;
  const postiz = post ? postizOf(post) : undefined;
  const pendentes = postiz?.erros ? Object.entries(postiz.erros).filter(([, m]) => m !== "sem canal" && !m.startsWith("carrossel com vídeo")) : [];
  const hasMedia = /^https?:\/\//.test(f.mediaUrl);
  const going = media.items?.filter(m => m.uso === "vai") ?? null;
  const hasLayout = media.items?.some(m => m.contentType.startsWith("text/html")) ?? false;
  const editable = post ? mediaEditable(post) : false;
  const afterMedia = () => { media.reload(); router.refresh(); };
  const scheduleNow = () => start(async () => { const r = await scheduleSocialPostAction(post!.id); if (!r.ok) toast.error(r.error); else { toast.success(r.data.falhas.length ? `Agendado; ficou para depois: ${r.data.falhas.join(", ")}` : "Agendado nas redes"); router.refresh(); onDone(); } });
  const checkPostiz = () => start(async () => { const r = await syncSocialPostsAction(); if (!r.ok) toast.error(r.error); else { toast.success(r.data.linked || r.data.published ? "Conferido: o Postiz já publicou, o post foi atualizado" : "Conferido: nada novo no Postiz"); router.refresh(); onDone(); } });
  return <div className="grid gap-5 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    <aside className="space-y-2">
      <MediaGallery items={going} cover={f.mediaUrl} />
      {post && media.items && media.items.length > 0 && <MediaList items={media.items} postId={post.id} editable={editable} attention={(media.avisos?.length ?? 0) > 0} onChanged={afterMedia} />}
      {(media.substituidas ?? 0) > 0 && editable && post && <SupersededNotice postId={post.id} count={media.substituidas!} onDone={afterMedia} />}
      {post && hasLayout && <div className="flex"><LayoutEditorButton postId={post.id} imageNames={(going ?? []).map(m => m.filename)} onSaved={url => { if (url) set("mediaUrl", url); afterMedia(); }} /></div>}
      {(!post || editable) && <div className="flex gap-2">
        <label className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border py-1.5 text-xs hover:bg-surface-2 ${uploading ? "pointer-events-none opacity-60" : ""}`}><Upload className="size-3.5" />{uploading ? "Enviando…" : hasMedia ? "Trocar capa" : "Enviar capa"}
          <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4" className="sr-only" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} /></label>
        {post && <SlidesUpload postId={post.id} onDone={afterMedia} />}
      </div>}
    </aside>
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{post ? STAGE_LABELS[post.stage as SocialStage] : "Novo"}</span>
        {post?.scheduledAt && <span className="text-[11px] text-muted">{fmt(post.scheduledAt)}</span>}
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] ${missing.length ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>{missing.length ? `faltam ${missing.length}` : "pronto"}</span>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-border pb-2">{tab("conteudo", "Conteúdo")}{tab("entregas", "Entregas", missing.length ? String(missing.length) : undefined)}</div>
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
        <ul className="grid gap-1 border-t border-border pt-3 text-xs sm:grid-cols-2">
          {[...q.checks.filter(c => c.required), ...deliveries].map(c => <li key={c.key} className="flex gap-1.5">{c.ok ? <CheckCircle2 className="size-3.5 shrink-0 text-success" /> : <AlertTriangle className="size-3.5 shrink-0 text-warning" />}<span className={c.ok ? "text-muted" : ""}>{c.label}</span></li>)}
          {(media.avisos ?? []).map(a => <li key={a} className="flex gap-1.5"><AlertTriangle className="size-3.5 shrink-0 text-warning" /><span>{a}</span></li>)}
        </ul>
        <p className="text-[11px] text-faint">Nas outras redes o último slide vira a tela final (curte, comenta, compartilha), porque só o Instagram tem a automação da palavra-chave.</p>
      </div>}
      {postiz && <p className="text-[11px] text-muted">Agendado para {fmt(postiz.scheduledFor)}{postiz.canais ? ` em ${Object.keys(postiz.canais).map(n => NETWORK_LABELS[n as SocialNetwork] ?? n).join(", ")}` : ""}.{pendentes.length ? ` Ficou para depois: ${pendentes.map(([n, m]) => `${NETWORK_LABELS[n as SocialNetwork] ?? n} (${m})`).join("; ")}.` : ""}</p>}
      {post?.stage === "aprovado" && !postiz && <p className="rounded-xl bg-warning/5 px-3 py-2 text-[11px] text-warning">{post.checks?.agendamento?.pendente ? `${post.checks.agendamento.motivo} O fechamento da noite tenta de novo.` : "Aprovado, mas ainda não está no Postiz."} Se ele já saiu direto pelo Postiz, use Conferir no Postiz.</p>}
      {post?.checks?.arquivo && <p className="text-[11px] text-faint">{post.checks.arquivo.removidas} arquivo(s) saíram do armazenamento em {fmt(post.checks.arquivo.at)} (retenção); a capa ficou de registro.</p>}
      <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {post && <Button size="sm" variant="ghost" className="mr-auto text-muted" disabled={pending} onClick={remove}><Trash2 />Excluir</Button>}
        {post && (post.stage === "aprovado" || post.stage === "falhou") && !postiz && <Button size="sm" variant="ghost" disabled={pending} onClick={checkPostiz}><RefreshCw />Conferir no Postiz</Button>}
        {post && (pendentes.length > 0 || (post.stage === "aprovado" && !postiz)) && <Button size="sm" variant="outline" disabled={pending} onClick={scheduleNow}>{pending && <Loader2 className="animate-spin" />}{postiz ? "Agendar nas outras redes" : "Agendar no Postiz"}</Button>}
        <Button size="sm" variant="ghost" disabled={pending || !f.title.trim()} onClick={save}>{pending ? "Salvando…" : "Salvar"}</Button>
        {post?.stage === "revisao" && <ApproveControl post={post} blocked={pending || media.items === null || missing.length > 0} onDone={onDone} before={async () => {
          const r = await updateSocialPostAction(post.id, payload());
          if (!r.ok) toast.error(r.error);
          return r.ok;
        }} />}
      </div>
    </div>
  </div>;
}

/** Prévia da mídia. "cover" preenche o card (miniatura); "contain" mostra a peça inteira, sem cortar. */
function MediaPreview({ url, className = "", controls = false, fit = "cover", video }: { url: string; className?: string; controls?: boolean; fit?: "cover" | "contain"; video?: boolean }) {
  const [broken, setBroken] = React.useState(false);
  const box = `overflow-hidden rounded-lg bg-surface ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`;
  if (broken) return <a href={url} target="_blank" rel="noopener noreferrer" className={`${box} grid min-h-16 place-items-center p-3 text-center text-[11px] text-warning`}>Mídia não carregou — abrir link</a>;
  return video ?? /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(url)
    ? <video src={url} className={box} controls={controls} muted playsInline preload="metadata" onError={() => setBroken(true)} />
    // eslint-disable-next-line @next/next/no-img-element -- mídias vêm do storage de mídia e de links externos; next/image exigiria lista fixa de domínios
    : <img src={url} alt="" loading="lazy" className={box} onError={() => setBroken(true)} />;
}

type MediaItem = { id: string; filename: string; contentType: string; size: number; url: string; uso: "vai" | "substituida" | "fora"; ordem: number | null; capa: boolean };
type MediaState = { items: MediaItem[] | null; avisos: string[] | null; substituidas: number | null };
async function fetchPostMedia(postId: string): Promise<MediaState> {
  const res = await fetch(`/api/redes/midia?postId=${postId}`, { cache: "no-store" });
  const json = (await res.json()) as { midias?: MediaItem[]; avisos?: string[]; substituidas?: number; error?: string };
  if (!res.ok) throw new Error(json.error ?? "Não consegui ler as mídias.");
  return { items: json.midias ?? [], avisos: json.avisos ?? [], substituidas: json.substituidas ?? 0 };
}
/** Mídias do post (com o uso de cada uma e os bloqueios). Recarrega quando a capa muda ou depois de mexer nas mídias. */
function usePostMedia(postId: string | null, cover: string) {
  const [state, setState] = React.useState<MediaState>({ items: null, avisos: null, substituidas: null });
  const [version, reload] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    if (!postId) return;
    let alive = true;
    void fetchPostMedia(postId).then(s => { if (alive) setState(s); }, () => { if (alive) setState({ items: [], avisos: ["Não consegui ler as mídias do post. Recarregue a página."], substituidas: 0 }); });
    return () => { alive = false; };
  }, [postId, cover, version]);
  return { ...state, items: postId ? state.items : [], reload };
}

/** Prévia grande do post com setas: o que vai para a rede, na ordem em que vai para o Postiz. */
function MediaGallery({ items, cover, compact = false }: { items: MediaItem[] | null; cover: string; compact?: boolean }) {
  const [i, setI] = React.useState(0);
  // Enquanto as mídias carregam, não chuta o tipo pela capa (link sem extensão viraria imagem quebrada).
  const list = items === null ? [] : items.length ? items.map(m => ({ url: m.url, video: m.contentType.startsWith("video/") })) : /^https?:\/\//.test(cover) ? [{ url: cover, video: undefined }] : [];
  const at = Math.min(i, Math.max(list.length - 1, 0));
  const go = (d: number) => setI(Math.max(0, Math.min(list.length - 1, at + d)));
  if (compact) return <button type="button" aria-label={list.length > 1 ? `Mídia ${at + 1} de ${list.length}; toque para a próxima` : "Prévia"} onClick={() => list.length > 1 && setI((at + 1) % list.length)} className="relative block aspect-[4/5] w-full overflow-hidden rounded-lg bg-surface-2">
    {list.length ? <MediaPreview key={list[at].url} url={list[at].url} video={list[at].video} className="absolute inset-0 size-full rounded-none" /> : <span className="grid size-full place-items-center text-[10px] text-faint">{items === null ? "…" : "sem capa"}</span>}
    {list.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] tabular-nums text-white">{at + 1}/{list.length}</span>}
  </button>;
  return <div className="space-y-2 outline-none" tabIndex={-1} onKeyDown={e => { if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1); }}>
    <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-xl border border-border bg-black/80">
      {list.length ? <MediaPreview key={list[at].url} url={list[at].url} video={list[at].video} controls fit="contain" className="size-full rounded-none bg-transparent" /> : <span className="px-4 text-center text-[11px] text-faint">{items === null ? "Carregando mídias…" : "Sem capa ainda"}</span>}
      {list.length > 1 && <>
        <button type="button" aria-label="Anterior" disabled={at === 0} onClick={() => go(-1)} className="absolute left-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"><ChevronLeft className="size-5" /></button>
        <button type="button" aria-label="Próxima" disabled={at === list.length - 1} onClick={() => go(1)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"><ChevronRight className="size-5" /></button>
        <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] tabular-nums text-white">{at + 1}/{list.length}</span>
      </>}
    </div>
    {list.length > 1 && <div className="flex justify-center gap-1.5">{list.map((u, k) => <button key={u.url} type="button" aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-1.5 rounded-full transition-all ${k === at ? "w-5 bg-accent" : "w-1.5 bg-border-strong hover:bg-muted"}`} />)}</div>}
  </div>;
}

const USE_LABEL: Record<MediaItem["uso"], string> = { vai: "vai", substituida: "versão antiga", fora: "não vai" };
/** Todas as mídias do post com o uso de cada uma e o botão de remover (só antes de ir para o Postiz). */
function MediaList({ items, postId, editable, attention, onChanged }: { items: MediaItem[]; postId: string; editable: boolean; attention: boolean; onChanged: () => void }) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const remove = async (m: MediaItem) => {
    if (!(await confirmAction(`Remover ${m.filename} do post? O arquivo sai do armazenamento.`))) return;
    setBusy(m.id);
    try {
      const r = await removeSocialMediaAction(postId, [m.id]);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${m.filename} removida`);
      onChanged();
    } finally { setBusy(null); }
  };
  return <details className="rounded-xl border border-border text-xs" open={attention || items.some(m => m.uso === "substituida")}>
    <summary className="cursor-pointer px-3 py-2 text-muted">{items.length} {items.length === 1 ? "arquivo" : "arquivos"} no post · {items.filter(m => m.uso === "vai").length} vão para a rede</summary>
    <ul className="max-h-56 divide-y divide-border overflow-y-auto border-t border-border">{items.map(m => <li key={m.id} className="flex items-center gap-2 px-3 py-1.5">
      <span className="w-6 shrink-0 text-right tabular-nums text-faint">{m.ordem ?? "–"}</span>
      <span className="min-w-0 flex-1 truncate" title={m.filename}>{m.filename}{m.capa ? <span className="ml-1 text-faint">(capa)</span> : null}</span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${m.uso === "vai" ? "bg-success/10 text-success" : m.uso === "substituida" ? "bg-warning/10 text-warning" : "bg-surface-2 text-muted"}`}>{USE_LABEL[m.uso]}</span>
      {editable && <button type="button" aria-label={`Remover ${m.filename}`} disabled={busy !== null} onClick={() => void remove(m)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50">{busy === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}</button>}
    </li>)}</ul>
  </details>;
}

/** Envia slides e vídeo do post (o número no fim do nome define a ordem: …-01, …-02). Um .html vira o layout editável. */
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
    <input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,text/html,.html" className="sr-only" disabled={busy} onChange={e => { const fl = e.target.files; if (fl?.length) void send(fl); e.target.value = ""; }} /></label>;
}
