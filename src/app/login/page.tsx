import { securityState } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await securityState(true).catch(() => ({ totpEnabled: false }));
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_60%)]" />
      <LoginForm next={next ?? "/"} totp={s.totpEnabled} />
    </div>
  );
}
