import { describe, expect, test } from "bun:test";
import { waitForDrain } from "../../src/lib/shutdown";

describe("waitForDrain", () => {
  test("resolves immediately, with zero polls, when already at zero", async () => {
    const result = await waitForDrain(() => 0, 1_000);
    expect(result).toEqual({ drained: true, polls: 0 });
  });

  test("drains once the pending count reaches zero, before the deadline", async () => {
    let pending = 3;
    // Simulate three in-flight requests finishing one at a time.
    const timer = setInterval(() => {
      if (pending > 0) pending--;
    }, 10);
    try {
      const result = await waitForDrain(() => pending, 2_000, 5);
      expect(result.drained).toBe(true);
      expect(pending).toBe(0);
    } finally {
      clearInterval(timer);
    }
  });

  test("times out and reports undrained when pending never reaches zero", async () => {
    const start = Date.now();
    const result = await waitForDrain(() => 1, 100, 10);
    const elapsed = Date.now() - start;
    expect(result.drained).toBe(false);
    // Must not overshoot the bound by more than a little poll-interval slack.
    expect(elapsed).toBeLessThan(250);
  });
});
