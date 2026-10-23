import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { listCalendars } from "./calendar";
import { crmConfigured, crmOverview } from "./crm";
import { githubInbox, githubInboxConfig } from "./github-inbox";
import { n8nInstances, n8nOverview } from "./ops";
import { liveOps } from "./ops-live";
import { vaultConfig, vaultHealth } from "./vault";
import { socialChannels } from "./social";

export type IntegrationHealthRow = {
  id: string;
  name: string;
  state: "configured" | "verified" | "warning" | "missing" | "error";
  detail: string;
  env: string[];
  href?: string;
  checkedAt: string | null;
};

const has = (key: string) => Boolean(process.env[key]?.trim());
const validToken = (key: string) => (process.env[key]?.trim().length ?? 0) >= 16;

/** Configuração não significa conexão validada; só sondagens explícitas recebem "verified". */
export function integrationConfiguration(): IntegrationHealthRow[] {
  const vault = vaultConfig();
  const gh = githubInboxConfig();
  const row = (id: string, name: string, configured: boolean, detail: string, env: string[], href?: string): IntegrationHealthRow => ({ id, name, state: configured ? "configured" : "missing", detail, env, href, checkedAt: null });
  return [
    row("database", "Banco de dados", true, has("DATABASE_URL") ? "Postgres configurado. Verifique a resposta do banco." : "PGlite local de desenvolvimento. Configure Postgres para persistência em produção.", ["DATABASE_URL"]),
    row("vault", "Vault · Knowledge", vault.configured, vault.local ? "Cópia local do vault configurada." : `${vault.repo} · ${vault.branch}. Cada salvamento no GitHub gera um commit.`, ["VAULT_GITHUB_TOKEN", "VAULT_GITHUB_REPO", "VAULT_GITHUB_BRANCH"], "/vault"),
    row("github", "GitHub · PRs e propostas", gh.configured, gh.credential ? `Credencial: ${gh.credential}. ${gh.warning}` : "Configure um token de leitura para os repositórios da organização. O acesso do Knowledge também pode ser reutilizado com as permissões que ele já tem.", ["GITHUB_INBOX_TOKEN", "GITHUB_ORG"], "/github"),
    row("crm", "CRM · AG LABS", crmConfigured(), "Resumo comercial e tarefas via MCP. O CRM aplica as próprias permissões.", ["CRM_MCP_URL", "CRM_MCP_TOKEN"], "/empresa"),
    row("n8n", "n8n · Workflows", n8nInstances().length > 0, has("N8N_INSTANCES") && !n8nInstances().length ? "N8N_INSTANCES está preenchida, mas não contém instâncias válidas com url e apiKey." : "Consulta de workflows e falhas pela API pública de cada servidor.", ["N8N_INSTANCES"], "/operacao/automacoes"),
    row("monitors", "Monitores · n8n → Órbita", validToken("OPS_TOKEN"), "Recebe resultados em /api/ops/ingest. O diagnóstico verifica se há batidas recentes registradas.", ["OPS_TOKEN"], "/operacao"),
    row("telegram", "Telegram · Avisos", has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID"), "O diagnóstico consulta bot e destino sem enviar mensagens. A entrega só é confirmada por um envio real.", ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]),
    row("brief", "Resumo diário · 7h", validToken("CRON_SECRET") && has("TELEGRAM_BOT_TOKEN") && has("TELEGRAM_CHAT_ID"), "Precisa do agendador da Vercel, CRON_SECRET e Telegram. Configuração não comprova execução do resumo.", ["CRON_SECRET"], "/agenda"),
    row("calendar", "Agenda · Assinaturas e feed", validToken("CALENDAR_FEED_TOKEN"), "Calendários externos são adicionados na Agenda. O feed da Órbita pode ser assinado no iPhone ou Google.", ["CALENDAR_FEED_TOKEN"], "/agenda"),
    row("context", "Agentes · Contexto e MCP", validToken("CONTEXT_TOKEN"), "GET /api/context usa CONTEXT_TOKEN. O MCP usa acessos individuais criados em Agentes, independente deste token.", ["CONTEXT_TOKEN"], "/agentes"),
    row("ai", "IA · Assistente", has("OPENAI_API_KEY") || has("ANTHROPIC_API_KEY"), "Assistente com ações em tarefas, agenda, finanças e CRM, além de consulta ao vault. Este botão verifica a configuração; converse na IA para usar o assistente.", ["OPENAI_API_KEY", "OPENAI_MODEL", "ANTHROPIC_API_KEY"], "/ia"),
    row("jev", "Jev · Decisões opcionais", has("OPENROUTER_API_KEY"), "Via OpenRouter. Seleciona uma próxima ação entre tarefas existentes, somente quando você pedir. Usa confiança mínima e preserva a ordem por regras quando houver dúvida. Não substitui o chat nem executa ações.", ["OPENROUTER_API_KEY", "OPENROUTER_JEV_MODEL"], "/"),
    row("postiz", "Postiz · Redes sociais", has("POSTIZ_API_URL") && has("POSTIZ_API_KEY"), "Canais e séries de métricas na página Redes sociais. A cobertura depende da versão instalada e das permissões de cada rede.", ["POSTIZ_API_URL", "POSTIZ_API_KEY"], "/redes"),
    row("covers", "Unsplash · Capas", has("UNSPLASH_ACCESS_KEY"), "Busca opcional de fotografias. Capas sugeridas e URLs próprias continuam disponíveis.", ["UNSPLASH_ACCESS_KEY"], "/config"),
  ];
}

async function telegramProbe() {
  const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  const responses = await Promise.all([
    fetch(`${base}/getMe`, { cache: "no-store", signal: AbortSignal.timeout(8000) }),
    fetch(`${base}/getChat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID }), cache: "no-store", signal: AbortSignal.timeout(8000) }),
  ]);
  for (const response of responses) {
    if (!response.ok || !(await response.json() as { ok?: boolean }).ok) throw new Error("Telegram recusou o bot ou o destino configurado.");
  }
}

/** Todas as sondagens são de leitura. Não envia mensagens, não executa workflows e não altera credenciais. */
export async function checkIntegrationHealth(): Promise<IntegrationHealthRow[]> {
  const rows = integrationConfiguration();
  return Promise.all(rows.map(async (row): Promise<IntegrationHealthRow> => {
    if (row.state === "missing" && row.id !== "calendar") return row;
    const checkedAt = new Date().toISOString();
    const result = (state: IntegrationHealthRow["state"], detail: string): IntegrationHealthRow => ({ ...row, state, detail, checkedAt });
    try {
      switch (row.id) {
        case "database": {
          const db = await getDb();
          await db.execute(sql`select 1`);
          return result(has("DATABASE_URL") ? "verified" : "warning", has("DATABASE_URL") ? "O Postgres respondeu à consulta de leitura." : "PGlite local respondeu. Persistência em produção ainda depende de DATABASE_URL.");
        }
        case "vault": {
          const health = await vaultHealth();
          return result(health.ok ? "verified" : "error", health.ok ? `${health.notes} notas lidas do vault.` : health.error ?? "O vault não respondeu.");
        }
        case "github": {
          const inbox = await githubInbox({ force: true });
          return result(inbox.error ? "error" : inbox.credential === "VAULT_GITHUB_TOKEN" || inbox.truncated ? "warning" : "verified", inbox.error ?? `${inbox.items.length} de ${inbox.total} PRs/propostas visíveis. ${inbox.warning}`);
        }
        case "crm": {
          const crm = await crmOverview(0);
          return result(crm.configured && crm.ok ? "verified" : "error", crm.configured && crm.ok ? "Resumo e tarefas retornados pelo MCP do CRM." : crm.configured ? crm.error : "CRM não configurado.");
        }
        case "n8n": {
          const overview = await n8nOverview();
          const failed = overview.instances.filter((instance) => !instance.ok);
          const workflows = overview.instances.flatMap((instance) => instance.workflows);
          return result(failed.length ? "error" : "verified", failed.length ? `${failed.length} de ${overview.instances.length} instâncias não responderam. Confira URL, acesso e chave da API.` : `${overview.instances.length} instâncias responderam · ${workflows.filter((w) => w.active).length}/${workflows.length} workflows ativos.`);
        }
        case "monitors": {
          const live = await liveOps();
          const silent = live.monitors.filter((monitor) => monitor.silent);
          return result(live.monitors.length && !silent.length ? "verified" : "warning", !live.monitors.length ? "Token configurado, mas nenhuma batida de monitor foi recebida. Confira os envios dos monitores no n8n." : `${live.monitors.length - silent.length}/${live.monitors.length} monitores com batida recente${silent.length ? ` · ${silent.length} em silêncio` : ""}.`);
        }
        case "telegram": {
          await telegramProbe();
          return result("verified", "Bot e destino responderam. Nenhuma mensagem foi enviada; entrega não testada.");
        }
        case "calendar": {
          const calendars = (await listCalendars()).filter((calendar) => calendar.kind === "ics" && calendar.enabled);
          const failed = calendars.filter((calendar) => calendar.lastError);
          const waiting = calendars.filter((calendar) => !calendar.lastSyncedAt);
          return result(failed.length || waiting.length ? "warning" : calendars.length ? "verified" : row.state, `${calendars.length} fontes externas ativas · ${failed.length} com erro · ${waiting.length} sem sincronização. Feed de saída ${validToken("CALENDAR_FEED_TOKEN") ? "configurado" : "sem token"}.`);
        }
        case "postiz": {
          const channels = await socialChannels();
          return result("verified", `${channels.length} canais retornados pela API do Postiz. As métricas são consultadas por canal em Redes sociais.`);
        }
        case "jev": {
          const response = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
          if (!response.ok) throw new Error("OpenRouter indisponível");
          const key = await response.json() as { data?: { is_disabled?: boolean; limit_remaining?: number | null } };
          if (!key.data || key.data.is_disabled) return result("error", "A credencial do OpenRouter está indisponível ou desativada.");
          return result(key.data.limit_remaining === 0 ? "warning" : "verified", key.data.limit_remaining === 0 ? "OpenRouter respondeu, mas o limite da chave está esgotado." : "Credencial OpenRouter autenticada. Jev disponível sob demanda; este diagnóstico não executou uma decisão nem consumiu inferência.");
        }
        case "covers": {
          const response = await fetch("https://api.unsplash.com/photos?per_page=1", { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` }, signal: AbortSignal.timeout(8000), cache: "no-store", redirect: "error" });
          if (!response.ok || !Array.isArray(await response.json())) throw new Error("Unsplash indisponível");
          return result("verified", "Unsplash respondeu à consulta de fotografias. Nenhuma capa foi alterada.");
        }
        default:
          return row; // Preserva "configurado": nenhuma conexão externa foi testada para estas opções.
      }
    } catch {
      // Nunca repasse exceções de transporte: podem conter tokens e URLs privadas.
      return result("error", `Não foi possível verificar ${row.name}. Confira a configuração e tente novamente.`);
    }
  }));
}
