/**
 * Demo page. Ported from pages/demo.astro.
 *
 * Composition matches the Astro source exactly: Nav, InteractiveDemo,
 * Footer, inside `<main id="main-content">`. `InteractiveDemo` is async
 * (each panel awaits a `ResponseRenderer`, which itself awaits Shiki); Hono's
 * JSX renderer awaits async components wherever they appear in the tree, so
 * this component itself stays a plain synchronous function, same precedent
 * as `FeaturesPage`/`FeatureGrid`.
 *
 * `clientScript="/client/alpine.js"` (Phase 3 step 1) loads the bundled
 * `@alpinejs/csp` build plus the `interactiveDemo` module that
 * `InteractiveDemo.tsx`'s tab buttons/panels name.
 */
import { Footer } from "../components/Footer";
import { InteractiveDemo } from "../components/InteractiveDemo";
import { Nav } from "../components/Nav";
import { Layout } from "../layouts/Layout";

export interface DemoPageProps {
  currentPath: string;
  version: string;
}

export function DemoPage({ currentPath, version }: DemoPageProps) {
  return (
    <Layout
      title="Demo"
      description="Tool request and response examples for reading, writing, searching, and updating notes with MCPVault."
      canonical="https://mcpvault.org/demo/"
      page="demo"
      pageStylesheet="/styles/demo.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <InteractiveDemo />
        <Footer />
      </main>
    </Layout>
  );
}
