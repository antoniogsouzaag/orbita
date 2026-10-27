import { exchangeOAuthToken, oauthErrorResponse, oauthHeaders, readOAuthForm } from "@/server/mcp-oauth";
export async function POST(req: Request) {
  try { return Response.json(await exchangeOAuthToken(await readOAuthForm(req)), { headers: oauthHeaders }); }
  catch (error) { return oauthErrorResponse(error); }
}
