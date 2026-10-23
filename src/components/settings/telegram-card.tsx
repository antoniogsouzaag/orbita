"use client";

import { Send } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { sendBriefNow } from "@/app/actions/core";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";

export function TelegramCard({ configured, cron }: { configured: boolean; cron: boolean }) {
  const [pending, start] = React.useTransition();
  return (
    <Card>
      <CardHeader icon={<Send />} title="Telegram" meta={configured ? "conectado" : "não configurado"} />
      <div className="space-y-3 px-5 pb-5 text-[13px] text-muted">
        <p>A Órbita envia direto pelo bot (sem passar pelo n8n): o <b className="text-fg">bom dia às 7h</b> com agenda, tarefas pessoais e da empresa, pedidos dos agentes e operação, e um aviso na hora quando um agente pedir algo. Os alertas dos monitores continuam saindo do n8n, de forma independente.</p>
        {configured ? (
          <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await sendBriefNow(); if (r.ok) toast.success("Resumo enviado no Telegram"); else toast.error(r.error ?? "Falhou"); })}>
            <Send /> Enviar o resumo agora
          </Button>
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px]">Na Vercel, adicione <code>TELEGRAM_BOT_TOKEN</code> (o token do bot “avisos aglabs”, no @BotFather) e <code>TELEGRAM_CHAT_ID</code>. Depois publique de novo.</p>
        )}
        {!cron && <p className="text-[12px] text-warning">Falta <code>CRON_SECRET</code> na Vercel para o envio automático das 7h.</p>}
      </div>
    </Card>
  );
}
