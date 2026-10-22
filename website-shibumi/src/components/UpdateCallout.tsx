/**
 * "Recent Updates" callout. Ported from UpdateCallout.astro.
 *
 * The expand/collapse toggle was a vanilla `<script>` in Astro
 * (`initUpdatesToggle`), toggling `aria-expanded` (plus the button's
 * `aria-label`/`title` and the `data-updates-label` span's text) and an
 * `is-collapsed`/`is-expanded` class pair on both the button and the
 * panel. Phase 3: that's now the `updatesCallout` Alpine.data() module
 * (`../client/updates-callout.ts`) -- `x-data` names it on the section
 * root, the button calls `toggle()` and binds `aria-expanded`/`class`/
 * `aria-label`/`title` to `expanded`, and the panel binds its own `class`
 * to the same property. Every attribute below is grammar the
 * `@alpinejs/csp` build's restricted evaluator accepts (bare identifiers,
 * ternaries, object literals with quoted hyphenated keys -- see
 * `Terminal.tsx`'s `{ 'is-copied': ... }` for the same pattern already
 * proven elsewhere -- and method calls with no arguments), never an
 * inline function body.
 *
 * The static markup below (`aria-expanded="false"`, `class="... is-
 * collapsed"`, the literal "Show full history" text) is the no-JS
 * fallback Alpine's `x-bind:*`/`x-text` only overwrite once it actually
 * hydrates -- same convention as `Nav.tsx`'s mobile menu. That fallback
 * state clips the older-updates list to `max-height: 2.5rem` with a
 * mask-image fade (`home.css`), not `display: none`, so the full list
 * stays in the DOM -- reachable by search engines, screen readers, Ctrl/
 * Cmd+F -- even with no JavaScript at all; only the visual reveal needs a
 * script, matching the original Astro behavior exactly.
 *
 * `lucide-react`'s `Rocket` is replaced with the audited `RocketIcon`.
 */
import { RocketIcon } from "./icons";

interface Update {
  version: string;
  date: string;
  body: unknown;
}

