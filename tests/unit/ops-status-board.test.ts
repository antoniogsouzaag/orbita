// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StatusBoard, type BoardItem } from "@/components/ops/status-board";

// Use the inline label in tests instead of requiring a Radix portal and delayed hover.
vi.mock("@/components/ui/misc", () => ({
  Tooltip: ({ children, content }: { children: ReactNode; content: string }) => createElement("span", { title: content }, children),
}));

const url = "https://example.com";
const monitorTime = "2026-11-24T01:00:00.000Z";
const stateSince = "2026-11-24T00:00:00.000Z";
const manualTime = "2026-11-24T02:00:00.000Z";
const official: BoardItem = {
  url, name: "Aplicativo", group: "P1", ok: true, status: 200, error: null,
  ms: 12, checkedAt: monitorTime, since: stateSince, source: "Monitor n8n",
};
const manual = { url, name: "Aplicativo", ok: false, status: 503, ms: 42, checkedAt: manualTime };

let host: HTMLDivElement;
let root: Root;
let fetchProbe: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetchProbe = vi.fn();
  vi.stubGlobal("fetch", fetchProbe);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderBoard(initial: BoardItem[] = [official]) {
  await act(async () => root.render(createElement(StatusBoard, { initial, groupOrder: ["P1"] })));
}
async function checkNow() {
  await act(async () => host.querySelector("button")!.click());
  expect(fetchProbe).toHaveBeenLastCalledWith("/api/ops/status?force=1");
  expect(host.querySelector("button")!.disabled).toBe(false);
}
function probeResult() {
  return host.querySelector('[aria-label="Verificação pontual da Órbita"]')!;
}

it("não transforma teste pontual com falha em queda confirmada nem muda o horário do estado n8n", async () => {
  fetchProbe.mockResolvedValue(Response.json({ configured: true, total: 1, results: [manual] }));
  await renderBoard();
  const before = host.querySelector("a")!.outerHTML;
  const titleBefore = host.querySelector("a")!.parentElement!.getAttribute("title");
  await checkNow();
  expect(host.textContent).toContain("1/1 no ar");
  expect(host.querySelector("a")!.outerHTML).toBe(before);
  expect(titleBefore).toContain("Monitor n8n");
  expect(titleBefore).toContain("neste estado desde");
  expect(host.querySelector("a")!.parentElement!.getAttribute("title")).toBe(titleBefore);
  expect(probeResult().textContent).toContain("Falhou no teste · HTTP 503");
  expect(probeResult().textContent).not.toContain("Fora do ar");
  expect(probeResult().querySelector("time")!.dateTime).toBe(manualTime);
});

it("não mascara queda confirmada, instabilidade ou dado desatualizado quando o teste pontual responde", async () => {
  const down = { ...official, ok: false, status: 503 };
  const unstable = { ...official, url: "https://unstable.example.com", unstable: true, status: 503 };
  const stale = { ...official, url: "https://stale.example.com", stale: true };
  fetchProbe.mockResolvedValue(Response.json({
    configured: true, total: 3, results: [down, unstable, stale].map(row => ({ ...manual, url: row.url, ok: true, status: 200 })),
  }));
  await renderBoard([down, unstable, stale]);
  const before = [...host.querySelectorAll("a")].map(link => link.getAttribute("aria-label"));
  await checkNow();
  expect([...host.querySelectorAll("a")].map(link => link.getAttribute("aria-label"))).toEqual(before);
  expect(before).toEqual([expect.stringContaining("Fora do ar"), expect.stringContaining("Instável"), expect.stringContaining("Sem verificação recente")]);
  expect(probeResult().querySelectorAll("li")).toHaveLength(3);
  expect(probeResult().textContent).toContain("Respondeu ao teste · HTTP 200");
});

it("exibe retorno parcial e o teste de alvos ainda sem registro no n8n", async () => {
  fetchProbe.mockResolvedValue(Response.json({ configured: true, total: 2, results: [manual] }));
  await renderBoard([]);
  await checkNow();
  expect(host.textContent).toContain("Nenhum resultado recebido do n8n ainda");
  expect(probeResult().textContent).toContain("Resultado parcial: 1 de 2 endereços retornaram");
  expect(probeResult().textContent).toContain("Aplicativo");
  expect(host.querySelectorAll("a")).toHaveLength(0);
});

it.each([
  ["lista indisponível", false, "Não foi possível carregar a lista"],
  ["lista vazia", true, "Nenhum endereço configurado"],
])("distingue %s de um resultado", async (_, configured, expected) => {
  fetchProbe.mockResolvedValue(Response.json({ configured, total: 0, results: [] }));
  await renderBoard();
  await checkNow();
  expect(probeResult().textContent).toContain(expected);
  expect(probeResult().querySelectorAll("li")).toHaveLength(0);
  expect(host.textContent).toContain("1/1 no ar");
});

it.each(["HTTP", "JSON", "schema", "rede"])("permite tentar novamente após erro de %s", async (failure) => {
  if (failure === "rede") fetchProbe.mockRejectedValueOnce(new Error("offline"));
  else if (failure === "HTTP") fetchProbe.mockResolvedValueOnce(new Response(null, { status: 401 }));
  else if (failure === "JSON") fetchProbe.mockResolvedValueOnce(new Response("não é JSON"));
  else fetchProbe.mockResolvedValueOnce(Response.json({ configured: true, results: [{}] }));

  fetchProbe.mockResolvedValueOnce(Response.json({ configured: true, total: 1, results: [manual] }));
  await renderBoard();
  await checkNow();
  expect(probeResult().textContent).toContain("Não foi possível concluir a verificação");
  expect(host.textContent).toContain("1/1 no ar");
  await checkNow();
  expect(probeResult().textContent).toContain("Falhou no teste");
});
