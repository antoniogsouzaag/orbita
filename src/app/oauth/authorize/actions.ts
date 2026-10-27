"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { OAuthError, authorizationRedirect, authorizeOAuth, parseAuthorization } from "@/server/mcp-oauth";

export async function consentOAuth(query: string, form: FormData) {
  await requireAuth();
  const params = new URLSearchParams(query);
  params.delete("consent_error");
  const auth = await parseAuthorization(params);
  if (form.get("decision") !== "allow") redirect(authorizationRedirect(auth, { error: "access_denied" }));
  let url: string;
  try { url = await authorizeOAuth(auth, form.getAll("scope").map(String)); }
  catch (error) {
    if (!(error instanceof OAuthError) || error.code !== "invalid_scope") throw error;
    params.set("consent_error", "scope");
    redirect(`/oauth/authorize?${params}`);
  }
  revalidatePath("/integracoes/mcp");
  revalidatePath("/agentes");
  redirect(url);
}
