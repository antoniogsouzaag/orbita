import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/server/social-posts", () => ({ listSocialPosts: vi.fn() }));
vi.mock("@/server/ops", () => ({ n8nInstances: () => [{ url: "https://n8n.example", apiKey: "test-key" }] }));
import { listSocialPosts } from "@/server/social-posts";
import { runDeliveryAudit } from "@/server/social-delivery";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("preserva a etapa da origem e separa agendados aguardando ID de publicados sem ID", async () => {
  const base = { brand: "aglabs", network: "instagram", checks: { keyword: "GUIA" } };
  vi.mocked(listSocialPosts).mockResolvedValue([
    { ...base, id: "scheduled", title: "Amanhã", stage: "agendado" },
    { ...base, id: "published", title: "Publicado", stage: "publicado" },
    { ...base, id: "draft", title: "Rascunho", stage: "rascunho" },
    { ...base, id: "other-brand", title: "Marca", stage: "agendado", brand: "mecard" },
  ] as never);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json({ data: url.includes("QjeiVUFbUvLlYtCx") ? [{ codigo: "GUIA", mensagem: "Material pronto" }] : [] })));
  const result = await runDeliveryAudit();
  expect(result).toMatchObject({ configurado: true, posts_conferidos: 2, agendados_aguardando_media_id: 1, erros: 0,
    problemas: [{ kind: "post_sem_media_id", ref: "published" }] });
});
