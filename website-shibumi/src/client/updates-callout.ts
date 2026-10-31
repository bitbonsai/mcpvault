/**
 * Alpine.data() module backing the home page's "Recent Updates" callout
 * expand/collapse (`UpdateCallout.tsx`). Ported from `UpdateCallout.astro`'s
 * vanilla `initUpdatesToggle()`: a click on the toggle button flipped
 * `aria-expanded`, swapped the button's `aria-label`/`title` and the
 * `data-updates-label` span's text between `"Show full history"` and
 * `"Show less"`, and toggled `is-expanded`/`is-collapsed` on both the
 * button (which rotates `.updates-chevron` via a plain CSS rule, no JS
 * involved) and the `#older-updates` panel (which reveals/re-clips the
 * older-updates list via `max-height` plus a mask-image fade -- see
 * `home.css`, already ported byte-for-byte from the Astro `<style>` block,
 * unchanged by this module).
 *
 * Registered under the name `updatesCallout` in `alpine.ts`.
 * `UpdateCallout.tsx` only ever *names* this module and its `toggle`
 * method/`expanded` property in HTML attributes (`x-data="updatesCallout"`,
 * `x-on:click="toggle()"`, `x-bind:aria-expanded="expanded"`,
 * `x-bind:class="{ 'is-expanded': expanded }"`, `x-text="expanded ? 'Show
 * less' : 'Show full history'"`) -- every attribute above is grammar the
 * `@alpinejs/csp` build's restricted evaluator accepts (bare identifiers,
 * ternaries, ES5-style object literals with quoted hyphenated keys --
 * already proven elsewhere in this app, e.g. `Terminal.tsx`'s `{
 * 'is-copied': ... }` -- and method calls with no arguments), never an
 * inline function body. All actual logic (the single boolean flip) lives
 * here, in a plain, unit-testable function -- there's really only one
 * piece of state, so unlike `interactive-demo.ts`/`terminal.ts` there's no
 * separate helper to extract.
 *
 * No-JS default: the panel's static markup already ships `is-collapsed`
 * (`UpdateCallout.tsx`), which clips it to `max-height: 2.5rem` with a
 * mask-image fade rather than `display: none` -- the full older-updates
 * list stays in the DOM (reachable by search engines, screen readers'
 * virtual-cursor navigation, Ctrl/Cmd+F, view-source) even with no
 * JavaScript at all; only the *visual* reveal needs a script, matching the
 * original Astro behavior exactly. `expanded` defaulting to `false` here
 * matches that same collapsed starting state once Alpine does load.
 */
export interface UpdatesCalloutData {
  expanded: boolean;
  toggle(this: UpdatesCalloutData): void;
}

export function updatesCallout(): UpdatesCalloutData {
  return {
    expanded: false,
    toggle() {
      this.expanded = !this.expanded;
    },
  };
}
