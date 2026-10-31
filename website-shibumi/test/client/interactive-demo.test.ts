/**
 * Unit tests for the `interactiveDemo` Alpine.data() module (Phase 3 step
 * 1). This is the one piece of `InteractiveDemo.tsx`'s ported behavior that
 * is genuinely testable server-side, without a browser/Alpine runtime:
 * `interactiveDemo()` returns a plain object whose `selectTab` method can
 * be called directly. `typingDelayMs` is injectable specifically so these
 * tests don't need real 1s timeouts or fake-timer plumbing.
 *
 * `selectTab`'s `$root`/`$nextTick` wiring to the shared height-transition
 * helper (`../../src/client/height-transition`, also used by
 * `terminal.test.ts`) is covered here with a `FakeContainer` standing in
 * for `.demo-window-body` instead of a real DOM -- same reasoning as
 * `fade-in-observer.test.ts`. `growToContent()`/`transitionHeightAcross()`
 * themselves are tested directly in `height-transition.test.ts`; this file
 * only tests that `interactiveDemo()` wires them up correctly.
 * `FakeContainer.offsetHeight` is a getter, not a plain field, deliberately
 * mirroring a real element: it returns the explicit pixel height when
 * `style.height` is set, or `naturalHeight` (the fake's stand-in for
 * actual layout) when it's `""`/`"auto"` -- `growToContent`'s fix depends
 * on that exact real-DOM behavior, so a fake that just stored a static
 * number would pass while hiding the bug it was written to catch.
 */
import { describe, expect, test } from "bun:test";
import type { HeightTransitionContainer } from "../../src/client/height-transition";
import { DEFAULT_TAB, interactiveDemo, TYPING_DELAY_MS } from "../../src/client/interactive-demo";

class FakeContainer implements HeightTransitionContainer {
  style = { height: "" };
  /** Stand-in for the fake's actual layout size -- what a real element's `offsetHeight` would be if its `height` were `auto`. Test-settable to simulate content changes (tab switches, response reveals). */
  naturalHeight: number;
  private transitionendListener: ((event: { propertyName: string }) => void) | undefined;

  constructor(naturalHeight: number) {
    this.naturalHeight = naturalHeight;
  }

  get offsetHeight(): number {
    const explicit = Number.parseFloat(this.style.height);
    return Number.isNaN(explicit) ? this.naturalHeight : explicit;
  }

  addEventListener(_type: "transitionend", listener: (event: { propertyName: string }) => void): void {
    this.transitionendListener = listener;
  }

  /** Test helper: simulate the browser firing `transitionend` after the CSS transition completes. */
  fireTransitionEnd(propertyName: string): void {
    this.transitionendListener?.({ propertyName });
  }
}

describe("interactiveDemo()", () => {
  test("defaults to the first example and not typing", () => {
    const data = interactiveDemo();
    expect(data.activeTab).toBe(DEFAULT_TAB);
    expect(data.activeTab).toBe("patch");
    expect(data.isTyping).toBe(false);
  });

  test("defaults the typing delay to the original component's 1000ms", () => {
    expect(TYPING_DELAY_MS).toBe(1000);
  });

  test("selectTab swaps the active tab immediately and flips isTyping on", () => {
    const data = interactiveDemo(0);
    data.selectTab("write");
    expect(data.activeTab).toBe("write");
    expect(data.isTyping).toBe(true);
  });

  test("selectTab is a no-op when re-selecting the already-active tab", () => {
    const data = interactiveDemo(0);
    data.selectTab("patch");
    expect(data.activeTab).toBe("patch");
    expect(data.isTyping).toBe(false);
  });

  test("isTyping flips back off after the typing delay elapses", async () => {
    const data = interactiveDemo(5);
    data.selectTab("search");
    expect(data.isTyping).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(data.isTyping).toBe(false);
    expect(data.activeTab).toBe("search");
  });

  test("switching tabs again while typing restarts on the new tab", () => {
    const data = interactiveDemo(1000);
    data.selectTab("write");
    expect(data.activeTab).toBe("write");
    data.selectTab("frontmatter");
    expect(data.activeTab).toBe("frontmatter");
    expect(data.isTyping).toBe(true);
  });

  test("selectTab tolerates a missing $root/$nextTick (e.g. calling it directly in a unit test, no Alpine runtime)", () => {
    const data = interactiveDemo(0);
    expect(() => data.selectTab("write")).not.toThrow();
  });

  test("selectTab freezes the pre-mutation height immediately, then grows to the post-mutation content height once $nextTick fires", () => {
    const container = new FakeContainer(120);
    const nextTickCallbacks: Array<() => void> = [];
    const data = interactiveDemo(1000);
    data.$root = { querySelector: () => container };
    data.$nextTick = (callback) => {
      nextTickCallbacks.push(callback);
    };

    data.selectTab("write");

    // Frozen at the pre-mutation height synchronously, before $nextTick ever fires.
    expect(container.style.height).toBe("120px");
    expect(nextTickCallbacks).toHaveLength(1);

    // Simulate Alpine's reactive DOM update (the new panel/response actually
    // rendering) landing before $nextTick's callback runs -- a shrink this
    // time (340 -> 60), the exact direction the original implementation
    // silently failed to animate.
    container.naturalHeight = 60;
    nextTickCallbacks[0]?.();

    expect(container.style.height).toBe("60px");
  });

  test("selectTab is a no-op for the height freeze too when re-selecting the already-active tab", () => {
    const container = new FakeContainer(120);
    const data = interactiveDemo(1000);
    data.$root = { querySelector: () => container };
    data.$nextTick = () => {
      throw new Error("$nextTick should not be scheduled when selectTab no-ops");
    };

    data.selectTab("patch");

    expect(container.style.height).toBe("");
  });

  test("the delayed isTyping-false transition freezes its own pre-mutation height too, not just the initial tab swap", async () => {
    // Regression test: an earlier version only froze the height once, before
    // the immediate tab-swap mutation, and relied on that frozen value still
    // being in place a full typing-delay later when isTyping flips off. In a
    // real browser the first transition's `transitionend` cleanup resets
    // the height back to auto well before the delay elapses, so the second
    // mutation had nothing frozen to transition from and jumped instead of
    // growing -- confirmed against a real browser, not just this fake.
    const container = new FakeContainer(783);
    const nextTickCallbacks: Array<() => void> = [];
    const data = interactiveDemo(5);
    data.$root = { querySelector: () => container };
    data.$nextTick = (callback) => {
      nextTickCallbacks.push(callback);
    };

    data.selectTab("write");
    expect(nextTickCallbacks).toHaveLength(1);

    // Resolve the tab-swap transition (shrinking to the typing-state
    // content's height) and simulate its transitionend cleanup resetting
    // the height back to auto, same as a real browser would.
    container.naturalHeight = 176;
    nextTickCallbacks.shift()?.();
    expect(container.style.height).toBe("176px");
    container.fireTransitionEnd("height");
    expect(container.style.height).toBe("");

    await new Promise((resolve) => setTimeout(resolve, 20));

    // The delayed mutation must have frozen its own pre-mutation height
    // (176px, matching the typing-state content) before isTyping flipped,
    // even though the tab-swap transition already cleared height back to "".
    expect(container.style.height).toBe("176px");
    expect(nextTickCallbacks).toHaveLength(1);

    container.naturalHeight = 623; // response + technical-details reveal grows the content
    nextTickCallbacks[0]?.();

    expect(container.style.height).toBe("623px");
  });
});
