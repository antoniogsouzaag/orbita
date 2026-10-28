/** Um resultado só é atual enquanto a fonte envia batidas e o próprio alvo foi verificado na janela do monitor. */
export function availabilitySnapshot<T extends { source: string; checkedAt: Date; ok: boolean }>(
  status: T[], monitors: { source: string; silent: boolean; everyMinutes: number }[], now: number,
) {
  const bySource = new Map(monitors.map((monitor) => [monitor.source, monitor]));
  const current: T[] = [];
  const stale: T[] = [];
  for (const item of status) {
    const monitor = bySource.get(item.source);
    const age = now - item.checkedAt.getTime();
    const limit = monitor ? (monitor.everyMinutes * 2.5 + 2) * 60_000 : 0;
    if (!monitor || monitor.silent || !Number.isFinite(age) || age < 0 || age > limit) stale.push(item);
    else current.push(item);
  }
  return { current, stale, down: current.filter((item) => !item.ok), up: current.filter((item) => item.ok) };
}
