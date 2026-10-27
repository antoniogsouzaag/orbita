import { oauthMetadata, oauthHeaders } from "@/server/mcp-oauth";
export async function GET() { return Response.json(oauthMetadata(), { headers: oauthHeaders }); }
