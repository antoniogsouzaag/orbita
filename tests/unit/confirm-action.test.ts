// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { ConfirmationHost, confirmAction } from "@/components/ui/confirm-action";

it("aguarda confirmação explícita e cancela sem executar a ação", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => { root.render(createElement(ConfirmationHost)); });
  let accepted!: Promise<boolean>;
  await act(async () => { accepted = confirmAction("Excluir somente o exemplo?"); });
  expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Excluir somente o exemplo?");
  const button = (label: string) => [...document.querySelectorAll("button")].find(element => element.textContent === label)!;
  expect(document.activeElement).toBe(button("Cancelar"));
  await act(async () => { button("Cancelar").click(); });
  expect(await accepted).toBe(false);
  await act(async () => { accepted = confirmAction("Continuar?"); });
  await act(async () => { button("Confirmar").click(); });
  expect(await accepted).toBe(true);
  await act(async () => { root.unmount(); });
  container.remove();
});
