/**
 * Unit tests for the `terminal` Alpine.data() module (install page tab
 * switching, copy-to-clipboard feedback, and the typing animation).
 *
 * `selectTab`'s `$root`/`$nextTick` wiring to the shared height-transition
 * helper (`../../src/client/height-transition`, also used by
 * `interactive-demo.test.ts`) is covered here with a `FakeContainer`
 * standing in for `.terminal-body` instead of a real DOM -- same reasoning
 * as `fade-in-observer.test.ts`. `growToContent()`/`transitionHeightAcross()`
 * themselves are tested directly in `height-transition.test.ts`; this file
 * only tests that `terminal()` wires them up correctly.
 */
import { describe, expect, test } from "bun:test";
import type { HeightTransitionContainer } from "../../src/client/height-transition";
import { DEFAULT_TAB, INSPECTOR_COMMANDS, isTypingDone, nextTypedState, terminal } from "../../src/client/terminal";

function fakeClipboard(overrides: { writeText?: (text: string) => Promise<void> } = {}) {
  const written: string[] = [];
  return {
    written,
    writeText: overrides.writeText ?? (async (text: string) => void written.push(text)),
  };
}

class FakeContainer implements HeightTransitionContainer {
  style = { height: "" };
  /** Stand-in for what a real element's `offsetHeight` would be if its `height` were `auto`. Test-settable to simulate content changes (a config tab with a longer/shorter payload). */
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

describe("nextTypedState()", () => {
  test("reveals one more char of the first unfinished line", () => {
    const commands = ["abc", "de"];
    expect(nextTypedState(commands, ["", ""])).toEqual(["a", ""]);
    expect(nextTypedState(commands, ["a", ""])).toEqual(["ab", ""]);
    expect(nextTypedState(commands, ["ab", ""])).toEqual(["abc", ""]);
  });

  test("moves to the next line once the current one is complete", () => {
    const commands = ["ab", "cd"];
    expect(nextTypedState(commands, ["ab", ""])).toEqual(["ab", "c"]);
  });

  test("is a no-op once every line is fully typed", () => {
    const commands = ["ab", "cd"];
    const done = ["ab", "cd"];
    expect(nextTypedState(commands, done)).toEqual(done);
  });
});

describe("isTypingDone()", () => {
  test("false while any line is incomplete", () => {
    expect(isTypingDone(["ab", "cd"], ["ab", "c"])).toBe(false);
  });

  test("true once every line matches its full command", () => {
    expect(isTypingDone(["ab", "cd"], ["ab", "cd"])).toBe(true);
  });
});

describe("terminal()", () => {
  test("defaults to the standard tab", () => {
    const data = terminal([], fakeClipboard());
    expect(data.activeTab).toBe(DEFAULT_TAB);
    expect(data.activeTab).toBe("standard");
  });

  test("defaults typed to an empty string per command", () => {
    const data = terminal(["one", "two"], fakeClipboard());
    expect(data.typed).toEqual(["", ""]);
  });

  test("selectTab() switches the active tab", () => {
    const data = terminal([], fakeClipboard());
    data.selectTab("claude-code");
    expect(data.activeTab).toBe("claude-code");
  });

  test("selectTab() is a no-op when re-selecting the active tab", () => {
    const data = terminal([], fakeClipboard());
    data.selectTab("standard");
    expect(data.activeTab).toBe("standard");
  });

  test("selectTab() tolerates a missing $root/$nextTick (e.g. calling it directly in a unit test, no Alpine runtime)", () => {
    const data = terminal([], fakeClipboard());
    expect(() => data.selectTab("claude-code")).not.toThrow();
    expect(data.activeTab).toBe("claude-code");
  });

  test("selectTab() freezes .terminal-body's pre-mutation height immediately, then grows to the post-mutation content height once $nextTick fires", () => {
    const container = new FakeContainer(120);
    const nextTickCallbacks: Array<() => void> = [];
    const data = terminal([], fakeClipboard());
    data.$root = { querySelector: () => container };
    data.$nextTick = (callback) => {
      nextTickCallbacks.push(callback);
    };

    data.selectTab("claude-code");

    // Frozen at the pre-mutation height synchronously, before $nextTick ever fires.
    expect(container.style.height).toBe("120px");
    expect(nextTickCallbacks).toHaveLength(1);

    // Simulate Alpine's reactive DOM update (the new config's markup actually
    // rendering) landing before $nextTick's callback runs -- a shrink this
    // time (a shorter config than the standard one).
    container.naturalHeight = 60;
    nextTickCallbacks[0]?.();

    expect(container.style.height).toBe("60px");
  });

  test("selectTab() is a no-op for the height freeze too when re-selecting the active tab", () => {
    const container = new FakeContainer(120);
    const data = terminal([], fakeClipboard());
    data.$root = { querySelector: () => container };
    data.$nextTick = () => {
      throw new Error("$nextTick should not be scheduled when selectTab no-ops");
    };

    data.selectTab("standard");

    expect(container.style.height).toBe("");
  });

  test("copy() writes to the clipboard and sets copiedText", async () => {
    const clipboard = fakeClipboard();
    const data = terminal([], clipboard);
    await data.copy("npm install -g @modelcontextprotocol/inspector");
    expect(clipboard.written).toEqual(["npm install -g @modelcontextprotocol/inspector"]);
    expect(data.copiedText).toBe("npm install -g @modelcontextprotocol/inspector");
  });

  test("copy() reverts copiedText to null after the feedback window", async () => {
    const data = terminal([], fakeClipboard(), 25, 5);
    await data.copy("some command");
    expect(data.copiedText).toBe("some command");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(data.copiedText).toBeNull();
  });

  test("copy() ignores an undefined payload (button with no data-copy)", async () => {
    const clipboard = fakeClipboard();
    const data = terminal([], clipboard);
    await data.copy(undefined);
    expect(clipboard.written).toEqual([]);
    expect(data.copiedText).toBeNull();
  });

  test("copy() leaves copiedText unset when the clipboard write rejects", async () => {
    const clipboard = fakeClipboard({
      writeText: async () => {
        throw new Error("clipboard permission denied");
      },
    });
    const data = terminal([], clipboard);
    await data.copy("some command");
    expect(data.copiedText).toBeNull();
  });

  test("startTyping() reveals every command over time, one char at a time", async () => {
    const data = terminal(["ab", "c"], fakeClipboard(), 5);
    data.startTyping();
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(data.typed).toEqual(["ab", "c"]);
  });

  test("startTyping() with no commands does not throw or hang", () => {
    const data = terminal([], fakeClipboard());
    expect(() => data.startTyping()).not.toThrow();
  });

  test("the real INSPECTOR_COMMANDS default matches Terminal.tsx's copy payloads", () => {
    expect(INSPECTOR_COMMANDS).toEqual(["npm install -g @modelcontextprotocol/inspector", "mcp-inspector npx @bitbonsai/mcpvault@latest /path/to/vault"]);
  });
});
