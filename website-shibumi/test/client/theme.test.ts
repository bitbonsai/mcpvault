/**
 * Unit tests for the `themeToggle` Alpine.data() module. Only
 * `resolveInitialTheme()`/`nextTheme()` are pure enough to test without a
 * DOM; `init()`/`toggle()` are exercised too, but through a fully fake
 * `ThemeToggleDeps` (no real `localStorage`/`matchMedia`/`document`), same
 * pattern as `newsletter.test.ts`'s fake `fetch`.
 */
import { describe, expect, test } from "bun:test";
import { nextTheme, resolveInitialTheme, themeToggle, type Theme, type ThemeToggleDeps } from "../../src/client/theme";

function fakeDeps(overrides: Partial<{ stored: string | null; prefersDark: boolean }> = {}) {
  const state = { stored: overrides.stored ?? null, applied: [] as Theme[] };
  const deps: ThemeToggleDeps = {
    getStored: () => state.stored,
    setStored: (theme) => {
      state.stored = theme;
    },
    prefersDark: () => overrides.prefersDark ?? true,
    applyTheme: (theme) => {
      state.applied.push(theme);
    },
  };
  return { deps, state };
}

describe("resolveInitialTheme()", () => {
  test("an explicit stored theme wins over system preference", () => {
    expect(resolveInitialTheme("light", true)).toBe("light");
    expect(resolveInitialTheme("dark", false)).toBe("dark");
  });

  test("falls back to system preference when nothing is stored", () => {
    expect(resolveInitialTheme(null, true)).toBe("dark");
    expect(resolveInitialTheme(null, false)).toBe("light");
  });

  test("ignores a garbage stored value and falls back to system preference", () => {
    expect(resolveInitialTheme("not-a-theme", false)).toBe("light");
  });
});

describe("nextTheme()", () => {
  test("flips between the only two states", () => {
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
  });
});

describe("themeToggle()", () => {
  test("defaults to dark before init(), matching the server-rendered <html class=\"dark\">", () => {
    const { deps } = fakeDeps();
    const data = themeToggle(deps);
    expect(data.theme).toBe("dark");
  });

  test("init() resolves from stored/system preference and applies it", () => {
    const { deps, state } = fakeDeps({ stored: "light" });
    const data = themeToggle(deps);
    data.init();
    expect(data.theme).toBe("light");
    expect(state.applied).toEqual(["light"]);
  });

  test("init() falls back to system preference when nothing is stored", () => {
    const { deps, state } = fakeDeps({ stored: null, prefersDark: false });
    const data = themeToggle(deps);
    data.init();
    expect(data.theme).toBe("light");
    expect(state.applied).toEqual(["light"]);
  });

  test("toggle() flips the theme, persists it, and re-applies it", () => {
    const { deps, state } = fakeDeps({ stored: "dark" });
    const data = themeToggle(deps);
    data.init();
    data.toggle();
    expect(data.theme).toBe("light");
    expect(state.stored).toBe("light");
    expect(state.applied).toEqual(["dark", "light"]);
  });

  test("toggling twice returns to the original theme", () => {
    const { deps } = fakeDeps({ stored: "dark" });
    const data = themeToggle(deps);
    data.init();
    data.toggle();
    data.toggle();
    expect(data.theme).toBe("dark");
  });
});
