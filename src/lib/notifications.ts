export type ShellNotification = { id: string; title: string; detail?: string; href: string; tone?: "danger" | "warning" | "info" };

/** Persist only a bounded set of acknowledged IDs, never notification contents. */
export function acknowledgeNotifications(previous: string[], ids: string[]) {
  return [...new Set([...previous, ...ids])].slice(-300);
}
