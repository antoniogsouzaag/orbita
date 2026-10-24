import { EarthBlaze } from "@/components/ui/earth-blaze";
import { securityState } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const s = await securityState(true).catch(() => ({ totpEnabled: false }));
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      <div aria-hidden className="login-drift absolute inset-0"><EarthBlaze interactive={false} starCount={900} style={{ position: "absolute", inset: 0, height: "100%", aspectRatio: "auto" }} /></div><div className="pointer-events-none absolute inset-0 bg-black/15" />
      <LoginForm next={next ?? "/"} totp={s.totpEnabled} />
    </div>
  );
}
