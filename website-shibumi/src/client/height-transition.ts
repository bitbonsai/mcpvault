/**
 * Shared helper for Alpine components whose active panel's content height
 * changes -- tab switches, revealed responses, anything that swaps which
 * child of a container is visible. Extracted from `interactive-demo.ts`
 * (fab91fb, the demo page's tab browser) once `terminal.ts` (the install
 * page's config-tab switching) needed the identical pattern; see that
 * commit's message for the two real bugs this had to work around, both
 * only found by driving a real browser, not the unit tests:
 *
 * 1. The container must be found via Alpine's `$root` magic, not `$el`:
 *    `$el` resolves to whichever element the *currently-evaluating
 *    directive* lives on -- for a tab click that's the clicked button, not
 *    the `x-data` root the height container lives under -- so `$el`-based
 *    lookups silently returned nothing on every real click. `$root` always
 *    resolves to the closest `x-data` element regardless of which
 *    directive triggered the call.
 * 2. `growToContent` can't just read `container.scrollHeight` while the
 *    frozen (old) height is still in place: `scrollHeight` reports
 *    whichever is larger, the box's own height or its content's, so it
 *    only ever reveals a size *larger* than the current box, never
 *    smaller (e.g. switching to a shorter tab). Toggling to `height: auto`
 *    to measure, then re-committing the frozen value with a second forced
 *    reflow before writing the real target, is what makes the write
 *    register as an animatable transition in both directions.
 *
 * Callers own their own CSS: each container needs its own `overflow:
 * hidden; transition: height <duration> ease-out;` rule (and a
 * `prefers-reduced-motion` override setting `transition: none`) -- this
 * module only measures and writes the `height` property.
 */

/** Minimal shape `growToContent` needs; matches `HTMLElement` at runtime. */
export interface HeightTransitionContainer {
  style: { height: string };
  offsetHeight: number;
  addEventListener(type: "transitionend", listener: (event: { propertyName: string }) => void, options?: { once?: boolean }): void;
}

/**
 * Alpine `$root` magic: the closest `x-data` element, regardless of which
 * directive/element triggered the call -- see the module comment for why
 * this must be `$root`, not `$el`. Declared as this minimal shape (not the
 * real DOM `Element` type) because that's all callers need -- same
 * rationale as `HeightTransitionContainer`.
 */
export interface HeightTransitionRoot {
  querySelector(selector: string): HeightTransitionContainer | null;
}

/**
 * Measures `container`'s current natural content height and sets it as an
 * explicit pixel `height`, so a CSS `transition: height` on `container`
 * animates from whatever pixel value the caller froze it at beforehand up
 * to this new one, instead of jumping.
 *
 * Deliberately does *not* just read `container.scrollHeight` while the
 * frozen (old) pixel height is still in place: `scrollHeight` reports
 * whichever is larger, the box's own height or its content's -- so it
 * only ever reveals a *larger* natural size (content overflowing a
 * too-small frozen box), never a *smaller* one (content that no longer
 * fills an already-too-big frozen box). Confirmed against a real browser,
 * not just reasoning about the spec: measuring that way silently no-ops on
 * every shrink. Toggling to `height: auto` and reading `offsetHeight` gets
 * the true natural size either way, but forces a synchronous reflow that
 * the browser also treats as officially committing "auto"'s value as
 * `container`'s current style -- so reverting to the frozen value and
 * writing the real target immediately after, with no second forced
 * reflow in between, collapses into one jump with nothing to animate from
 * (also confirmed against a real browser). The second `void
 * container.offsetHeight` below re-commits the frozen value as current
 * *before* the final write, which is what actually makes that write
 * register as a transition.
 */
export function growToContent(container: HeightTransitionContainer): void {
  const frozenHeight = container.style.height;
  container.style.height = "auto";
  const targetHeight = container.offsetHeight;
  container.style.height = frozenHeight;
  void container.offsetHeight;

  container.style.height = `${targetHeight}px`;
  container.addEventListener(
    "transitionend",
    (event) => {
      // Clears back to `height: auto` once the transition finishes,
      // listening for `transitionend` on the `height` property
      // specifically rather than a fixed timeout, so a later change to
      // the caller's transition duration can't drift out of sync with
      // this -- so a later, unrelated reflow (window resize, font swap)
      // isn't locked to a stale pixel value.
      if (event.propertyName === "height") container.style.height = "";
    },
    { once: true },
  );
}

/**
 * Freezes `container`'s current rendered height as an explicit pixel
 * value and forces a synchronous reflow (`void container.offsetHeight`)
 * so the browser commits that value as the current style *before*
 * `mutate()` changes the DOM -- otherwise `mutate()`'s reactive update and
 * `growToContent`'s later write can land in the same style-recalculation
 * batch with no repaint in between, so the browser jumps straight to the
 * final value instead of transitioning from the frozen one. Runs
 * `mutate()`, then waits for `nextTick` (Alpine's `$nextTick` magic,
 * confirming `mutate()`'s DOM update has actually landed) before growing
 * to the new content height.
 */
export function transitionHeightAcross(container: HeightTransitionContainer | undefined, nextTick: ((callback: () => void) => void) | undefined, mutate: () => void): void {
  if (container) {
    container.style.height = `${container.offsetHeight}px`;
    void container.offsetHeight;
  }
  mutate();
  nextTick?.(() => {
    if (container) growToContent(container);
  });
}
