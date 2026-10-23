import { Bot, CalendarDays, CheckCircle2, Circle, Database, GitCommitHorizontal, Image as ImageIcon, LibraryBig, Plug, Sparkles, Workflow } from "lucide-react";
import { headers } from "next/headers";
import { CopyButton } from "@/components/ops/copy-button";
import { Card, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { vaultConfig } from "@/server/vault";

export const metadata = { title: "Integrações" };

const has = (k: string) => Boolean(process.env[k]);

export default async function Page() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const base = `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
  const v = vaultConfig();
  const items = [
    { icon: Database, name: "Banco de dados", ok: has("DATABASE_URL"), env: ["DATABASE_URL"], desc: "Neon (Postgres). Sem ele, o app usa um banco local só para desenvolvimento." },
    { icon: LibraryBig, name: "Vault (Obsidian no GitHub)", ok: v.configured, env: ["VAULT_GITHUB_TOKEN", "VAULT_GITHUB_REPO", "VAULT_GITHUB_BRANCH"], desc: `Lê e grava ${v.repo} (${v.branch}). Cada salvamento é um commit — o GitHub segue como cópia na nuvem e o Obsidian sincroniza pelo obsidian-git. Token fine-grained: só este repositório, permissão “Contents: Read and write”.` },
    { icon: Sparkles, name: "IA (OpenAI)", ok: has("OPENAI_API_KEY") || has("ANTHROPIC_API_KEY"), env: ["OPENAI_API_KEY", "OPENAI_MODEL"], desc: "Perguntar à IA, chat e Plano do dia. Modelo padrão: gpt-6-luna (troque em OPENAI_MODEL). Também aceita Claude com ANTHROPIC_API_KEY + AI_PROVIDER=anthropic." },
    { icon: Workflow, name: "n8n → Órbita (status ao vivo)", ok: has("OPS_TOKEN"), env: ["OPS_TOKEN"], desc: "Os monitores do n8n enviam links, domínios e falhas; a Órbita guarda histórico, incidentes e a batida de cada monitor." },
    { icon: Workflow, name: "Órbita → n8n (lista de workflows)", ok: has("N8N_INSTANCES"), env: ["N8N_INSTANCES"], desc: "Opcional: com a chave da API pública de cada n8n, a Órbita lista workflows ativos/inativos e aponta os não documentados no vault." },
    { icon: CalendarDays, name: "Agenda (feed para o iPhone)", ok: has("CALENDAR_FEED_TOKEN"), env: ["CALENDAR_FEED_TOKEN"], desc: "Gera o link .ics para assinar no iPhone/Google. Assinaturas de iCloud/Google são adicionadas na própria Agenda." },
    { icon: Bot, name: "Contexto para agentes", ok: has("CONTEXT_TOKEN"), env: ["CONTEXT_TOKEN"], desc: "GET /api/context devolve o contexto operacional (vault + estado ao vivo). Para conexão completa por MCP, com acesso próprio por agente, use a página Agentes." },
    { icon: ImageIcon, name: "Capas do Unsplash", ok: has("UNSPLASH_ACCESS_KEY"), env: ["UNSPLASH_ACCESS_KEY"], desc: "Opcional: busca de capas. Sem ela, há sugestões prontas e URL própria." },
    { icon: GitCommitHorizontal, name: "Sequência de commits", ok: has("GITHUB_USER"), env: ["GITHUB_USER", "GITHUB_TOKEN"], desc: "Opcional: mostra “N dias seguidos de commits” no Início." },
  ];

  const ingestExample = `{
  "source": "n8n-vps03-ping",
  "label": "ping my links (VPS-03)",
  "everyMinutes": 15,
  "links": {{ JSON.stringify($('Lista de links').all().map((l, i) => ({ ...l.json, status: $('Verificar URL').all()[i]?.json.statusCode ?? 0, erro: $('Verificar URL').all()[i]?.json.error?.message ?? null }))) }}
}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6">
      <PageHeader icon={<Plug />} title="Integrações" description="O que está conectado. Os valores ficam nas variáveis de ambiente da Vercel — nunca aparecem aqui." />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <Card key={i.name} className="p-4">
            <div className="flex items-center gap-2">
              <i.icon className="size-4 text-muted" />
              <span className="font-medium">{i.name}</span>
              <span className={cn("ml-auto flex items-center gap-1 text-[12px]", i.ok ? "text-success" : "text-faint")}>{i.ok ? <CheckCircle2 className="size-3.5" /> : <Circle className="size-3.5" />}{i.ok ? "conectado" : "não configurado"}</span>
            </div>
            <p className="mt-2 text-[12.5px] text-muted">{i.desc}</p>
            <div className="mt-2 flex flex-wrap gap-1">{i.env.map((e) => <code key={e} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-faint">{e}</code>)}</div>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-5 text-[13px] text-muted">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-fg"><Workflow className="size-4" /> Como ligar os monitores do n8n</div>
        <ol className="list-decimal space-y-2 pl-5">
          <li><b className="text-fg">Lista única no vault.</b> No “ping my links”, troque o nó <i>Cadastro lista de links</i> por um <i>HTTP Request</i> GET em <code>{base}/api/ops/alvos</code> (cabeçalho <code>Authorization: Bearer OPS_TOKEN</code>), mantendo a lista atual como reserva caso a Órbita não responda. Assim, editar a nota “Monitoramento de Disponibilidade” muda o que é monitorado.</li>
          <li><b className="text-fg">Enviar resultados.</b> Ao final de cada execução (não só quando há alerta), um <i>HTTP Request</i> POST em <code>{base}/api/ops/ingest</code> com o corpo abaixo. Faça o mesmo no monitor cruzado do VPS-01 com <code>source</code> próprio.</li>
          <li><b className="text-fg">Domínios.</b> No “vencimento de domínios”, envie <code>{`{ source, everyMinutes: 4320, domains: [{ dominio, depende, expiracao, erro }] }`}</code> com todos os domínios consultados.</li>
          <li><b className="text-fg">Falhas de workflow.</b> Nos fluxos “alerta de falhas” de cada n8n, envie <code>{`{ source, workflowError: { workflow, node, message, executionUrl } }`}</code>.</li>
        </ol>
        <div className="relative">
          <pre className="overflow-x-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-[11.5px] leading-relaxed text-fg">{ingestExample}</pre>
          <CopyButton text={ingestExample} className="absolute right-2 top-2" />
        </div>
        <p className="text-[12px] text-faint">Se um monitor parar de enviar por mais de 2,5× o intervalo esperado, a Operação mostra “monitor em silêncio”.</p>
      </Card>
    </div>
  );
}
