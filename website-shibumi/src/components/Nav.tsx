/**
 * Site navigation. Ported from Nav.astro.
 *
 * Active-link highlighting was client JS in Astro (`updateActiveNav`,
 * comparing `window.location.pathname`); here it is computed server-side
 * from `currentPath`, which every request already has, so it works with
 * no JavaScript and needs no hydration.
 *
 * The mobile menu button/panel is wired to the `nav` Alpine.data() module
 * (`../client/nav.ts`, Phase 3): `x-data="nav"` on the root, `toggle()` on
 * the button, `x-bind:hidden="!open"` on the panel (the boolean attribute
 * itself, not a `.hidden` class -- see `nav.ts` for why), and
 * `x-on:click.outside="close()"` on the root so clicking anywhere else
 * closes an open menu. Every mobile link also calls `close()` on click, so
 * navigating away doesn't leave the panel open on `astro:page-load`-style
 * back/forward restores. Without JavaScript the panel stays exactly as
 * server-rendered: present in the DOM with a real `hidden` attribute.
 */
import { BrandMark } from "./BrandMark";
import { GitHubIcon, MenuIcon } from "./icons";

export interface NavLink {
  href: string;
  label: string;
  /** Compact label swapped in at tight desktop widths (CSS-driven). */
  shortLabel?: string;
  isNew?: boolean;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/install/", label: "Install" },
  { href: "/features/", label: "Features" },
  { href: "/demo/", label: "Demo" },
  { href: "/how-it-works/", label: "How It Works", shortLabel: "How" },
  { href: "/skill/", label: "Skill" },
];

export interface NavProps {
  currentPath: string;
  version: string;
}

function isActive(currentPath: string, href: string): boolean {
  const normalizedCurrentPath = currentPath.replace(/\/$/, "") || "/";
  const normalizedHref = href.replace(/\/$/, "") || "/";
  return normalizedCurrentPath === normalizedHref;
}

export function Nav({ currentPath, version }: NavProps) {
  return (
    <nav data-component="nav" x-data="nav" {...{ "x-on:click.outside": "close()" }}>
      <div class="nav-inner">
        <div class="nav-row">
          <a href="/" class="logo-link">
            <span class="logo-icon">
              <BrandMark idSuffix="logo" />
            </span>
            <span class="logo-text">MCPVault</span>
            <span class="version-badge">v{version}</span>
          </a>

          <div class="nav-links">
            {NAV_LINKS.map((link) => (
              <a href={link.href} class={`nav-link${isActive(currentPath, link.href) ? " nav-link-active" : ""}`}>
                <span class="nav-link-label">
                  {link.shortLabel ? (
                    <>
                      <span class="nav-label-full">{link.label}</span>
                      <span class="nav-label-short" aria-hidden="true">{link.shortLabel}</span>
                    </>
                  ) : (
                    link.label
                  )}
                  {link.isNew ? <span class="nav-badge-new">NEW</span> : null}
                </span>
              </a>
            ))}
            <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="nav-link nav-icon-link">
              <GitHubIcon className="icon" />
              GitHub
            </a>
          </div>

          <button
            class="mobile-menu-button"
            id="mobile-menu-button"
            aria-label="Toggle mobile menu"
            aria-expanded="false"
            aria-controls="mobile-menu"
            x-on:click="toggle()"
            x-bind:aria-expanded="open"
          >
            <MenuIcon className="icon" />
          </button>
        </div>
      </div>

      <div class="mobile-menu" id="mobile-menu" hidden x-bind:hidden="!open">
        <div class="mobile-menu-inner">
          {NAV_LINKS.map((link) => (
            <a href={link.href} class={`nav-link${isActive(currentPath, link.href) ? " nav-link-active" : ""}`} x-on:click="close()">
              <span class="nav-link-label">
                {link.label}
                {link.isNew ? <span class="nav-badge-new">NEW</span> : null}
              </span>
            </a>
          ))}
          <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="nav-link nav-icon-link" x-on:click="close()">
            <GitHubIcon className="icon" />
            GitHub
          </a>
        </div>
      </div>
    </nav>
  );
}
