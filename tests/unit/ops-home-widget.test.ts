// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OpsWidget } from "@/components/home/widgets";

const summary = { configured: true, total: 0, up: 0, down: [], checkedAt: "2026-11-27T02:00:00Z" };
let host: HTMLDivElement;
let root: Root;
let probe: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  probe = vi.fn();
  vi.stubGlobal("fetch", probe);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function renderWidget(response: unknown) {
  probe.mockResolvedValue(Response.json(response));
  await act(async () => root.render(createElement(OpsWidget)));
  expect(probe).toHaveBeenCalledExactlyOnceWith("/api/ops/status?summary=1");
  expect(host.querySelector('a[href="/operacao"]')).not.toBeNull();
}

it("não sinaliza sucesso quando não há endereços", async () => {
  await renderWidget(summary);
  expect(host.textContent).toContain("Nenhum endereço configurado");
  expect(host.textContent).not.toContain("0/0");
  expect(host.querySelector(".text-success")).toBeNull();
});

it("apresenta resposta e falha como resultados do teste pontual", async () => {
  await renderWidget({ ...summary, total: 2, up: 1, down: [{ name: "Site", url: "https://example.com", group: "P1" }] });
  expect(host.textContent).toContain("1/2");
  expect(host.textContent).toContain("responderam ao teste");
  expect(host.textContent).toContain("Falharam no teste:");
  expect(host.textContent).toContain("Site");
  expect(host.textContent).toContain("estado dos monitores");
  expect(host.textContent).not.toContain("no ar");
  expect(host.querySelector(".text-warning")).not.toBeNull();
  expect(host.querySelector(".text-danger")).toBeNull();
});

it("distingue catálogo indisponível de catálogo vazio", async () => {
  await renderWidget({ ...summary, configured: false });
  expect(host.textContent).toContain("Conecte o vault");
  expect(host.textContent).not.toContain("Nenhum endereço configurado");
});
