/**
 * Unit tests for the shared height-transition helper (`growToContent`,
 * `transitionHeightAcross`), used by both `interactive-demo.ts` (demo page
 * tab switching) and `terminal.ts` (install page config-tab switching).
 * See the module's own comment for the two real bugs this works around --
 * both only found by driving a real browser, not tests like these.
 *
 * `FakeContainer.offsetHeight` is a getter, not a plain field, deliberately
 * mirroring a real element: it returns the explicit pixel height when
 * `style.height` is set, or `naturalHeight` (the fake's stand-in for
 * actual layout) when it's `""`/`"auto"` -- `growToContent`'s fix depends
 * on that exact real-DOM behavior, so a fake that just stored a static
 * number would pass while hiding the bug it was written to catch.
 */
import { describe, expect, test } from "bun:test";
import { growToContent, transitionHeightAcross, type HeightTransitionContainer } from "../../src/client/height-transition";

class FakeContainer implements HeightTransitionContainer {
  style = { height: "" };
  /** Stand-in for what a real element's `offsetHeight` would be if its `height` were `auto`. Test-settable to simulate content changes. */
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

describe("growToContent()", () => {
  test("grows: sets the container's explicit height to its current natural content height", () => {
    const container = new FakeContainer(340);
    container.style.height = "120px"; // frozen at the old (smaller) height, as a caller leaves it
    growToContent(container);
    expect(container.style.height).toBe("340px");
  });

  test("shrinks: measuring via a naive scrollHeight-style read would miss this, since content is now smaller than the frozen box", () => {
    const container = new FakeContainer(60);
    container.style.height = "340px"; // frozen at the old (larger) height
    growToContent(container);
    expect(container.style.height).toBe("60px");
  });

  test("re-commits the frozen height before writing the target, so the transition has a value to animate from", () => {
    const container = new FakeContainer(60);
    container.style.height = "340px";
    const heightWrites: string[] = [];
    let current = "";
    Object.defineProperty(container.style, "height", {
      get: () => current,
      set: (v: string) => {
        heightWrites.push(v);
        current = v;
      },
    });
    // Re-apply the frozen value through the instrumented setter (the
    // constructor/assignment above ran before the spy was installed).
    heightWrites.length = 0;
    current = "340px";

    growToContent(container);

    // "auto" (to measure), then the frozen value again (re-committing it
    // via the forced reflow), then the real target -- in that order.
    expect(heightWrites).toEqual(["auto", "340px", "60px"]);
  });

  test("clears the height back to auto once the height transition ends", () => {
    const container = new FakeContainer(340);
    container.style.height = "120px";
    growToContent(container);
    container.fireTransitionEnd("height");
    expect(container.style.height).toBe("");
  });

  test("ignores transitionend events for properties other than height", () => {
    const container = new FakeContainer(340);
    container.style.height = "120px";
    growToContent(container);
    container.fireTransitionEnd("opacity");
    expect(container.style.height).toBe("340px");
  });
});

describe("transitionHeightAcross()", () => {
  test("freezes the pre-mutation height synchronously, runs mutate, then grows once nextTick fires", () => {
    const container = new FakeContainer(120);
    const nextTickCallbacks: Array<() => void> = [];
    let mutated = false;

    transitionHeightAcross(
      container,
      (callback) => {
        nextTickCallbacks.push(callback);
      },
      () => {
        mutated = true;
      },
    );

    expect(container.style.height).toBe("120px");
    expect(mutated).toBe(true);
    expect(nextTickCallbacks).toHaveLength(1);

    container.naturalHeight = 60;
    nextTickCallbacks[0]?.();

    expect(container.style.height).toBe("60px");
  });

  test("still runs mutate when container is undefined (no $root, e.g. calling it directly in a unit test)", () => {
    let mutated = false;
    expect(() =>
      transitionHeightAcross(undefined, undefined, () => {
        mutated = true;
      }),
    ).not.toThrow();
    expect(mutated).toBe(true);
  });

  test("still freezes and runs mutate when nextTick is undefined (no $nextTick, e.g. no Alpine runtime)", () => {
    const container = new FakeContainer(120);
    let mutated = false;

    transitionHeightAcross(container, undefined, () => {
      mutated = true;
    });

    expect(mutated).toBe(true);
    // Frozen, but never grown -- nothing ever calls growToContent without nextTick.
    expect(container.style.height).toBe("120px");
  });
});
