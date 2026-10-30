import { expect, it } from "vitest";
import { isActive, navigationHref } from "@/components/shell/nav";
it("negócios seleciona somente sua seção sem ativar o início da empresa", () => {
  expect(isActive("/empresa/negocios/barberias", "/empresa")).toBe(false);
  expect(isActive("/empresa/negocios/barberias", "/empresa/negocios")).toBe(true);
  expect(isActive("/empresa", "/empresa")).toBe(true);
  expect(isActive("/integracoes/mcp", "/integracoes")).toBe(true);
});

it("ORBE fica selecionada nos dois espaços", () => {
  expect(isActive("/ia", navigationHref("/ia", "pessoal"), null)).toBe(true);
  expect(isActive("/ia", navigationHref("/ia", "empresa"), "empresa")).toBe(true);
  expect(isActive("/ia", navigationHref("/ia", "pessoal"), "empresa")).toBe(false);
});
