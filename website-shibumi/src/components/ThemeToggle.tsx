/**
 * Theme toggle markup. Ported from ThemeToggle.tsx (React).
 *
 * Note: the Astro site defines this component but never mounts it in Nav or
 * any page (grep confirms no import site besides its own definition and a
 * comment) -- theme switching is currently dead code in production. This
 * port preserves that: the component still isn't mounted anywhere, so
 * there is still no visual change, but it is now fully wired to the
 * `themeToggle` Alpine.data() module (`../client/theme.ts`, Phase 3): the
 * button names the module with `x-data`/`x-init="init()"`, flips on
 * `x-on:click="toggle()"`, and both icons/aria-label/status text react to
 * `theme` via `x-bind:class`/`x-bind:aria-label`/`x-text`. Every one of
 * those expressions is grammar the `@alpinejs/csp` build's restricted
 * evaluator accepts (bare identifiers, `===`, ternaries), never an inline
 * function body -- see `theme.ts` for the actual persistence logic.
 * `alpine.ts` does not register `themeToggle` yet, matching this component
 * staying unmounted (see `theme.ts`'s header for why).
 *
 * Both icons render unconditionally now (not just the one matching
 * `theme`), toggled via `x-bind:class="{ hidden: ... }"` with a *static*
 * `hidden` class as the no-JS default on whichever one doesn't match the
 * server-rendered `theme` prop -- same "class toggle, not `x-show`"
 * convention as `InteractiveDemo.tsx`/`ResponseRenderer.tsx`, so Alpine's
 * `hidden`-class add/remove never has to fight a competing inline style.
 *
 * Styling convention: one selector root per component (shared.css). The
 * React source also carried a plain `class="theme-toggle"` with no matching
 * CSS anywhere -- dead weight, not a second styling system to preserve.
 * Dropped in favor of the single `[data-component="theme-toggle"]` root.
 */
export interface ThemeToggleProps {
  /** Defaults to "dark" to match the server-rendered `<html class="dark">`. */
  theme?: "dark" | "light";
}

export function ThemeToggle({ theme = "dark" }: ThemeToggleProps) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      data-component="theme-toggle"
      data-theme={theme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      x-data="themeToggle"
      x-init="init()"
      x-on:click="toggle()"
      x-bind:data-theme="theme"
      x-bind:aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
    >
      <span class="slider">
        <span class={`icon${isDark ? "" : " hidden"}`} aria-hidden="true" x-bind:class="{ hidden: theme !== 'dark' }">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            />
          </svg>
        </span>
        <span class={`icon${isDark ? " hidden" : ""}`} aria-hidden="true" x-bind:class="{ hidden: theme === 'dark' }">
          <svg fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        </span>
      </span>
      <span class="sr-status" x-text="theme === 'dark' ? 'Dark mode active' : 'Light mode active'">{isDark ? "Dark mode active" : "Light mode active"}</span>
    </button>
  );
}
