"use client";

import { LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import QRCode from "qrcode";
import * as React from "react";
import { toast } from "sonner";
import { confirmTotp, disableTotp, logoutEverywhere, startTotpSetup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SecurityCard({ totpEnabled, envTotp, passwordMode }: { totpEnabled: boolean; envTotp: boolean; passwordMode: "hash" | "plain" | "none" }) {
  const [setup, setSetup] = React.useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = React.useState("");
  const [enabled, setEnabled] = React.useState(totpEnabled);
  const [pending, start] = React.useTransition();
  return (
    <Card>
      <CardHeader icon={<ShieldCheck />} title="Segurança" />
      <div className="space-y-4 px-5 pb-5 text-[13px]">
        <ul className="space-y-1.5 text-muted">
          <li>• Único usuário (você). Sessão assinada, cookie httpOnly, válida por 30 dias.</li>
          <li>• Senha: {passwordMode === "hash" ? <b className="text-success">guardada como hash (scrypt)</b> : passwordMode === "plain" ? <span className="text-warning">em texto no ambiente — prefira ORBITA_PASSWORD_HASH</span> : <span className="text-danger">não configurada</span>}</li>
          <li>• Bloqueio de 5 min após 5 tentativas erradas.</li>
          <li>• Verificação em duas etapas: {enabled ? <b className="text-success">ativa</b> : <span className="text-warning">desativada</span>}</li>
        </ul>
        {!enabled && !setup && !envTotp && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await startTotpSetup();
                if ("error" in r) return void toast.error(r.error);
                setSetup({ secret: r.secret, qr: await QRCode.toDataURL(r.uri, { margin: 1, width: 200 }) });
              })
            }
          >
            <ShieldCheck /> Ativar verificação em duas etapas
          </Button>
        )}
        {setup && (
          <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code do autenticador" className="size-40 rounded-lg bg-white p-1" />
            <div className="min-w-[200px] flex-1 space-y-2">
              <p>Escaneie no Google Authenticator, 1Password, Authy ou similar. Ou digite a chave:</p>
              <code className="block break-all rounded-lg bg-surface-2 px-2 py-1 font-mono text-[12px]">{setup.secret}</code>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const r = await confirmTotp(code);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success("Verificação em duas etapas ativada. Outros dispositivos precisarão entrar de novo.");
                    setEnabled(true);
                    setSetup(null);
                    setCode("");
                  });
                }}
                className="flex gap-2"
              >
                <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Código de 6 dígitos" className="h-9 w-40 tracking-widest" />
                <Button size="sm" variant="primary" disabled={pending}>Confirmar</Button>
              </form>
            </div>
          </div>
        )}
        {enabled && !envTotp && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await disableTotp(code);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Verificação em duas etapas desativada");
                setEnabled(false);
                setCode("");
              });
            }}
            className="flex flex-wrap gap-2"
          >
            <Input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="Código atual" className="h-9 w-36 tracking-widest" />
            <Button size="sm" variant="danger" disabled={pending}><ShieldOff /> Desativar 2FA</Button>
          </form>
        )}
        {envTotp && <p className="text-[12px] text-faint">2FA definido pela variável ORBITA_TOTP_SECRET.</p>}
        <Button size="sm" variant="secondary" onClick={() => start(async () => { if (confirm("Sair de todos os dispositivos, inclusive este?")) await logoutEverywhere(); })}>
          <LogOut /> Sair de todos os dispositivos
        </Button>
      </div>
    </Card>
  );
}
