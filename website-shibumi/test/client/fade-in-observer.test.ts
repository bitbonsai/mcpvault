/**
 * Unit tests for `fade-in-observer.ts` (plain JS, no Alpine -- see that
 * file). No real DOM is available under `bun test`, so these tests inject
 * minimal fakes matching the narrow `FadeInObserverDoc`/`FadeInObserverWindow`
 * interfaces instead of using a browser.
 */
import { describe, expect, test } from "bun:test";
import { getObserverOptions, initFadeInObserver, reveal } from "../../src/client/fade-in-observer";

class FakeElement {
  classList = {
    added: new Set<string>(),
    add(name: string) {
      this.added.add(name);
    },
  };
  private animationendListener: (() => void) | undefined;

  addEventListener(_type: "animationend", listener: () => void): void {
    this.animationendListener = listener;
  }

  /** Test helper: simulate the browser firing `animationend` once `fade-in-up` finishes. */
  fireAnimationEnd(): void {
    this.animationendListener?.();
  }
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: (entries: { isIntersecting: boolean; target: FakeElement }[], observer: FakeIntersectionObserver) => void;
  options: unknown;
  observed: FakeElement[] = [];
  unobserved: FakeElement[] = [];

  constructor(callback: FakeIntersectionObserver["callback"], options: unknown) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(el: FakeElement) {
    this.observed.push(el);
  }

  unobserve(el: FakeElement) {
    this.unobserved.push(el);
  }
}

function fakeWindow(overrides: Partial<{ IntersectionObserver: unknown; raf: (cb: () => void) => number }> = {}) {
  const raf = overrides.raf ?? ((cb: () => void) => (cb(), 0));
  return {
    IntersectionObserver: ("IntersectionObserver" in overrides ? overrides.IntersectionObserver : FakeIntersectionObserver) as any,
    requestAnimationFrame: raf,
  };
}

describe("getObserverOptions()", () => {
  test("matches the original Layout.astro tuning", () => {
    expect(getObserverOptions()).toEqual({ threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
  });
});

describe("reveal()", () => {
  test("adds is-visible immediately", () => {
    const el = new FakeElement();
    reveal(el);
    expect(el.classList.added.has("is-visible")).toBe(true);
    expect(el.classList.added.has("fade-in-done")).toBe(false);
  });

  test("adds fade-in-done once animationend fires, fully detaching the animation", () => {
    // Regression test: animation-fill-mode: forwards never detaches the
    // fade-in-up animation on its own, which left a transform-targeting
    // animation permanently attached and silently blocked backdrop-filter
    // on any glass card nested inside a .fade-in-on-scroll wrapper --
    // confirmed against a real browser, not just this fake. fade-in-done's
    // `animation: none` (see shared.css) is what actually detaches it.
    const el = new FakeElement();
    reveal(el);
    el.fireAnimationEnd();
    expect(el.classList.added.has("fade-in-done")).toBe(true);
  });
});

describe("initFadeInObserver()", () => {
  test("does nothing when there are no .fade-in-on-scroll elements", () => {
    FakeIntersectionObserver.instances = [];
    const doc = { querySelectorAll: () => [] };
    initFadeInObserver(doc, fakeWindow());
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  test("observes every matched element", () => {
    FakeIntersectionObserver.instances = [];
    const els = [new FakeElement(), new FakeElement()];
    const doc = { querySelectorAll: () => els };
    initFadeInObserver(doc, fakeWindow());
    const [observer] = FakeIntersectionObserver.instances;
    expect(observer?.observed).toEqual(els);
  });

  test("adds is-visible only to intersecting targets, via requestAnimationFrame, and unobserves them", () => {
    FakeIntersectionObserver.instances = [];
    const visible = new FakeElement();
    const notYetVisible = new FakeElement();
    const doc = { querySelectorAll: () => [visible, notYetVisible] };
    let rafCalls = 0;
    initFadeInObserver(
      doc,
      fakeWindow({
        raf: (cb) => {
          rafCalls++;
          cb();
          return 0;
        },
      }),
    );
    const [observer] = FakeIntersectionObserver.instances;
    observer!.callback(
      [
        { isIntersecting: true, target: visible },
        { isIntersecting: false, target: notYetVisible },
      ],
      observer!,
    );

    expect(rafCalls).toBe(1);
    expect(visible.classList.added.has("is-visible")).toBe(true);
    expect(notYetVisible.classList.added.has("is-visible")).toBe(false);
    expect(observer!.unobserved).toEqual([visible]);
  });

  test("revealed targets also get the fade-in-done handoff once their animation ends", () => {
    FakeIntersectionObserver.instances = [];
    const visible = new FakeElement();
    const doc = { querySelectorAll: () => [visible] };
    initFadeInObserver(doc, fakeWindow());
    const [observer] = FakeIntersectionObserver.instances;
    observer!.callback([{ isIntersecting: true, target: visible }], observer!);

    visible.fireAnimationEnd();

    expect(visible.classList.added.has("fade-in-done")).toBe(true);
  });

  test("does not call requestAnimationFrame when nothing intersects yet", () => {
    FakeIntersectionObserver.instances = [];
    const el = new FakeElement();
    const doc = { querySelectorAll: () => [el] };
    let rafCalls = 0;
    initFadeInObserver(
      doc,
      fakeWindow({
        raf: () => {
          rafCalls++;
          return 0;
        },
      }),
    );
    const [observer] = FakeIntersectionObserver.instances;
    observer!.callback([{ isIntersecting: false, target: el }], observer!);
    expect(rafCalls).toBe(0);
  });

  test("reveals everything immediately when IntersectionObserver is unsupported", () => {
    const els = [new FakeElement(), new FakeElement()];
    const doc = { querySelectorAll: () => els };
    initFadeInObserver(doc, fakeWindow({ IntersectionObserver: undefined }));
    for (const el of els) expect(el.classList.added.has("is-visible")).toBe(true);
  });

  test("the unsupported-IntersectionObserver fallback also wires the fade-in-done handoff", () => {
    const el = new FakeElement();
    const doc = { querySelectorAll: () => [el] };
    initFadeInObserver(doc, fakeWindow({ IntersectionObserver: undefined }));
    el.fireAnimationEnd();
    expect(el.classList.added.has("fade-in-done")).toBe(true);
  });
});
