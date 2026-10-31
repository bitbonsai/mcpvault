/**
 * Skill page. Ported from pages/skill.astro.
 *
 * Composition matches the Astro source exactly: Nav, SkillsContent,
 * Footer, inside `<main id="main-content">`. `SkillsContent` has no async
 * work (no Shiki highlighting, unlike Features/Install/HowItWorks), so it
 * stays a plain synchronous function like `Nav`/`Footer`.
 */
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";
import { SkillsContent } from "../components/SkillsContent";
import { Layout } from "../layouts/Layout";

export interface SkillPageProps {
  currentPath: string;
  version: string;
}

export function SkillPage({ currentPath, version }: SkillPageProps) {
  return (
    <Layout
      title="Skill"
      description="Install an Obsidian skill that routes file operations to MCPVault, app actions to Obsidian CLI, and sync tasks to Git."
      canonical="https://mcpvault.org/skill/"
      page="skill"
      pageStylesheet="/styles/skill.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content">
        <SkillsContent />
        <Footer />
      </main>
    </Layout>
  );
}
