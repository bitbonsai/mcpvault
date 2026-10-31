/**
 * How It Works page. Ported from pages/how-it-works.astro.
 *
 * Composition matches the Astro source exactly: Nav, HowItWorksSection,
 * Footer, inside `<main id="main-content">`. `HowItWorksSection` is async
 * (Shiki highlighting of the two example responses); Hono's JSX renderer
 * awaits async components wherever they appear in the tree, so this
 * component itself stays a plain synchronous function (same pattern as
 * `FeaturesPage`/`InstallPage`).
 */
import { Footer } from "../components/Footer";
import { HowItWorksSection } from "../components/HowItWorks";
import { Nav } from "../components/Nav";
import { Layout } from "../layouts/Layout";

export interface HowItWorksPageProps {
  currentPath: string;
  version: string;
}

export function HowItWorksPage({ currentPath, version }: HowItWorksPageProps) {
  return (
    <Layout
      title="How It Works"
      description="Follow MCPVault search, batch read, and frontmatter update requests from prompt to tool response."
      canonical="https://mcpvault.org/how-it-works/"
      page="how-it-works"
      pageStylesheet="/styles/how-it-works.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <HowItWorksSection />
        <Footer />
      </main>
    </Layout>
  );
}