const OLDER_UPDATES: Update[] = [
  {
    version: "v0.15.0",
    date: "August 2026",
    body: (
      <>
        Added <code>--read-only</code> mode, which exposes read tools only and rejects all vault mutations (
        <a href="https://github.com/bitbonsai/mcpvault/issues/112" target="_blank" rel="noopener noreferrer">
          #112
        </a>
        , thanks @vdhome-dev)
      </>
    ),
  },
  {
    version: "v0.14.1",
    date: "August 2026",
    body: (
      <>
        Security: dotfiles and hidden directories are now denied at any vault depth, closing an extension-filter bypass (
        <a href="https://github.com/bitbonsai/mcpvault/pull/115" target="_blank" rel="noopener noreferrer">
          #115
        </a>
        , thanks @sadegh)
      </>
    ),
  },
  {
    version: "v0.14.0",
    date: "August 2026",
    body: (
      <>
        Added <code>get_note_outline</code> and <code>read_note_lines</code> for navigating and reading targeted sections of large notes without loading
        the full file (
        <a href="https://github.com/bitbonsai/mcpvault/pull/146" target="_blank" rel="noopener noreferrer">
          #146
        </a>
        , thanks @kartik7704)
      </>
    ),
  },
  {
    version: "v0.12.6",
    date: "August 2026",
    body: (
      <>
        Refreshed the MCP SDK and development toolchain, standardized the server package on npm, and removed its stale Bun lockfile. No runtime behavior
        changed (
        <a href="https://github.com/bitbonsai/mcpvault/pull/178" target="_blank" rel="noopener noreferrer">
          #178
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.12.5",
    date: "July 2026",
    body: (
      <>
        The server now exits cleanly when stdio clients disconnect or terminate, preventing orphaned MCPVault processes (
        <a href="https://github.com/bitbonsai/mcpvault/issues/159" target="_blank" rel="noopener noreferrer">
          #159
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.12.4",
    date: "July 2026",
    body: (
      <>
        New <code>wiki_link</code> tool reads Obsidian wiki links — <code>[[Note]]</code>, <code>[[Note|Display]]</code>, and path-qualified{" "}
        <code>[[folder/Note]]</code> — and returns the note ready for context, with alternative paths when a name is ambiguous (
        <a href="https://github.com/bitbonsai/mcpvault/pull/101" target="_blank" rel="noopener noreferrer">
          #101
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.12.3",
    date: "July 2026",
    body: (
      <>
        <code>wiki_link</code> lands (
        <a href="https://github.com/bitbonsai/mcpvault/pull/101" target="_blank" rel="noopener noreferrer">
          #101
        </a>
        , thanks @renoirb); Obsidian's <code>.trash/</code> is now excluded from all tools
      </>
    ),
  },
  {
    version: "v0.12.2",
    date: "July 2026",
    body: (
      <>
        <code>patch_note</code> no longer corrupts insertions containing <code>$</code> replacement patterns (
        <a href="https://github.com/bitbonsai/mcpvault/issues/149" target="_blank" rel="noopener noreferrer">
          #149
        </a>
        ), and paths that accidentally include the vault prefix (absolute or <code>~/</code>) are normalized to vault-relative (
        <a href="https://github.com/bitbonsai/mcpvault/issues/122" target="_blank" rel="noopener noreferrer">
          #122
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.12.1",
    date: "June 2026",
    body: (
      <>
        Security: frontmatter parsing moved off <code>js-yaml</code> 3.x (CVE-2023-44270) to the <code>yaml</code> package
      </>
    ),
  },
  {
    version: "v0.12.0",
    date: "June 2026",
    body: (
      <>
        <code>search_notes</code> now accepts <code>pathPrefix</code> and <code>excludePaths</code> to scope searches to (or away from) vault subtrees (
        <a href="https://github.com/bitbonsai/mcpvault/issues/126" target="_blank" rel="noopener noreferrer">
          #126
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.5",
    date: "June 2026",
    body: (
      <>
        Security: restricted directories (<code>.git</code>, <code>.obsidian</code>, <code>node_modules</code>) now denied at any depth (
        <a href="https://github.com/bitbonsai/mcpvault/security/advisories/GHSA-9c83-rr99-vfwj" target="_blank" rel="noopener noreferrer">
          GHSA-9c83
        </a>
        ); write errors classified by error code, not message (
        <a href="https://github.com/bitbonsai/mcpvault/issues/109" target="_blank" rel="noopener noreferrer">
          #109
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.4",
    date: "June 2026",
    body: (
      <>
        Security: deny-list matching is now case-insensitive with canonicalized trailing dots/spaces (
        <a href="https://github.com/bitbonsai/mcpvault/security/advisories/GHSA-j99q-93c9-h869" target="_blank" rel="noopener noreferrer">
          GHSA-j99q
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.3",
    date: "June 2026",
    body: (
      <>
        Missing <code>path</code> arguments return a clear error instead of a <code>TypeError</code> (
        <a href="https://github.com/bitbonsai/mcpvault/issues/107" target="_blank" rel="noopener noreferrer">
          #107
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.2",
    date: "April 2026",
    body: (
      <>
        <code>delete_note</code> now supports soft-delete with <code>trashMode</code>: <code>none</code> (permanent), <code>local</code> (move to{" "}
        <code>.trash/</code> inside vault), or <code>system</code> (OS trash). (
        <a href="https://github.com/bitbonsai/mcpvault/issues/91" target="_blank" rel="noopener noreferrer">
          #91
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.1",
    date: "April 2026",
    body: (
      <>
        Frontmatter updates now use AST-aware YAML preservation. Unmodified fields keep their original formatting: plain dates stay as{" "}
        <code>YYYY-MM-DD</code>, quoted strings keep their quotes, and <code>HH:MM</code> values are no longer misread as sexagesimal integers. (
        <a href="https://github.com/bitbonsai/mcpvault/issues/77" target="_blank" rel="noopener noreferrer">
          #77
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.11.0",
    date: "March 2026",
    body: (
      <>
        New <code>list_all_tags</code> tool scans the vault for all frontmatter tags and inline <code>#hashtags</code> with occurrence counts. Obsidian
        skill now routes to CLI for active file, daily notes, backlinks, and open-in-editor. (
        <a href="https://github.com/bitbonsai/mcpvault/issues/80" target="_blank" rel="noopener noreferrer">
          #80
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.10.0",
    date: "March 2026",
    body: (
      <>
        New <code>createServer()</code> factory for library consumers. TypeScript declarations exported. (
        <a href="https://github.com/bitbonsai/mcpvault/issues/84" target="_blank" rel="noopener noreferrer">
          #84
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.9.1",
    date: "March 2026",
    body: (
      <>
        Security fix: symlinks inside the vault that point outside the vault boundary are now blocked. (
        <a href="https://github.com/bitbonsai/mcpvault/issues/78" target="_blank" rel="noopener noreferrer">
          #78
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.9.0",
    date: "March 2026",
    body: (
      <>
        Package renamed to <code>@bitbonsai/mcpvault</code> on npm at Obsidian's request. Update your config: replace <code>mcpvault</code> with{" "}
        <code>@bitbonsai/mcpvault</code>.
      </>
    ),
  },
  {
    version: "v0.8.2",
    date: "March 2026",
    body: (
      <>
        Trailing-slash vault paths no longer truncate search results (
        <a href="https://github.com/bitbonsai/mcpvault/pull/48" target="_blank" rel="noopener noreferrer">
          PR #48
        </a>
        ), <code>get_vault_stats</code> now handles dotted folder names correctly (
        <a href="https://github.com/bitbonsai/mcpvault/pull/42" target="_blank" rel="noopener noreferrer">
          PR #42
        </a>
        ), note tools now support <code>.base</code> and <code>.canvas</code> (
        <a href="https://github.com/bitbonsai/mcpvault/pull/53" target="_blank" rel="noopener noreferrer">
          PR #53
        </a>
        ), string frontmatter inputs are now handled safely (
        <a href="https://github.com/bitbonsai/mcpvault/pull/47" target="_blank" rel="noopener noreferrer">
          PR #47
        </a>
        ), vault path is now optional for CLI usage (defaults to current working directory) (
        <a href="https://github.com/bitbonsai/mcpvault/issues/50" target="_blank" rel="noopener noreferrer">
          #50
        </a>
        ), and dependency refreshes for the MCP SDK and Node types are merged (
        <a href="https://github.com/bitbonsai/mcpvault/pull/43" target="_blank" rel="noopener noreferrer">
          PR #43
        </a>
        ,{" "}
        <a href="https://github.com/bitbonsai/mcpvault/pull/44" target="_blank" rel="noopener noreferrer">
          PR #44
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.8.1",
    date: "",
    body: (
      <>
        Multi-word BM25 search relevance improvements (
        <a href="https://github.com/bitbonsai/mcpvault/pull/38" target="_blank" rel="noopener noreferrer">
          PR #38
        </a>
        ), patch_note undefined/null validation hardening (
        <a href="https://github.com/bitbonsai/mcpvault/pull/37" target="_blank" rel="noopener noreferrer">
          PR #37
        </a>
        ), new <code>move_file</code> tool for binary-safe file moves with explicit path confirmation, binary filenames now visible in directory listings (
        <a href="https://github.com/bitbonsai/mcpvault/issues/21" target="_blank" rel="noopener noreferrer">
          #21
        </a>
        )
      </>
    ),
  },
  {
    version: "v0.7.5",
    date: "",
    body: <>Search now matches note filenames, hidden directories filtered from listings, OpenCode install docs</>,
  },
  {
    version: "v0.7.4",
    date: "",
    body: <>New get_vault_stats tool + improved error messages with remediation suggestions</>,
  },
  {
    version: "v0.7.3",
    date: "",
    body: (
      <>
        Bug fix for folder detection with dots in names + dependency updates{" "}
        <a href="https://github.com/bitbonsai/mcpvault/pull/15" target="_blank" rel="noopener noreferrer">
          (PR #15)
        </a>
      </>
    ),
  },
  {
    version: "v0.7.2",
    date: "",
    body: (
      <>
        Security hardening - TOCTOU fixes, regex injection prevention, comprehensive CI/CD{" "}
        <a href="https://github.com/bitbonsai/mcpvault/pull/12" target="_blank" rel="noopener noreferrer">
          (PR #12)
        </a>
      </>
    ),
  },
];

export function UpdateCallout() {
  return (
    <section data-component="update-callout" x-data="updatesCallout">
      <div class="callout-inner">
        <div class="callout-icon">
          <RocketIcon className="icon" />
        </div>
        <div class="callout-body">
          <div class="updates-heading">
            <h3>
              Recent updates <span class="version-pill">v0.16.0</span>
            </h3>
            <button
              type="button"
              class="updates-toggle updates-toggle-compact"
              data-updates-toggle
              aria-expanded="false"
              aria-controls="older-updates"
              aria-label="Show full history"
              title="Show full history"
              x-on:click="toggle()"
              x-bind:aria-expanded="expanded"
              x-bind:class="{ 'is-expanded': expanded }"
              x-bind:aria-label="expanded ? 'Show less' : 'Show full history'"
              x-bind:title="expanded ? 'Show less' : 'Show full history'"
            >
              <span class="sr-only" data-updates-label x-text="expanded ? 'Show less' : 'Show full history'">
                Show full history
              </span>
              <svg class="updates-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>
          </div>

          <p class="latest-update">
            <span class="entry-version">v0.16.0 (August 2026):</span> Moved to <strong>MCP v2</strong>, the official SDK for the 2026-07-28 specification. One
            process accepts both protocol generations, with no material slowdown in our <a href="/benchmarks/">benchmarks</a>.
          </p>

          <div id="older-updates" class="older-updates is-collapsed" data-updates-panel x-bind:class="{ 'is-expanded': expanded, 'is-collapsed': !expanded }">
            <ul>
              {OLDER_UPDATES.map((update) => (
                <li>
                  <span class="entry-version">
                    {update.version}
                    {update.date ? ` (${update.date})` : ""}:
                  </span>{" "}
                  {update.body}
                </li>
              ))}
            </ul>

            <a href="https://github.com/bitbonsai/mcpvault/blob/main/CHANGELOG.md" target="_blank" rel="noopener noreferrer" class="updates-changelog-link">
              <svg class="updates-changelog-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77 5.44 5.44 0 0 0 3.5 8.5c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
              </svg>
              See full changelog
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
