import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronDown, Newspaper, Radio } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { JOURNAL_SECTIONS, journalHref, type JournalArticle, type JournalSection } from "@/lib/journal";
import { formatLong, localTime, shiftDate, today } from "@/lib/dates";
import { journalFeed } from "@/server/journal";
import { JournalArticleBody } from "@/components/journal/article-body";
import { JournalDailyContext } from "@/components/journal/daily-context";
import { JournalCommercialPulse, JournalProductPulse } from "@/components/journal/business-pulse";
import styles from "./journal.module.css";

export const metadata = { title: "Jornal da Órbita" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ data?: string; secao?: string; pagina?: string }> }) {
  const params = await searchParams;
  const currentDay = today();
  const date = params.data ?? currentDay;
  if (!z.iso.date().safeParse(date).success || date > currentDay || date < shiftDate(currentDay, -30)) notFound();
  const current = date === currentDay;
  const section = params.secao && Object.hasOwn(JOURNAL_SECTIONS, params.secao) ? params.secao as JournalSection : undefined;
  const page = /^\d{1,2}$/.test(params.pagina ?? "") ? Math.min(9, Number(params.pagina)) : 0;
  const edition = await journalFeed(date).then(feed => ({ ...feed, unavailable: false })).catch(() => ({ data: date, articles: [] as JournalArticle[], parcial: true, consultadoEm: new Date().toISOString(), unavailable: true }));
  const filtered = edition.articles.filter(article => !section || article.secao === section).sort((a, b) => Number(b.destaque) - Number(a.destaque) || b.recebidoEm.localeCompare(a.recebidoEm) || a.id.localeCompare(b.id));
  const articles = filtered.slice(page * 12, (page + 1) * 12);
  const href = (nextSection?: string, nextPage = 0) => `${journalHref(date)}${nextSection ? `&secao=${encodeURIComponent(nextSection)}` : ""}${nextPage ? `&pagina=${nextPage}` : ""}`;
  return <div className={styles.journal}>
    <header className={styles.masthead}>
      <Link href="/jornal" className={styles.brand} aria-label="Jornal da Órbita, edição de hoje"><Newspaper className="size-5" /><span>ÓRBITA <span className={styles.brandWord}>JORNAL</span></span></Link>
      <p className="text-[11px] text-muted">Uma pausa para enxergar o todo.</p>
    </header>
    <div className={styles.datebar}>
      <p className="text-xs capitalize text-muted">{formatLong(date)} <span className="ml-2 hidden text-faint sm:inline">· São Paulo</span></p>
      <div className="flex items-center gap-2">
        {date > shiftDate(currentDay, -30) && <Link href={journalHref(shiftDate(date, -1))} aria-label="Edição anterior" className={styles.dateArrow}><ArrowLeft className="size-3.5" /></Link>}
        <form action="/jornal" className="flex items-center gap-2"><label htmlFor="journal-date" className="sr-only">Data da edição</label><input id="journal-date" name="data" type="date" defaultValue={date} min={shiftDate(currentDay, -30)} max={currentDay} className={styles.dateInput} /><button type="submit" className="rounded-lg px-2 py-1 text-xs text-accent hover:bg-surface-2">Abrir</button></form>
        {!current && <Link href={journalHref(shiftDate(date, 1))} aria-label="Próxima edição" className={styles.dateArrow}><ArrowRight className="size-3.5" /></Link>}
      </div>
    </div>
    <section className={styles.hero} aria-labelledby="journal-title">
      <Image src="/jornal/aurora-orbital.webp" alt="" fill priority sizes="(max-width: 1400px) 100vw, 1280px" className={styles.heroImage} />
      <div className={styles.heroShade} />
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}><span className={styles.liveDot} />{current ? "Edição em atualização" : "Arquivo editorial"} <span className="opacity-40">/</span> AG LABS</p>
        <h1 id="journal-title">Seu dia,<br /><em>em perspectiva.</em></h1>
        <p className={styles.heroDescription}>O essencial da sua operação, as ideias que merecem atenção e os próximos movimentos. Tudo encontra seu lugar aqui.</p>
        <div className={styles.heroFooter}><span>Jornal da Órbita</span><span>{edition.unavailable ? "Consulta indisponível" : `${edition.articles.length}${edition.parcial ? "+" : ""} matérias recebidas`} · {current ? "ao longo do dia" : "nesta edição"}</span></div>
      </div>
    </section>
    {current ? <Suspense fallback={<div role="status" aria-label="Carregando pauta do dia" className="loading-shimmer h-44 rounded-2xl" />}><JournalDailyContext /></Suspense> : <p className={styles.archiveNote}>Você está lendo as matérias recebidas para esta edição. Indicadores, agenda e pendências ao vivo aparecem somente na edição de hoje. <Link href="/jornal">Voltar para hoje →</Link></p>}
    <div className={styles.columns}>
      <main className="min-w-0">
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>Informação que vira contexto</p><h2>Em pauta</h2></div><span className="text-[11px] text-faint">Recebido até {localTime(new Date(edition.consultadoEm))}</span></div>
        <nav aria-label="Editorias do Jornal" className={styles.sections}>
          <Link href={href()} aria-current={!section ? "page" : undefined}>Tudo <span>{edition.articles.length}</span></Link>
          {Object.entries(JOURNAL_SECTIONS).map(([key, name]) => <Link key={key} href={href(key)} aria-current={section === key ? "page" : undefined}>{name}<span>{edition.articles.filter(article => article.secao === key).length}</span></Link>)}
        </nav>
        {edition.parcial && <p role="status" className="mb-4 rounded-xl border border-warning/20 bg-warning/5 p-3 text-xs text-warning">{edition.unavailable ? "Não foi possível consultar as matérias. Tente atualizar a página; não foi presumida uma edição vazia." : "Amostra limitada às 120 matérias mais recentes; registros incompatíveis não foram exibidos."}</p>}
        {!articles.length && !edition.unavailable && <div className={styles.empty}><Radio className="size-7 text-accent" /><h3>{filtered.length ? "Fim desta seleção" : section ? `O ${JOURNAL_SECTIONS[section].toLowerCase()} ainda está em silêncio.` : "Seu radar começa aqui."}</h3><p>{filtered.length ? "Volte à primeira página para ler as matérias recebidas." : "As notícias e os resumos enviados pelas suas rotinas aparecerão nesta edição, com autoria, data e fontes. Nada recebido ainda não significa que a rotina foi executada."}</p><Link href={filtered.length ? href(section) : "/documentacao#jornal"}>{filtered.length ? "Primeira página" : "Como alimentar o Jornal"}<ArrowUpRight className="size-3.5" /></Link></div>}
        <div className="space-y-4">{articles.map(article => <JournalArticleCard key={article.id} article={article} />)}</div>
        {filtered.length > 12 && <nav aria-label="Paginação das matérias" className="mt-5 flex items-center justify-between text-xs text-accent"><span>{page > 0 && <Link href={href(section, page - 1)}>← Anteriores</Link>}</span><span className="text-muted">Página {page + 1} de {Math.ceil(filtered.length / 12)}</span><span>{(page + 1) * 12 < filtered.length && <Link href={href(section, page + 1)}>Próximas →</Link>}</span></nav>}
        <div className={styles.editorNote}><BookOpen className="size-5 shrink-0" /><div><h3>Boa informação também tem origem.</h3><p>As matérias são relatos das rotinas e dos agentes. Fontes permitem conferir o contexto; destaque editorial não é validação independente nem autorização para executar ações.</p></div></div>
      </main>
      <aside aria-label="Contexto dos negócios" className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-border bg-surface/70 p-5 sm:p-6" aria-labelledby="journal-receipts"><p className={styles.kicker}>Recebimentos da edição</p><h2 id="journal-receipts" className="mt-2 text-lg font-semibold">Seu radar, com origem</h2><div className="mt-4 space-y-4">{(["ia", "emails"] as const).map(key => {
          const items = edition.articles.filter(article => article.secao === key && !article.legado);
          return <div key={key}><p className="text-xs font-medium">{JOURNAL_SECTIONS[key]}</p><p className="mt-1 text-[11px] text-muted">{edition.unavailable ? "Consulta indisponível" : items.length ? `${items.length} matéria(s) · última às ${localTime(new Date(items[0].recebidoEm))} · ${items[0].autor}` : "Ainda sem matéria recebida nesta edição"}</p></div>;
        })}</div><p className="mt-4 border-t border-border pt-3 text-[10px] leading-relaxed text-faint">Recebimento confirma uma remessa. Não comprova que toda a pesquisa ou caixa foi coberta.</p></section>
        {current && <><Suspense fallback={<PulseLoading title="Consultando sinais comerciais" />}><JournalCommercialPulse /></Suspense><Suspense fallback={<PulseLoading title="Consultando aplicativos" />}><JournalProductPulse /></Suspense></>}
        <section className={styles.sideNote}><p className={styles.kicker}>Próxima leitura</p><h2>Menos ruído.<br /><em>Mais direção.</em></h2><p>O bom dia entrega um resumo curto e traz você para esta edição. Aqui, cada assunto tem espaço para ser entendido.</p><Link href="/projetos/624e1799-0d66-4743-8d56-749bf78744f7?escopo=empresa">Projeto do Jornal <ArrowUpRight className="size-3.5" /></Link></section>
      </aside>
    </div>
    <footer className={styles.footer}><span>ÓRBITA JORNAL · Seu contexto, conectado.</span><Link href="/documentacao#jornal">Fontes e recebimento →</Link><span>Arquivo segue a retenção operacional de 30 dias após o recebimento.</span></footer>
  </div>;
}

