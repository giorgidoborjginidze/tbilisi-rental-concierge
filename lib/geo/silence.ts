// A tracker that stops talking is the real theft scenario: unplugged,
// jammed, or out of coverage. Its last position then says nothing about
// where the car is now, so a stale fix must never read as "inside the red
// line", and the owner is told once the silence has lasted long enough.
//
// Pure and client-safe.

/** Minutes without an accepted ping after which a tracker counts as silent. */
export const TRACKER_SILENT_MINUTES = 30;

const MINUTE_MS = 60_000;

/** Has the tracker been silent for longer than `minutes`? Never-pinged is not "silent". */
export function isTrackerSilent(
  lastPingAt: Date | null | undefined,
  now: Date,
  minutes: number = TRACKER_SILENT_MINUTES,
): boolean {
  if (!lastPingAt) return false;
  return now.getTime() - lastPingAt.getTime() > minutes * MINUTE_MS;
}

/** A silence as a count and a unit: 45 min, 3 h, 2 d. */
export function silenceSpan(
  lastPingAt: Date,
  now: Date,
): { n: number; unit: "min" | "hours" | "days" } {
  const minutes = Math.max(0, Math.floor((now.getTime() - lastPingAt.getTime()) / MINUTE_MS));
  if (minutes < 60) return { n: minutes, unit: "min" };
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return { n: hours, unit: "hours" };
  return { n: Math.floor(hours / 24), unit: "days" };
}

/** Dedupe key for one silence episode: the device and the fix it went quiet after. */
export const silenceKey = (deviceId: string, lastPingAt: Date) =>
  `${deviceId}|${lastPingAt.toISOString()}`;
