"use client";

import { KeyRound, ShieldOff, Smartphone } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { generateCaptureToken, revokeCaptureTokenAction } from "@/app/actions/core";
import { CopyButton } from "@/components/ops/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

export function IphoneCard({ url, info }: { url: string; info: { prefix: string; createdAt: number; lastUsedAt: number | null } | null }) {
  const [token, setToken] = React.useState<string | null>(null);
  const [active, setActive] = React.useState(Boolean(info));
  const [pending, start] = React.useTransition();
  const header = token ? `Bearer ${token}` : "Bearer cap_…";
  return (
    <Card>
      <CardHeader icon={<Smartphone />} title="iPhone: Atalhos e Siri" />
      <div className="space-y-4 px-5 pb-5 text-[13px] text-muted">
        <p>
          Diga <b className="text-fg">“E aí Siri, Órbita”</b> e fale o que precisa: “comprar café amanhã às 9”, “gastei 32 reais no almoço”, “marca reunião com a Gabi sexta às 15h”, “o que tenho hoje?”. A IA entende, registra e responde em voz alta.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {active && !token && info && <span className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-[12px]">{info.prefix}… · {info.lastUsedAt ? `usada ${new Date(info.lastUsedAt).toLocaleDateString("pt-BR")}` : "ainda não usada"}</span>}
          <Button
            size="sm"
            variant={active ? "secondary" : "primary"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (active && !confirm("Gerar outra chave? O atalho atual para de funcionar até você colar a nova.")) return;
                setToken(await generateCaptureToken());
                setActive(true);
              })
            }
          >
            <KeyRound /> {active ? "Gerar nova chave" : "Gerar chave do atalho"}
          </Button>
          {active && (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await revokeCaptureTokenAction(); setActive(false); setToken(null); toast.success("Chave revogada"); })}>
              <ShieldOff /> Revogar
            </Button>
          )}
        </div>
        {token && (
          <div className="space-y-2 rounded-xl border border-warning/40 bg-warning/5 p-3">
            <p className="font-medium text-fg">Copie agora. A chave não aparece de novo.</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[12px] text-fg">{token}</code>
              <CopyButton text={header} label="Copiar cabeçalho" />
            </div>
          </div>
        )}
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>No app <b className="text-fg">Atalhos</b>, crie um atalho chamado <b className="text-fg">Órbita</b>.</li>
          <li>Ação <b className="text-fg">Ditar Texto</b> (idioma Português).</li>
          <li>
            Ação <b className="text-fg">Obter Conteúdo do URL</b>: URL <code className="break-all">{url}</code>, Método <b>POST</b>, Cabeçalho <code>Authorization</code> = <code>{header}</code>, Corpo <b>JSON</b> com o campo <code>texto</code> = Texto Ditado.
          </li>
          <li>Ação <b className="text-fg">Obter Valor do Dicionário</b> com a chave <code>mensagem</code>, depois <b className="text-fg">Falar Texto</b>.</li>
        </ol>
        <p className="text-[12px] text-faint">
          Atalhos sem IA: acrescente no JSON o campo <code>modo</code> com <code>tarefa</code>, <code>nota</code> ou <code>gasto</code> (ex.: “café 12,50 #alimentação”). Bom para um atalho na tela de bloqueio ou no botão de Ação.
        </p>
        <div className="flex justify-end"><CopyButton text={url} label="Copiar URL" /></div>
      </div>
    </Card>
  );
}
