// @vitest-environment jsdom
import * as React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { OpenclawIntegration } from "@/components/agents/openclaw-integration";
import { sendOpenclaw } from "@/app/actions/openclaw";

vi.mock("@/app/actions/openclaw", () => ({ sendOpenclaw: vi.fn(), refreshOpenclaw: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/ui/dialog", () => ({ Dialog: ({open,children}:{open:boolean;children:React.ReactNode}) => open ? children : null, DialogContent: ({children}:{children:React.ReactNode}) => React.createElement("section", null, children) }));

it("oferece um campo e encaminha a mensagem ao Tom como pedido de análise", async () => {
 Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
 const host = document.createElement("div"); document.body.append(host);
 const root = createRoot(host);
 vi.mocked(sendOpenclaw).mockResolvedValue({ id: "fixture", status: "accepted", detail: "Recebido" } as Awaited<ReturnType<typeof sendOpenclaw>>);
 try {
  await act(async () => root.render(React.createElement(OpenclawIntegration, { config: { enabled: true, endpointConfigured: true, tokenConfigured: true }, initial: [], variant: "action" })));
  expect([...host.querySelectorAll("button")].map(b => b.textContent)).toEqual(["Mensagem"]);
  await act(async () => host.querySelector("button")!.click());
  expect(host.querySelectorAll("textarea")).toHaveLength(1);
  expect(host.textContent).not.toContain("Diagnóstico do VPS-02");
  const field = host.querySelector("textarea")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "Analise a operação"); field.dispatchEvent(new Event("input", { bubbles: true })); });
  await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  expect(sendOpenclaw).toHaveBeenCalledExactlyOnceWith({ action: "request.tom", params: { texto: "Analise a operação" } });
 } finally { await act(async () => root.unmount()); host.remove(); }
});
