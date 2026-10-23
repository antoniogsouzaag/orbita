"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, passwordMatches } from "@/lib/auth";

const attempts = new Map<string, { n: number; until: number }>();

export async function login(_: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const key = "owner";
  const a = attempts.get(key);
  if (a && a.until > Date.now()) return { error: "Muitas tentativas. Aguarde um minuto." };
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) {
    const n = (a?.n ?? 0) + 1;
    attempts.set(key, { n, until: n >= 5 ? Date.now() + 60_000 : 0 });
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Senha incorreta." };
  }
  attempts.delete(key);
  await createSession();
  const next = String(formData.get("next") ?? "/");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
