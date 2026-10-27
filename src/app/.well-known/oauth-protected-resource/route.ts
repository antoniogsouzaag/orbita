import { protectedMetadata, oauthHeaders } from "@/server/mcp-oauth";
export async function GET() { return Response.json(protectedMetadata(), { headers: oauthHeaders }); }
