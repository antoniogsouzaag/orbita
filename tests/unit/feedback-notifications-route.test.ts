import { beforeEach, expect, it, vi } from "vitest";
const sources = vi.hoisted(() => ({ auth: vi.fn(), local: vi.fn(), feedback: vi.fn() }));
vi.mock("@/lib/auth", () => ({ isAuthenticated: sources.auth }));
vi.mock("@/server/notifications", () => ({ loadNotifications: sources.local }));
vi.mock("@/server/crm-feedback", () => ({ feedbackForNotifications: sources.feedback }));
import { GET } from "@/app/api/notifications/route";

beforeEach(() => {
  vi.resetAllMocks();
  sources.auth.mockResolvedValue(true);
  sources.local.mockResolvedValue([{ id: "local", title: "Tarefa", href: "/tarefas" }]);
});
it("recusa acesso sem sessão antes de consultar fontes", async () => {
  sources.auth.mockResolvedValue(false);
  expect((await GET(new Request("https://orb.test/api/notifications"))).status).toBe(401);
  expect(sources.local).not.toHaveBeenCalled();
  expect(sources.feedback).not.toHaveBeenCalled();
});
it("não consulta feedback empresarial no espaço pessoal", async () => {
  const response = await GET(new Request("https://orb.test/api/notifications"));
  expect((await response.json()).items).toHaveLength(1);
  expect(sources.feedback).not.toHaveBeenCalled();
});
it("inclui feedback novo com identidade estável e preserva avisos locais", async () => {
  sources.feedback.mockResolvedValue({ status: "ok", items: [
    { id: "f1", produto: "members", mensagem: "Ajuda", status: "novo" },
    { id: "f2", produto: "mecard", mensagem: "Resolvido", status: "resolvido" },
  ] });
  const response = await GET(new Request("https://orb.test/api/notifications?escopo=empresa"));
  expect((await response.json()).items).toEqual([
    expect.objectContaining({ id: "feedback-f1", href: "/empresa/feedback?produto=members&status=novo" }),
    expect.objectContaining({ id: "local" }),
  ]);
});
it("mantém os avisos locais e informa cobertura incompleta quando o CRM falha", async () => {
  sources.feedback.mockResolvedValue({ status: "unavailable", items: [] });
  const response = await GET(new Request("https://orb.test/api/notifications?escopo=empresa"));
  expect(await response.json()).toMatchObject({ feedbackUnavailable: true, items: [{ id: "local" }] });
});
