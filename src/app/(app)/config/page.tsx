import { Database, Download, Settings } from "lucide-react";
import { PreferencesCard } from "@/components/settings/preferences-card";
import { IphoneCard } from "@/components/settings/iphone-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { SecurityCard } from "@/components/settings/security-card";
import { headers } from "next/headers";
import { captureTokenInfo } from "@/server/capture";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { securityState } from "@/lib/auth";
import { avatarVersion, getSettings } from "@/server/settings";

export const metadata = { title: "Configurações" };

export default async function Page() {
  const [settings, sec, avatarV, capture, h] = await Promise.all([getSettings(), securityState(true), avatarVersion(), captureTokenInfo(), headers()]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "orbita";
  const captureUrl = `${host.startsWith("localhost") ? "http" : "https"}://${host}/api/capture`;
  const passwordMode = sec.passwordHash ? "app" : process.env.ORBITA_PASSWORD_HASH ? "hash" : process.env.ORBITA_PASSWORD ? "plain" : "none";
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 sm:px-6">
      <PageHeader icon={<Settings />} title="Configurações" />
      <PreferencesCard avatar={avatarV ? `/api/avatar?v=${avatarV}` : null} name={settings.name} accent={settings.accent} focusMinutes={settings.focusMinutes} />
      <SecurityCard totpEnabled={sec.totpEnabled} envTotp={Boolean(process.env.ORBITA_TOTP_SECRET)} passwordMode={passwordMode} />
      <IphoneCard url={captureUrl} info={capture} />
      <TelegramCard configured={Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)} cron={Boolean(process.env.CRON_SECRET)} />
      <Card>
        <CardHeader icon={<Database />} title="Seus dados" />
        <div className="space-y-3 px-5 pb-5 text-[13px] text-muted">
          <p>Banco: {process.env.DATABASE_URL ? (/neon\.tech/.test(process.env.DATABASE_URL) ? "Neon (Postgres serverless)" : "Postgres") : "local (PGlite em .data/)"}. O vault continua no GitHub, com histórico em cada commit.</p>
          <Button size="sm" variant="secondary" asChild><a href="/api/export"><Download /> Baixar backup completo (JSON)</a></Button>
        </div>
      </Card>
    </div>
  );
}
