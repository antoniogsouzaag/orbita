export type OrbitPoint = { x: number; y: number };

/** Angles stay above and to the left of the dock's rightmost button. */
export function orbitPositions(count: number): OrbitPoint[] {
  const arc = (size: number, radius: number, start: number, end: number) =>
    Array.from({ length: size }, (_, index) => {
      const angle = (size === 1 ? (start + end) / 2 : start + (end - start) * index / (size - 1)) * Math.PI / 180;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    });
  if (count <= 0) return [];
  const positions = count <= 5 ? arc(count, 164, -176, -90) : [...arc(count - 5, 120, -174, -90), ...arc(5, 202, -178, -90)];
  // A fileira inferior fica acima do dock, incluindo o alvo mais à esquerda.
  return positions.map(point => ({ ...point, y: point.y - 64 }));
}

/** Release must land on a bubble; dragging through an empty part never activates it. */
export function orbitTarget(point: OrbitPoint, targets: OrbitPoint[], radius = 32): number | null {
  if (Math.hypot(point.x, point.y) < 44) return null;
  let nearest: number | null = null;
  let distance = radius;
  targets.forEach((target, index) => {
    const current = Math.hypot(point.x - target.x, point.y - target.y);
    if (current <= distance) { nearest = index; distance = current; }
  });
  return nearest;
}

type ShortcutEvent = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "isComposing" | "repeat" | "defaultPrevented">;
export function isSidebarShortcut(event: ShortcutEvent, editing: boolean) {
  return event.key === "'" && !editing && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && !event.isComposing && !event.repeat && !event.defaultPrevented;
}

export function isEditingTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], .cm-editor, .ProseMirror');
}
