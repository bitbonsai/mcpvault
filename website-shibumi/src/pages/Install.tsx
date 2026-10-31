/**
 * Install page. Ported from pages/install.astro.
 *
 * Composition matches the Astro source exactly: Nav, Terminal, Footer,
 * inside `<main id="main-content">`. `Terminal` is async (Shiki
 * highlighting of its three JSON config samples); Hono's JSX renderer
 * awaits async components wherever they appear in the tree, so this
 * component itself stays a plain synchronous function (same pattern as
 * `FeaturesPage`/`FeatureGrid`).
 */
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";
import { Terminal } from "../components/Terminal";
import { Layout } from "../layouts/Layout";

export interface InstallPageProps {
  currentPath: string;
  version: string;
}

export function InstallPage({ currentPath, version }: InstallPageProps) {
  return (
    <Layout
      title="Install"
      description="Configuration examples for running MCPVault with Claude Desktop, ChatGPT+, Claude Code, Gemini CLI, OpenCode, and OpenAI Codex."
      canonical="https://mcpvault.org/install/"
      page="install"
      pageStylesheet="/styles/install.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <Terminal />
        <Footer />
      </main>
    </Layout>
  );
}
