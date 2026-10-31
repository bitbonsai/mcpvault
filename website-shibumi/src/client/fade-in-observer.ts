/**
 * Scroll-triggered reveal for `.fade-in-on-scroll` elements. Ported from
 * `Layout.astro`'s vanilla `observeElements()`, but plain JS, not an
 * `Alpine.data()` module: there is no interactive state here a template
 * needs to read or an event a template needs to name, just a page-load side
 * effect, so wiring it through Alpine would add naming ceremony for no
 * benefit. Bundled into the same `alpine.js` output as every other client
 * module (`client-bundle.ts` doesn't care what it bundles), but imported
 * only for this side effect -- it never touches `Alpine.data()`/`Alpine.store()`.
 *
 * Production bug this fixes, not just ports: `Layout.astro`'s observer
 * added `.animate-fade-in-up`, but every page's own scoped `<style>` block
 * played the animation unconditionally via `animation: fade-in-up ...
 * forwards` directly on `.fade-in-on-scroll` -- the class the observer
 * added was never referenced by any of those rules, so elements always
 * animated on page load, never "on scroll" (confirmed by grep: no page
 * style block selects `.animate-fade-in-up`). The first pass of this port
 * (features.css/install.css/demo.css/skill.css/how-it-works.css) carried
 * that same unconditional `animation: ... forwards` forward. `shared.css`'s
 * shared `.fade-in-on-scroll` rule now gates the animation behind
 * `.is-visible` instead, and this module is what adds that class, so the
 * animation genuinely waits for scroll intersection.
 *
 * `prefers-reduced-motion` is handled in CSS (`shared.css`), not here: the
 * elements are already fully opaque/untransformed under that media query,
 * so this module observing them and adding `.is-visible` is harmless but
 * unnecessary. It still runs either way rather than special-casing the
 * media query twice in two places.
 *
 * `reveal()`'s `animationend` listener fixes a second, subtler bug than the
 * one described above: `animation-fill-mode: forwards` never actually
 * detaches the animation once it finishes -- `el.getAnimations()` still
 * returns it, permanently, in `playState: "finished"`. Any element with a
 * `transform`-targeting animation still attached, no matter how long
 * finished, keeps creating a backdrop-root for compositing purposes --
 * confirmed against a real browser, not just spec-reading: a `.fade-in-
 * on-scroll` *wrapper* around a glass card (e.g. features.css's
 * `.comparison-cta`, wrapping `.comparison-cta-card`'s `backdrop-filter:
 * blur(24px)`) silently blocked that descendant's blur from ever rendering
 * -- `getComputedStyle` still reported `blur(24px)` on the card itself
 * (unaffected), but screenshotting a bright pattern behind the page showed
 * it passing through completely unblurred. Changing the keyframe's `to`
 * value from `translateY(0)` to `none` (see `@keyframes fade-in-up` below)
 * only helps elements where `.fade-in-on-scroll` sits on the *same*
 * element as the `backdrop-filter` (a transform never blocks its own
 * element's backdrop-filter, only a live transform on an ancestor does)
 * -- it does nothing for the wrapper case, because the browser exposes an
 * animated `transform` as a resolved matrix, not the literal keyword
 * `none`, for as long as any animation remains attached, regardless of
 * what value that animation's keyframes declare. `reveal()` adds
 * `fade-in-done` once `animationend` fires, and `shared.css`'s
 * `.fade-in-on-scroll.is-visible.fade-in-done` rule sets `animation: none`
 * -- fully detaching it -- while keeping the settled `opacity: 1; transform:
 * none;` as a plain, non-animated style, so nothing snaps back to hidden.
 *
 * The interfaces below are deliberately minimal structural subsets of the
 * real DOM (`classList.add`, `addEventListener`, `querySelectorAll`, a
 * constructor + `observe`/`unobserve`) rather than the real `Element`/
 * `Document`/`IntersectionObserver` lib.dom types, so tests can pass small
 * hand-written fakes instead of a real DOM.
 */
export interface FadeInTarget {
  classList: { add(name: string): void };
  addEventListener(type: "animationend", listener: () => void, options?: { once?: boolean }): void;
}

/**
 * Reveals `el`: adds `is-visible` (starts the `fade-in-up` animation), then
 * adds `fade-in-done` once that animation's `animationend` fires, fully
 * detaching it -- see the module comment for why a merely-finished-but-
 * still-attached animation isn't good enough.
 */
export function reveal(el: FadeInTarget): void {
  el.classList.add("is-visible");
  el.addEventListener("animationend", () => el.classList.add("fade-in-done"), { once: true });
}

export interface FadeInObserverDoc {
  querySelectorAll(selector: string): Iterable<FadeInTarget>;
}

export interface FadeInObserverEntry {
  isIntersecting: boolean;
  target: FadeInTarget;
}

export interface FadeInIntersectionObserver {
  observe(target: FadeInTarget): void;
  unobserve(target: FadeInTarget): void;
}

export type FadeInIntersectionObserverCtor = new (
  callback: (entries: FadeInObserverEntry[], observer: FadeInIntersectionObserver) => void,
  options: { threshold: number; rootMargin: string },
) => FadeInIntersectionObserver;

export interface FadeInObserverWindow {
  IntersectionObserver?: FadeInIntersectionObserverCtor;
  requestAnimationFrame(callback: () => void): number;
}

/** Matches `Layout.astro`'s original observer tuning exactly. */
export function getObserverOptions(): { threshold: number; rootMargin: string } {
  return { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
}

/**
 * @param doc/@param win Injectable so tests can pass minimal fakes instead
 * of needing a real DOM/IntersectionObserver.
 */
export function initFadeInObserver(doc: FadeInObserverDoc, win: FadeInObserverWindow): void {
  const targets = Array.from(doc.querySelectorAll(".fade-in-on-scroll"));
  if (targets.length === 0) return;

  const IO = win.IntersectionObserver;
  if (!IO) {
    // No IntersectionObserver support: reveal everything rather than
    // leaving it permanently hidden behind `opacity: 0`.
    for (const el of targets) reveal(el);
    return;
  }

  const observer = new IO((entries, obs) => {
    const revealed: FadeInTarget[] = [];
    for (const entry of entries) {
      if (entry.isIntersecting) {
        revealed.push(entry.target);
        obs.unobserve(entry.target);
      }
    }
    if (revealed.length > 0) {
      win.requestAnimationFrame(() => {
        for (const el of revealed) reveal(el);
      });
    }
  }, getObserverOptions());

  for (const el of targets) observer.observe(el);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  initFadeInObserver(document as unknown as FadeInObserverDoc, window as unknown as FadeInObserverWindow);
}
