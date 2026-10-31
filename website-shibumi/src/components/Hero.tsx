/**
 * Hero section. Ported from Hero.astro.
 *
 * Content fix (Phase 0 finding): the npm downloads badge anchor pointed at
 * the nonexistent unscoped `npmjs.com/package/mcpvault` -- the package is
 * published as `@bitbonsai/mcpvault`. Pointing the link at the scoped
 * package fixes a dead link; the badge image itself already used the
 * correct `/api/downloads.json` endpoint and was left unchanged.
 *
 * `lucide-react`'s `Rocket` is replaced with the audited `RocketIcon`
 * (icons.tsx); the "Get Started" button's arrow glyph and the GitHub mark
 * were already raw inline `<svg>` in the Astro source (not lucide-react),
 * so they are ported as-is -- the GitHub mark reuses `GitHubIcon` since
 * it's the identical path data already audited for Nav/Footer.
 */
import { GitHubIcon, RocketIcon } from "./icons";

export interface HeroProps {
  version: string;
}

export function Hero({ version }: HeroProps) {
  return (
    <section data-component="hero">
      <div class="hero-gradient" aria-hidden="true"></div>

      <div class="hero-content">
        <div class="floating-badges">
          <span class="badge">
            <span class="badge-dot"></span>
            v{version}
          </span>
          <span class="badge">MIT License</span>
          <span class="badge">Free</span>
        </div>

        <h1 class="hero-title">
          <span class="gradient-text">
            AI + Obsidian = <RocketIcon className="hero-title-icon" />
          </span>
        </h1>

        <p class="hero-tagline">Connect MCP clients to your Obsidian vault.</p>

        <p class="hero-subtext">MCPVault reads, searches, and edits local vault files. Obsidian can stay closed, and frontmatter updates preserve existing formatting.</p>

        <div class="hero-cta">
          <a href="/install/" class="btn-primary">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
            Install MCPVault
          </a>
          <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="btn-secondary">
            <GitHubIcon className="icon" />
            View on GitHub
          </a>
        </div>

        <div class="hero-video-block">
          <div class="video-container">
            <div class="video-aspect-ratio">
              <video id="hero-video" controls autoplay loop muted playsinline preload="metadata" width="1152" height="720" poster="/video-poster-small.webp">
                <source src="/mcp-obsidian-1-min.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>

          <div class="support-badges">
            <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/github/stars/bitbonsai/mcpvault?style=flat&logo=github&logoColor=white&color=9065ea&labelColor=262626" alt="GitHub Stars" loading="lazy" />
            </a>
            <a href="https://www.npmjs.com/package/@bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/npm/v/%40bitbonsai%2Fmcpvault?style=flat&logo=npm&logoColor=white&color=9065ea&labelColor=262626" alt="npm version" loading="lazy" />
            </a>
            <a href="https://www.npmjs.com/package/@bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/endpoint?url=https%3A%2F%2Fmcpvault.org%2Fapi%2Fdownloads.json&style=flat&logo=npm&logoColor=white&color=9065ea&labelColor=262626" alt="npm downloads" loading="lazy" />
            </a>
            <a href="https://github.com/sponsors/bitbonsai" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/github/sponsors/bitbonsai?style=flat&logo=github&logoColor=white&color=9065ea&labelColor=262626" alt="GitHub Sponsors" loading="lazy" />
            </a>
            <a href="https://ko-fi.com/bitbonsai" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/badge/Ko--fi-Support-9065ea?style=flat&logo=ko-fi&logoColor=white&labelColor=262626" alt="Ko-fi" loading="lazy" />
            </a>
            <a href="https://liberapay.com/bitbonsai/" target="_blank" rel="noopener noreferrer">
              <img src="https://img.shields.io/badge/Liberapay-Weekly-9065ea?style=flat&logo=liberapay&logoColor=white&labelColor=262626" alt="Liberapay" loading="lazy" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
