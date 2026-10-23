"use client";

import { KeyRound, Plus, ShieldOff } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { createAgentTokenAction, revokeAgentTokenAction } from "@/app/actions/agents";
import { CopyButton } from "@/components/ops/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TokenRow = { id: string; name: string; prefix: string; scopes: string[]; revoked: boolean; lastUsedAt: string | null; createdAt: string };

const SCOPES: { id: string; label: string; desc: string }[] = [
  { id: "contexto", label: "Contexto", desc: "Ler o contexto operacional e buscar/ler notas do vault" },
  { id: "status", label: "Status", desc: "Ver sites fora do ar, incidentes, domínios e monitores" },
  { id: "tarefas", label: "Tarefas", desc: "Abrir tarefas para você e acompanhar as que abriu" },
  { id: "eventos", label: "Eventos", desc: "Registrar deploys, manutenções e incidentes na Operação" },
];

function ago(iso: string | null) {
  if (!iso) return "nunca usado";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "usado agora";
  if (m < 60) return `usado há ${m} min`;
  const h = Math.round(m / 60);
  return h < 48 ? `usado há ${h}h` : `usado há ${Math.round(h / 24)} dias`;
}

export function AgentTokens({ tokens, mcpUrl }: { tokens: TokenRow[]; mcpUrl: string }) {
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<string[]>(["contexto", "status"]);
  const [created, setCreated] = React.useState<{ name: string; token: string } | null>(null);
  const [pending, start] = React.useTransition();
  const active = tokens.filter((t) => !t.revoked);
  const revoked = tokens.filter((t) => t.revoked);

  const claudeCmd = created ? `claude mcp add --transport http orbita ${mcpUrl} --header "Authorization: Bearer ${created.token}"` : "";
  const codexToml = created ? `[mcp_servers.orbita]\nurl = "${mcpUrl}"\nhttp_headers = { Authorization = "Bearer ${created.token}" }` : "";

  return (
    <Card>
      <CardHeader icon={<KeyRound />} title="Acessos dos agentes" meta={`${active.length} ativo${active.length === 1 ? "" : "s"}`} />
      <div className="space-y-5 px-5 pb-5 text-[13px]">
        <form
          className="space-y-3 rounded-xl border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await createAgentTokenAction({ name, scopes });
              if ("error" in r) return void toast.error(r.error);
              setCreated({ name, token: r.token });
              setName("");
            });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do agente (ex.: Hermes Oracle, Claude Code)" className="h-9 min-w-[240px] flex-1" maxLength={60} />
            <Button size="sm" variant="primary" className="h-9" disabled={pending || name.trim().length < 2 || scopes.length === 0}>
              <Plus /> Criar acesso
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCOPES.map((s) => {
              const on = scopes.includes(s.id);
              return (
                <label key={s.id} className={cn("flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2 transition", on ? "border-accent/50 bg-accent/5" : "border-border hover:bg-surface-2")}>
                  <input type="checkbox" className="mt-0.5 accent-[var(--accent)]" checked={on} onChange={() => setScopes((v) => (on ? v.filter((x) => x !== s.id) : [...v, s.id]))} />
                  <span>
                    <span className="font-medium text-fg">{s.label}</span>
                    <span className="block text-[12px] text-muted">{s.desc}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="text-[12px] text-faint">Dê só o necessário. Nenhum agente acessa finanças, saúde, humor, notas pessoais ou edita o vault.</p>
        </form>

        {created && (
          <div className="space-y-3 rounded-xl border border-warning/40 bg-warning/5 p-4">
            <p className="font-medium text-fg">Token de {created.name} — copie agora, ele não aparece de novo.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[12px]">{created.token}</code>
              <CopyButton text={created.token} />
            </div>
            <div className="space-y-1">
              <p className="text-[12px] text-muted">Claude Code:</p>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-[11.5px]">{claudeCmd}</pre>
                <CopyButton text={claudeCmd} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[12px] text-muted">Codex (~/.codex/config.toml):</p>
              <div className="flex items-start gap-2">
                <pre className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-surface-2 p-2 font-mono text-[11.5px]">{codexToml}</pre>
                <CopyButton text={codexToml} />
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setCreated(null)}>Já guardei</Button>
          </div>
        )}

        {active.length === 0 ? (
          <p className="text-muted">Nenhum agente conectado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="font-medium">{t.name}</span>
                <code className="font-mono text-[11.5px] text-faint">{t.prefix}…</code>
                <span className="flex flex-wrap gap-1">
                  {t.scopes.map((s) => <span key={s} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{s}</span>)}
                </span>
                <span className="ml-auto text-[12px] text-faint">{ago(t.lastUsedAt)}</span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Revogar o acesso de ${t.name}? O agente perde a conexão na hora.`)) return;
                    start(async () => {
                      await revokeAgentTokenAction(t.id);
                      toast.success(`Acesso de ${t.name} revogado`);
                    });
                  }}
                >
                  <ShieldOff /> Revogar
                </Button>
              </li>
            ))}
          </ul>
        )}
        {revoked.length > 0 && <p className="text-[12px] text-faint">Revogados: {revoked.map((t) => t.name).join(", ")}</p>}
      </div>
    </Card>
  );
}
