/**
 * Unit tests for the `updatesCallout` Alpine.data() module (home page's
 * "Recent Updates" expand/collapse).
 */
import { describe, expect, test } from "bun:test";
import { updatesCallout } from "../../src/client/updates-callout";

describe("updatesCallout()", () => {
  test("starts collapsed", () => {
    expect(updatesCallout().expanded).toBe(false);
  });

  test("toggle() flips expanded back and forth", () => {
    const data = updatesCallout();
    data.toggle();
    expect(data.expanded).toBe(true);
    data.toggle();
    expect(data.expanded).toBe(false);
  });

  test("each instance has independent state", () => {
    const a = updatesCallout();
    const b = updatesCallout();
    a.toggle();
    expect(a.expanded).toBe(true);
    expect(b.expanded).toBe(false);
  });
});
