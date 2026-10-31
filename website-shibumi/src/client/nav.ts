/**
 * Alpine.data() module backing the mobile navigation menu (`Nav.tsx`).
 * Ported from `Nav.astro`'s vanilla `initMobileMenu()`: a click on the
 * button toggled `.hidden` on `#mobile-menu` (plus `aria-expanded`), each
 * mobile link click closed the menu, and a click anywhere else outside the
 * button/menu also closed it.
 *
 * Registered under the name `nav` in `alpine.ts`. `Nav.tsx` only ever
 * *names* this module and its methods in HTML attributes
 * (`x-data="nav"`, `x-on:click="toggle()"`, `x-bind:hidden="!open"`,
 * `x-on:click.outside="close()"`) -- every attribute above is grammar the
 * `@alpinejs/csp` build's restricted evaluator accepts (bare identifiers,
 * `!`, method calls with no arguments), never an inline function body.
 *
 * `open` toggles the `hidden` *attribute* via `x-bind:hidden`, not a
 * `.hidden` class via `x-bind:class`. Unlike the demo/terminal panels
 * (which start visible-by-default markup hidden behind a *static* `.hidden`
 * class for a no-JS fallback, so `x-show` would silently lose to that
 * class -- see `InteractiveDemo.tsx`), the mobile menu already ships with
 * a real `hidden` attribute in the server-rendered markup and nothing else
 * ever sets that attribute, so a direct two-way `x-bind:hidden` has no
 * competing static value to lose to.
 */
export interface NavData {
  open: boolean;
  toggle(this: NavData): void;
  close(this: NavData): void;
}

export function nav(): NavData {
  return {
    open: false,
    toggle() {
      this.open = !this.open;
    },
    close() {
      this.open = false;
    },
  };
}
