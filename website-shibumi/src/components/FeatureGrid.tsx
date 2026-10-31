/**
 * "Core Features" bento grid. Ported from FeatureGrid.astro. `FeatureCard`
 * is async (Shiki highlighting on the large card), so this component is
 * async too and awaits each card explicitly before composing the grid --
 * Hono JSX does not auto-await elements nested inside `.map()`.
 */
import { FeatureCard } from "./FeatureCard";

const SEARCH_CODE_EXAMPLE = `[
  {
    "p": "Notes/GTD.md",
    "t": "GTD",
    "ex": "...getting things done...",
    "mc": 5,
    "ln": 12
  },
  {
    "p": "Books/Deep Work.md",
    "t": "Deep Work",
    "ex": "...focus and productivity...",
    "mc": 8,
    "ln": 45
  }
]`;

const FRONTMATTER_EXAMPLE = `{
  "status": "completed",
  "tags": ["web", "typescript"],
  "completed": "2025-01-20"
}`;

export async function FeatureGrid() {
  const cards = await Promise.all([
    FeatureCard({
      title: "Full-text search",
      description: "Search matches note filenames and content, supports multiple words, and ranks results with BM25.",
      icon: "search",
      size: "large",
      accent: true,
      codeExample: SEARCH_CODE_EXAMPLE,
    }),
    FeatureCard({
      title: "Frontmatter updates",
      description: "AST-aware YAML updates preserve raw formatting for unmodified fields. Dates, quotes, and time values keep their original form while only changed keys are rewritten.",
      icon: "shield",
      size: "medium",
      codeExample: FRONTMATTER_EXAMPLE,
    }),
    FeatureCard({
      title: "Note and file operations",
      description: "Tools read, write, patch, move, list, and delete notes. Patch updates replace exact text instead of rewriting full files.",
      icon: "file",
      size: "medium",
    }),
    FeatureCard({
      title: "Vault boundary",
      description: "Path checks block traversal, symlink escapes, dotfiles, .obsidian, .git, and node_modules.",
      icon: "vault",
      size: "medium",
    }),
    FeatureCard({
      title: "Runs on Node.js",
      description: "MCP clients launch the server as a local Node.js process over stdio.",
      icon: "node",
      size: "small",
    }),
    FeatureCard({
      title: "Compact responses",
      description: "Search and batch responses use short field names by default. prettyPrint returns expanded output when needed.",
      icon: "tokens",
      size: "small",
    }),
    FeatureCard({
      title: "TypeScript API",
      description: "The package exports TypeScript declarations and public types for library use.",
      icon: "typescript",
      size: "small",
    }),
    FeatureCard({
      title: "MIT licensed",
      description: "Source code, tests, and issue tracking are public on GitHub.",
      icon: "heart",
      size: "small",
    }),
    FeatureCard({
      title: "18 MCP tools",
      description: "Tools cover note reads and writes, exact patches, file moves, search, tags, frontmatter, outlines, line ranges, and vault statistics.",
      icon: "toolkit",
      size: "medium",
    }),
    FeatureCard({
      title: "MCP client support",
      description: "Setup guides cover Claude Desktop, ChatGPT+ Desktop, Claude Code, OpenCode, Gemini CLI, OpenAI Codex, Cursor, Windsurf, and IntelliJ.",
      icon: "platform",
      size: "medium",
    }),
  ]);

  return (
    <section data-component="feature-grid" aria-labelledby="feature-grid-heading">
      <div class="feature-grid-inner">
        <div class="feature-grid-header fade-in-on-scroll">
          <h2 id="feature-grid-heading" class="feature-grid-title">
            Core features
          </h2>
          <p class="feature-grid-lede">MCPVault works directly with vault files. These tools and path checks define what clients can do with them.</p>
        </div>

        <div class="feature-grid">{cards}</div>
      </div>
    </section>
  );
}
