/**
 * Features page. Ported from pages/features.astro.
 *
 * Composition matches the Astro source exactly: Nav, FeatureGrid,
 * ComparisonTable, FAQ, Footer, in that order, inside
 * `<main id="main-content">`. `FeatureGrid` is async (Shiki highlighting on
 * its large card); Hono's JSX renderer awaits async components wherever
 * they appear in the tree, so this component itself stays a plain
 * synchronous function.
 */
import { ComparisonTable } from "../components/ComparisonTable";
import { FAQ } from "../components/FAQ";
import { FeatureGrid } from "../components/FeatureGrid";
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";
import { Layout } from "../layouts/Layout";

export interface FeaturesPageProps {
  currentPath: string;
  version: string;
}

export function FeaturesPage({ currentPath, version }: FeaturesPageProps) {
  return (
    <Layout
      title="Features"
      description="Review MCPVault search, frontmatter, file tools, path restrictions, supported clients, and access methods."
      canonical="https://mcpvault.org/features/"
      page="features"
      pageStylesheet="/styles/features.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <FeatureGrid />
        <ComparisonTable />
        <FAQ />
        <Footer />
      </main>
    </Layout>
  );
}
