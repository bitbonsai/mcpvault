/**
 * Alpine.data() module backing the theme toggle (`ThemeToggle.tsx`). Ported
 * from `ThemeToggle.tsx` (React)'s `useState`/`useEffect` pair plus
 * `Layout.astro`'s vanilla `initTheme()`: read `localStorage`, fall back to
 * `prefers-color-scheme`, default to dark; clicking flips the theme,
 * persists it to `localStorage`, and toggles `<html class="dark">`.
 *
 * `ThemeToggle.tsx` is not mounted anywhere -- see that file's own comment:
 * production never mounts its React equivalent either (confirmed by grep,
 * no import site besides the component's own definition), so this module
 * exists to make the component fully wired and ready, without introducing
 * a visual change today. Because nothing renders `<ThemeToggle />` yet,
 * `alpine.ts` does not call `Alpine.data("themeToggle", themeToggle)`
 * either -- registering a module with no `x-data="themeToggle"` anywhere
 * in the shipped HTML would be dead weight in the bundle. The moment a
 * future page mounts the component, wiring it in is a one-line addition to
 * `alpine.ts` alongside `nav`/`newsletterSignup`/`terminal`.
 *
 * `resolveInitialTheme()`/`nextTheme()` are the actual decision logic, pure
 * and unit-testable with no DOM. `init()`/`toggle()` are thin glue over an
 * injectable `deps` object (same pattern as `newsletter.ts`'s `fetchImpl`),
 * so this module never touches `localStorage`/`matchMedia`/`document`
 * directly -- only `defaultDeps()` does, and only when the factory is
 * called with no argument (real browser use, never under `bun test`).
 */
export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

/** Pure: an explicit stored choice wins; otherwise fall back to system preference. */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "dark" || stored === "light") return stored;
  return prefersDark ? "dark" : "light";
}

/** Pure: the toggle only ever has two states. */
export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

export interface ThemeToggleDeps {
  getStored(): string | null;
  setStored(theme: Theme): void;
  prefersDark(): boolean;
  applyTheme(theme: Theme): void;
}

function defaultDeps(): ThemeToggleDeps {
  return {
    getStored: () => localStorage.getItem(STORAGE_KEY),
    setStored: (theme) => localStorage.setItem(STORAGE_KEY, theme),
    prefersDark: () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    applyTheme: (theme) => document.documentElement.classList.toggle("dark", theme === "dark"),
  };
}

export interface ThemeToggleData {
  theme: Theme;
  init(this: ThemeToggleData): void;
  toggle(this: ThemeToggleData): void;
}

/**
 * @param deps Injectable so tests don't need a real DOM/localStorage; a
 * future `alpine.ts` registration would call this with no arguments.
 */
export function themeToggle(deps: ThemeToggleDeps = defaultDeps()): ThemeToggleData {
  return {
    theme: "dark",
    init() {
      this.theme = resolveInitialTheme(deps.getStored(), deps.prefersDark());
      deps.applyTheme(this.theme);
    },
    toggle() {
      this.theme = nextTheme(this.theme);
      deps.setStored(this.theme);
      deps.applyTheme(this.theme);
    },
  };
}
