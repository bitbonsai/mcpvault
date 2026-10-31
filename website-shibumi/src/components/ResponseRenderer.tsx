/**
 * Renders one demo example's Claude response text, ported from
 * `ResponseRenderer.tsx` (React). The original split the response on
 * ```json fences and ran the JSON half through `react-syntax-highlighter`
 * (Catppuccin Mocha); this version splits identically but highlights the
 * JSON half server-side with Shiki (`highlight.ts`), same audited pattern
 * as `FeatureCard`/`Terminal`.
 *
 * Async because `highlightCode()` is async; `InteractiveDemo` awaits every
 * `ResponseRenderer` call explicitly (Hono JSX does not auto-await elements
 * nested inside `.map()`), matching `FeatureGrid`'s precedent.
 *
 * Raw-HTML audit: `highlightCode()`'s output is passed through `raw()`
 * below. Safe because the only inputs are each demo example's own fixed
 * literal `response` string (defined in `InteractiveDemo.tsx`, never
 * user/request data) -- same audited pattern as `FeatureCard`.
 *
 * Alpine (Phase 3 step 1): the React original had no interactive state of
 * its own -- `isTyping` lived one level up, in `InteractiveDemo`'s
 * `useState`, which simply didn't render this component while typing. The
 * ported equivalent is the optional `hiddenWhen` prop: `InteractiveDemo.tsx`
 * passes `hiddenWhen="isTyping"` so the now-registered `interactiveDemo`
 * Alpine.data() module (`../client/interactive-demo.ts`) can hide/show this
 * exact markup, without this component needing any Alpine state of its own.
 *
 * This renders as `x-bind:class="{ hidden: isTyping }"`, not `x-show`.
 * `x-show`, when its expression is true, clears any inline `display`
 * override it previously set rather than forcing a value -- so on an
 * element that also carries a *static* `.hidden` class (this app's no-JS
 * fallback convention), the class keeps winning and the element never
 * visually reappears even though Alpine's internal state is correct. Class
 * toggling doesn't have that failure mode: Alpine adds/removes the exact
 * same `hidden` class the server already used for the no-JS default, in
 * both directions, symmetrically -- confirmed against a real browser
 * (`agent-browser`), not just the CSP parser's grammar. `hiddenWhen` must
 * still be a `@alpinejs/csp`-safe expression string (bare identifiers,
 * `!`/`===`, naming the parent's registered data, never an inline
 * function) -- see the CSP grammar notes in `interactive-demo.ts`. The
 * response rendering itself (the split, the highlighting, the two branches
 * below) is untouched from the pre-Alpine version.
 */
import { raw } from "hono/html";
import { highlightCode } from "../lib/highlight";

export interface ResponseRendererProps {
  response: string;
  /** Optional Alpine expression: when true, the `hidden` class is added to the root element. */
  hiddenWhen?: string;
}

export async function ResponseRenderer({ response, hiddenWhen }: ResponseRendererProps) {
  const parts = response.split(/```json\n|```/);
  const rendered = await Promise.all(
    parts.map(async (part, index) => {
      if (index % 2 === 1) {
        return { kind: "json" as const, html: await highlightCode(part.trim(), "json") };
      }
      return { kind: "text" as const, text: part };
    }),
  );

  return (
    <div class="demo-response" x-bind:class={hiddenWhen ? `{ hidden: ${hiddenWhen} }` : undefined}>
      {rendered.map((part) =>
        part.kind === "json" ? (
          <div class="demo-response-code">{raw(part.html)}</div>
        ) : (
          <pre class="demo-response-text">{part.text}</pre>
        ),
      )}
    </div>
  );
}
