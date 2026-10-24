import "server-only";
import { composeTeam, type TeamMember } from "@/lib/team";
import { agentAvatarUrls } from "./agent-avatars";
import { agentActivitySummary, listAgentTokens, recentActivity } from "./agents";
import { agents } from "./ops";

type Inputs = {
  tokens?: Awaited<ReturnType<typeof listAgentTokens>>;
  activity?: Awaited<ReturnType<typeof recentActivity>>;
  summary?: Awaited<ReturnType<typeof agentActivitySummary>>;
};

/** Carrega registro do vault, acessos MCP, atividade e fotos e monta o time (ver composeTeam). */
export async function buildTeam(input: Inputs = {}): Promise<TeamMember[]> {
  const [registry, tokens, activity, summary, avatars] = await Promise.all([
    agents().catch(() => []),
    input.tokens ?? listAgentTokens(),
    input.activity ?? recentActivity(60),
    input.summary ?? agentActivitySummary(),
    agentAvatarUrls().catch(() => new Map<string, string>()),
  ]);
  return composeTeam({ registry, tokens, activity, summary, avatars });
}
