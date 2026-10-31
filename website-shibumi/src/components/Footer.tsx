/**
 * Site footer. Ported from Footer.astro; static markup, no client behavior.
 */
import { BrandMark } from "./BrandMark";
import { GitHubIcon, NpmIcon } from "./icons";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer data-component="footer">
      <div class="footer-inner">
        <div class="footer-grid">
          <div class="footer-brand-col">
            <div class="footer-brand">
              <span class="footer-logo-icon">
                <BrandMark idSuffix="footer" />
              </span>
              <span class="footer-brand-name">MCPVault</span>
            </div>
            <p class="footer-tagline">A local MCP server for reading, searching, and editing Obsidian vaults.</p>
            <div class="footer-links-row">
              <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="footer-icon-link">
                <GitHubIcon className="icon" />
                <span class="label">GitHub Repository</span>
              </a>
              <a href="https://www.npmjs.com/package/@bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="footer-icon-link">
                <NpmIcon className="icon" />
                <span class="label">npm package</span>
              </a>
            </div>
          </div>

          <div>
            <h3>Quick Links</h3>
            <div class="footer-link-list">
              <a href="/install/">Installation</a>
              <a href="/demo/">Demo</a>
              <a href="/features/">Features</a>
              <a href="/how-it-works/">How It Works</a>
              <a href="/skill/">Skill</a>
            </div>
          </div>

          <div>
            <h3>Community</h3>
            <div class="footer-link-list">
              <a href="https://github.com/bitbonsai/mcpvault/issues" target="_blank" rel="noopener noreferrer">
                Issues & Support
              </a>
              <a href="https://github.com/bitbonsai/mcpvault/discussions" target="_blank" rel="noopener noreferrer">
                Discussions
              </a>
              <a href="https://github.com/bitbonsai/mcpvault/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer">
                Changelog
              </a>
              <a href="https://github.com/bitbonsai/mcpvault#contributing" target="_blank" rel="noopener noreferrer">
                Contributing
              </a>
              <a href="https://github.com/bitbonsai" target="_blank" rel="noopener noreferrer">
                bitbonsai
              </a>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <p class="footer-copyright">© {year} bitbonsai. Released under the MIT License.</p>
          <p class="footer-credit">Built for the Obsidian community</p>
          <p class="footer-credit">
            Built with <a href="https://shibumistack.dev" target="_blank" rel="noopener noreferrer" class="footer-stack-link">Shibumi Stack</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
