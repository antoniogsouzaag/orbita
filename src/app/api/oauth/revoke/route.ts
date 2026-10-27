import { revokeOAuthToken, oauthErrorResponse, oauthHeaders, readOAuthForm } from "@/server/mcp-oauth";
export async function POST(req: Request) {
  try {
    await revokeOAuthToken(await readOAuthForm(req));
    return new Response(null, { status: 200, headers: oauthHeaders });
  } catch (error) { return oauthErrorResponse(error); }
}
