/**
 * Client bundle entry point for the site's Alpine interactivity.
 *
 * Imports `@alpinejs/csp`, not the standard `alpinejs` package (per the
 * plan's Alpine section): the CSP build's evaluator never calls
 * `Function()`/`eval()` to run `x-data`/`x-on`/`x-show` attribute strings,
 * so the page can ship a CSP without `'unsafe-eval'`. `client-bundle.ts`
 * bundles this file with `Bun.build()` (target: browser) and serves the
 * result at `/client/alpine.js` -- Alpine's own source ends up inlined in
 * that single served file, so there is no CDN request at runtime, matching
 * "vendor Alpine locally".
 *
 * Every named module this app registers is added here, then `Alpine.start()`
 * is called once. `nav` (mobile menu, every page) and `newsletterSignup`
 * (home page) joined `interactiveDemo` (Phase 3 step 1) in this step;
 * `terminal` (install page) landed in the same step, and `updatesCallout`
 * (home page's "Recent Updates" expand/collapse) landed later in Phase 3.
 * `themeToggle` exists as a module too, but its component stays unmounted
 * (see `ThemeToggle.tsx` -- no layout/page renders `<ThemeToggle />` yet),
 * so it isn't registered here yet -- registering an unused module would be
 * dead weight in the shipped bundle.
 *
 * `./fade-in-observer` is imported for its side effect only -- it is
 * plain JS, not an Alpine.data() module (see that file for why), so it
 * never appears in the `Alpine.data(...)` list below.
 */
import Alpine from "@alpinejs/csp";
import "./bench-reveal";
import "./confetti";
import "./fade-in-observer";
import { interactiveDemo } from "./interactive-demo";
import { nav } from "./nav";
import { newsletterSignup } from "./newsletter";
import { terminal } from "./terminal";
import { updatesCallout } from "./updates-callout";

Alpine.data("interactiveDemo", interactiveDemo);
Alpine.data("nav", nav);
Alpine.data("newsletterSignup", newsletterSignup);
Alpine.data("terminal", terminal);
Alpine.data("updatesCallout", updatesCallout);

Alpine.start();
