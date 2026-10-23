/** A skipped block only records whole minutes actually elapsed. */
export function focusedMinutes(planned: number, remainingSeconds: number, completed: boolean) {
  return completed ? planned : Math.max(0, Math.min(planned, Math.floor((planned * 60 - remainingSeconds) / 60)));
}
