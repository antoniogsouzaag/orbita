import { describe, expect, it, vi } from "vitest";
const { requireAuth, saveProposalReply } = vi.hoisted(() => ({ requireAuth: vi.fn(), saveProposalReply: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/proposals", async importOriginal => ({ ...await importOriginal<object>(), saveProposalReply }));
import { respondToProposal } from "@/app/actions/proposals";

describe("resposta exige sessão do proprietário", () => {
  it("recusa antes de validar origem ou tocar dados", async () => {
    requireAuth.mockRejectedValue(Error("unauthorized"));
    await expect(respondToProposal({})).rejects.toThrow("unauthorized");
    expect(saveProposalReply).not.toHaveBeenCalled();
  });
});
