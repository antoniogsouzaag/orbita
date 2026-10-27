import { OAuthError, oauthErrorResponse, oauthHeaders, registerOAuthClient } from "@/server/mcp-oauth";
export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (body.length > 16384) throw new OAuthError("invalid_client_metadata", "Requisição longa demais.");
    let input: unknown;
    try { input = JSON.parse(body); } catch { throw new OAuthError("invalid_client_metadata", "JSON inválido."); }
    return Response.json(await registerOAuthClient(input), { status: 201, headers: oauthHeaders });
  } catch (error) { return oauthErrorResponse(error); }
}