function JournalArticleCard({ article }: { article: JournalArticle }) {
  return <article id={`materia-${article.id}`} className={`${styles.article} ${article.destaque ? styles.featured : ""}`}>
    <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[.12em]"><span className="text-accent">{article.legado ? "Resumo operacional · legado" : JOURNAL_SECTIONS[article.secao]}</span>{article.destaque && <span className={styles.highlight}>Em destaque</span>}<span className="ml-auto text-faint">{localTime(new Date(article.recebidoEm))}</span></div>
    <h3 className={styles.articleTitle}>{article.titulo}</h3><p className={styles.articleSummary}>{article.resumo}</p>
    {article.pontos.length > 0 && <div className={styles.takeaways}><p>Por que prestar atenção</p><ul>{article.pontos.map((point, index) => <li key={index}>{point}</li>)}</ul></div>}
    <details className={styles.readMore}><summary>Ler matéria completa<ChevronDown className="size-3.5" /></summary><div className="mt-4 break-words"><JournalArticleBody content={article.conteudo} /></div></details>
    <div className={styles.articleByline}><span>Por {article.autor} · recebido em {new Date(article.recebidoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span><span>{article.fontes.length ? `${article.fontes.length} fonte${article.fontes.length === 1 ? "" : "s"}` : "Sem fonte externa anexada"}</span></div>
    {!!article.fontes.length && <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-accent">{article.fontes.map((source, index) => <li key={index}><a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">{source.titulo}<ArrowUpRight className="size-3" /></a></li>)}</ul>}
  </article>;
}
function PulseLoading({ title }: { title: string }) { return <div role="status" aria-label={title} className="loading-shimmer min-h-56 rounded-2xl border border-border p-6"><p className="text-xs text-muted">{title}…</p></div>; }
