"use client";

import { ArrowRight, KeyRound, Lock } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ next, totp }: { next: string; totp: boolean }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="card relative w-full max-w-sm p-7 shadow-soft">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo className="size-11" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Órbita</h1>
          <p className="text-[13px] text-muted">Sua central operacional</p>
        </div>
      </div>
      <input type="hidden" name="next" value={next} />
      <div className="relative">
        <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input name="password" type="password" placeholder="Senha" autoFocus required autoComplete="current-password" className="pl-9" />
      </div>
      {totp && (
        <div className="relative mt-2">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" placeholder="Código do autenticador" required className="pl-9 tracking-widest" />
        </div>
      )}
      {state?.error && <p className="mt-2 text-[13px] text-danger">{state.error}</p>}
      <Button type="submit" variant="primary" className="mt-4 w-full" size="lg" disabled={pending}>
        Entrar <ArrowRight />
      </Button>
    </form>
  );
}
