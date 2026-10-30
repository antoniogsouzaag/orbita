import Link from "next/link";
import { MessageSquareHeart } from "lucide-react";
import { FeedbackActions } from "@/components/empresa/feedback-actions";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { pillClass } from "@/components/ui/pill";
import { requireAuth } from "@/lib/auth";
import { FEEDBACK_STATUSES, FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/crm-feedback";
import { crmFeedback } from "@/server/crm-feedback";

export const metadata = { title: "Feedback dos apps" };

const PRODUCTS = ["members", "mecard", "barberias", "viajeki"] as const;
const label = (product: string) => product.charAt(0).toUpperCase() + product.slice(1);

export default async function Page({ searchParams }: { searchParams: Promise<{ produto?: string; status?: string }> }) {
  await requireAuth();
  const params = await searchParams;
  const produto = PRODUCTS.find((p) => p === params.produto);
  const status = FEEDBACK_STATUSES.find((s) => s === params.status) as FeedbackStatus | undefined;
  const result = await crmFeedback({ produto, status, limite: 100 });
  const href = (next: { produto?: string; status?: string }) => {
    const q = new URLSearchParams();
    const p = "produto" in next ? next.produto : produto;
    const s = "status" in next ? next.status : status;
    if (p) q.set("produto", p);
    if (s) q.set("status", s);
    return `/empresa/feedback${q.size ? `?${q}` : ""}`;
  };
  const byProduct = new Map<string, number>();
  for (const item of result.items) byProduct.set(item.produto, (byProduct.get(item.produto) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 sm:px-6">
      <PageHeader icon={<MessageSquareHeart />} title="Feedback dos apps" description="O que os usuários de Members, MeCard, Barberias e Viajeki enviam pelo botão de feedback, ligado ao lead no CRM." />
      <nav aria-label="Filtrar por produto" className="flex flex-wrap gap-2">
        <Link href={href({ produto: undefined })} className={pillClass(!produto)}>Todos</Link>
        {PRODUCTS.map((p) => <Link key={p} href={href({ produto: p })} className={pillClass(produto === p)}>{label(p)}</Link>)}
      </nav>
      <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
        <Link href={href({ status: undefined })} className={pillClass(!status)}>Em aberto</Link>
        {FEEDBACK_STATUSES.map((s) => <Link key={s} href={href({ status: s })} className={pillClass(status === s)}>{FEEDBACK_STATUS_LABELS[s]}</Link>)}
      </nav>

      {result.status !== "ok" ? (
        <Card className="p-5"><p role="status" className="text-sm text-warning">{result.message}</p></Card>
      ) : result.items.length === 0 ? (
        <Card><EmptyState icon={<MessageSquareHeart />} title="Nenhum feedback aqui" description="Quando um app enviar feedback ao CRM, ele aparece nesta lista." /></Card>
      ) : (
        <>
          {!produto && byProduct.size > 1 && (
            <p className="text-xs text-muted">{[...byProduct].map(([p, n]) => `${label(p)}: ${n}`).join(" · ")}</p>
          )}
          <div className="space-y-2">
            {result.items.map((item) => (
              <Card key={item.id} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
                  <span className="rounded-full bg-surface-3 px-2 py-0.5 font-medium text-fg">{label(item.produto)}</span>
                  <span>{new Date(item.enviado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
                  {item.tela && <code className="rounded bg-surface-2 px-1.5 py-0.5">{item.tela}</code>}
                  <span className="ml-auto">{item.contato ? `${item.contato.nome ?? "Contato sem nome"} · ${item.contato.etapa}${item.contato.conta ? ` · ${item.contato.conta}` : ""}` : "Sem contato no CRM"}</span>
                </div>
                <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{item.mensagem}</p>
                <FeedbackActions item={item} />
              </Card>
            ))}
          </div>
          <p className="text-[11px] text-faint">Fonte: CRM · crm_feedback, consultado em {new Date(result.checkedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}. O status aqui é a triagem da AG LABS; o admin de cada app tem o próprio.</p>
        </>
      )}
    </div>
  );
}
