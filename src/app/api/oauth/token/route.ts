import { exchangeOAuthToken, OAuthError, oauthErrorResponse, oauthHeaders, readOAuthForm } from "@/server/mcp-oauth";
export async function POST(req: Request) {
  let status = 500;
  let code = "internal_error";
  try {
    const tokens = await exchangeOAuthToken(await readOAuthForm(req));
    status = 200;
    code = "ok";
    return Response.json(tokens, { headers: oauthHeaders });
  } catch (error) {
    if (error instanceof OAuthError) { status = error.status; code = error.code; }
    return oauthErrorResponse(error);
  } finally {
    console.info("[mcp-oauth-token]", JSON.stringify({ status, code }));
  }
}
