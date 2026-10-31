/**
 * Alpine.data() module backing the demo page's tab browser
 * (`InteractiveDemo.tsx`). Ported from `InteractiveDemo.tsx` (React)'s two
 * `useState` calls (`activeTab`, `isTyping`) and its `handleTabClick`
 * handler.
 *
 * Registered under the name `interactiveDemo` in `alpine.ts`.
 * `InteractiveDemo.tsx` (the Hono JSX component) only ever *names* this
 * module and its `selectTab` method in HTML attributes
 * (`x-data="interactiveDemo"`, `x-on:click="selectTab('write')"`,
 * `x-show="activeTab === 'write'"`) -- every attribute expression above is
 * grammar the `@alpinejs/csp` build's restricted evaluator accepts
 * (bare identifiers, member/call expressions on registered scope, string
 * literals, `===`/`!`), never an inline function body. All actual logic
 * -- the guard against re-selecting the active tab, and the typing-delay
 * timeout -- lives here, in a plain, unit-testable function.
 *
 * Height transition: swapping tabs and revealing the AI response (the
 * `isTyping` flip) both change the active panel's content height, which
 * used to jump instead of grow (see `demo.css`'s `.demo-window-body`
 * comment). Both of those are separate mutations -- `activeTab`/`isTyping`
 * change together on tab click, then `isTyping` changes again, alone,
 * after the typing delay -- and *each* needs its own freeze/grow pair, via
 * `./height-transition`'s `transitionHeightAcross`/`growToContent` (shared
 * with `terminal.ts`'s install-page config-tab switching -- see that
 * module's own comment for the two real bugs the shared helper works
 * around). `this.$root`/`this.$nextTick` are Alpine magics, only present
 * when this module is actually running under Alpine -- both are accessed
 * with `?.` so calling `selectTab()` directly in a unit test (no `$root`,
 * no real DOM) still exercises the tab/typing state changes without
 * throwing.
 */
import { transitionHeightAcross, type HeightTransitionRoot } from "./height-transition";

export interface InteractiveDemoData {
  activeTab: string;
  isTyping: boolean;
  selectTab(this: InteractiveDemoData, id: string): void;
  /** Alpine `$root` magic -- see `./height-transition`'s module comment for why this must be `$root`, not `$el`. */
  $root?: HeightTransitionRoot;
  /** Alpine `$nextTick` magic: schedules `callback` after Alpine's next reactive DOM update. Same optional/`?.` treatment as `$root`. */
  $nextTick?: (callback: () => void) => void;
}

export const DEFAULT_TAB = "patch";
export const TYPING_DELAY_MS = 1000;

const WINDOW_BODY_SELECTOR = ".demo-window-body";

/**
 * @param typingDelayMs Injectable so tests don't need real 1s timeouts or
 * fake-timer plumbing; `alpine.ts` calls this with no arguments, which
 * defaults to the original component's exact 1000ms delay.
 */
export function interactiveDemo(typingDelayMs: number = TYPING_DELAY_MS): InteractiveDemoData {
  return {
    activeTab: DEFAULT_TAB,
    isTyping: false,
    selectTab(id) {
      if (id === this.activeTab) return;

      const container = this.$root?.querySelector(WINDOW_BODY_SELECTOR) ?? undefined;

      transitionHeightAcross(container, this.$nextTick, () => {
        this.isTyping = true;
        this.activeTab = id;
      });

      setTimeout(() => {
        transitionHeightAcross(container, this.$nextTick, () => {
          this.isTyping = false;
        });
      }, typingDelayMs);
    },
  };
}
