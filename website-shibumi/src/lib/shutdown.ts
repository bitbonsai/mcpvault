/**
 * Bounded-drain shutdown helper.
 *
 * `server.stop()` (no argument) stops accepting new connections but returns
 * immediately; it does not report when in-flight requests actually finish,
 * and left alone a slow/stuck request can block the process from ever
 * exiting. Polling a caller-supplied in-flight counter with a hard deadline
 * gives the entrypoint a bounded wait, after which it must force-close via
 * `server.stop(true)` rather than hang forever.
 */

export interface DrainResult {
  /** True if `getPending()` reached 0 before the deadline. */
  drained: boolean;
  /** How many polls were needed (0 if already drained on the first check). */
  polls: number;
}

/**
 * Polls `getPending()` until it returns 0 or `timeoutMs` elapses.
 * Pure aside from timing, so tests can use a synthetic counter and a short
 * timeout instead of a real server and real requests.
 */
export async function waitForDrain(
  getPending: () => number,
  timeoutMs: number,
  pollIntervalMs = 25,
): Promise<DrainResult> {
  const deadline = Date.now() + timeoutMs;
  let polls = 0;
  while (getPending() > 0) {
    if (Date.now() >= deadline) {
      return { drained: false, polls };
    }
    await Bun.sleep(Math.min(pollIntervalMs, Math.max(0, deadline - Date.now())));
    polls++;
  }
  return { drained: true, polls };
}
