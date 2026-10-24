import { describe, expect, it } from "vitest";
import { isSidebarShortcut, isSpaceShortcut, orbitPositions, orbitTarget } from "@/components/shell/interactions";
import { isActive, navigationHref, spaceOf } from "@/components/shell/nav";

describe("menu orbital", () => {
  it("mantém todos os alvos acima e à esquerda, separados e dentro do mobile", () => {
    for (const count of [5, 9]) {
      const positions = orbitPositions(count);
      expect(positions).toHaveLength(count);
      for (const [index, point] of positions.entries()) {
        expect(point.x).toBeLessThanOrEqual(0.000001);
        expect(point.y + 25).toBeLessThan(-44);
        expect(280 + point.x - 25).toBeGreaterThan(12);
        for (const other of positions.slice(index + 1)) expect(Math.hypot(point.x - other.x, point.y - other.y)).toBeGreaterThan(50);
      }
    }
  });
  it("ativa somente um alvo próximo na soltura e cancela no centro ou fora das bolhas", () => {
    const points = orbitPositions(9);
    points.forEach((point, index) => expect(orbitTarget(point, points)).toBe(index));
    expect(orbitTarget({ x: 0, y: 0 }, points)).toBeNull();
    expect(orbitTarget({ x: -25, y: -25 }, points)).toBeNull();
    expect(orbitTarget({ x: -300, y: -300 }, points)).toBeNull();
    expect(orbitTarget({ x: points[0].x - 31, y: points[0].y }, points)).toBe(0);
    expect(orbitTarget({ x: points[0].x - 33, y: points[0].y }, points)).toBeNull();
  });
});

describe("atalho da barra lateral", () => {
  const event = { key: "'", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, repeat: false, defaultPrevented: false };
  it("abre com apóstrofo e preserva digitação, composição e comandos do navegador", () => {
    expect(isSidebarShortcut(event, false)).toBe(true);
    expect(isSidebarShortcut(event, true)).toBe(false);
    for (const flag of ["ctrlKey", "metaKey", "altKey", "shiftKey", "isComposing", "repeat", "defaultPrevented"] as const) expect(isSidebarShortcut({ ...event, [flag]: true }, false)).toBe(false);
    expect(isSidebarShortcut({ ...event, key: '"' }, false)).toBe(false);
  });
});

describe("navegação entre os espaços", () => {
  it("mantém tarefas, projetos, kanban e foco no escopo explícito", () => {
    for (const path of ["/tarefas", "/projetos", "/kanban", "/foco"]) {
      expect(spaceOf(path)).toBe("pessoal");
      expect(spaceOf(path, "empresa")).toBe("empresa");
      expect(isActive(path, path, "empresa")).toBe(false);
      expect(isActive(path, `${path}?escopo=empresa`, "empresa")).toBe(true);
      expect(isActive(path, `${path}?escopo=empresa`)).toBe(false);
    }
  });
  it("preserva o contexto da IA e de detalhes de projeto", () => {
    expect(navigationHref("/ia", "empresa")).toBe("/ia?escopo=empresa");
    expect(navigationHref("/ia", "pessoal")).toBe("/ia");
    expect(spaceOf("/projetos/qualquer-id", "empresa")).toBe("empresa");
    expect(spaceOf("/metas", "empresa")).toBe("empresa");
  });

});

describe("alternância de espaço pelo teclado", () => {
  const event = { key: "Tab", shiftKey: true, ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false, defaultPrevented: false };
  it("preserva edição, foco em modal, composição e atalhos do navegador", () => {
    expect(isSpaceShortcut(event, false, false)).toBe(true);
    expect(isSpaceShortcut(event, true, false)).toBe(false);
    expect(isSpaceShortcut(event, false, true)).toBe(false);
    expect(isSpaceShortcut({ ...event, shiftKey: false }, false, false)).toBe(false);
    for (const flag of ["ctrlKey", "metaKey", "altKey", "isComposing", "repeat", "defaultPrevented"] as const) expect(isSpaceShortcut({ ...event, [flag]: true }, false, false)).toBe(false);
  });
});
