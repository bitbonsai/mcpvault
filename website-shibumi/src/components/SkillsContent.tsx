/**
 * Skill page body. Ported from SkillsContent.astro.
 *
 * No `lucide-react` import in the Astro source -- every icon here was
 * already raw inline `<svg>` markup (routing-matrix checkmarks are plain
 * Unicode glyphs, not icons at all). Per the same precedent as
 * HowItWorks.tsx/ComparisonTable.tsx's CTA bolt icon, these stay literal
 * inline `<svg>` rather than moving into `icons.tsx` -- that module exists
 * to de-duplicate actual `lucide-react` replacements, not to collect every
 * raw SVG in the app. The one exception is the install-command copy
 * button's icon: it is byte-for-byte the same markup `icons.tsx` already
 * centralized as `CopyIcon` for `Terminal.tsx`'s 8+ copy buttons, so this
 * is simply its 9th call site.
 *
 * Every icon here sits directly beside visible text (a heading, a link
 * label, or an `aria-label` on the button), so each gets an explicit
 * `aria-hidden="true"` -- same reasoning as every other decorative icon in
 * this app.
 *
 * The copy button intentionally carries no inline `<script>` (the Astro
 * source's `astro:page-load` listener is dropped): Phase 3 wires every
 * `.copy-btn` in the app through a single named Alpine module, matching
 * `Terminal.tsx`'s `copy-code-btn copy-btn` / `data-copy` convention. The
 * button still renders and is keyboard-focusable with no JS; only the
 * clipboard write itself is deferred.
 *
 * `class:list` (the two-tone Routing Matrix rows) becomes a CSS
 * `:nth-child(odd)` rule (skill.css) instead of a per-row computed
 * className, matching `FeatureGrid.tsx`'s existing `:nth-child` precedent
 * for the same kind of "alternate visual treatment by position" logic.
 *
 * No raw HTML: every string below is a plain JSX text child, escaped by
 * Hono's JSX renderer like any other text.
 */
import { CopyIcon } from "./icons";

interface RoutingRow {
  operation: string;
  mcp: boolean;
  app: boolean;
  git: boolean;
  notes: string;
}

const ROUTES: RoutingRow[] = [
  { operation: "Read note", mcp: true, app: false, git: false, notes: "Vault-scoped read via MCP" },
  { operation: "Write / patch note", mcp: true, app: false, git: false, notes: "Validated writes through MCPVault" },
  { operation: "Search vault", mcp: true, app: false, git: false, notes: "BM25-ranked full-text search" },
  {
    operation: "Resolve [[wiki links]]",
    mcp: true,
    app: false,
    git: false,
    notes: "wiki_link picks the shallowest match first, then locale-sorts equal-depth paths; other matches are returned as alternatives",
  },
  { operation: "Manage tags / frontmatter", mcp: true, app: false, git: false, notes: "Frontmatter merge through MCP" },
  {
    operation: "Move / rename notes",
    mcp: true,
    app: false,
    git: false,
    notes: "MCP move followed by explicit backlink search, repair, and verification",
  },
  { operation: "Open note in Obsidian", mcp: false, app: true, git: false, notes: "Requires the desktop app running" },
  { operation: "Trigger plugin commands", mcp: false, app: true, git: false, notes: "Workspace actions, plugin APIs" },
  { operation: "Export to PDF", mcp: false, app: true, git: false, notes: "App-level rendering pipeline" },
  { operation: "Sync vault across devices", mcp: false, app: false, git: true, notes: "Git commit, pull, and push" },
  { operation: "Automated backup", mcp: false, app: false, git: true, notes: "Cron / launchd, no UI needed" },
];

interface Workflow {
  title: string;
  description: string;
  steps: string[];
  icon: string;
}

const WORKFLOWS: Workflow[] = [
  {
    title: "Search, then open",
    description: "Search for a note through MCP, read it, then open it in Obsidian for visual editing.",
    steps: ["MCP: search_notes", "MCP: read_note", "App: open in Obsidian"],
    icon: "1",
  },
  {
    title: "Choose a backend",
    description:
      "File operations use MCPVault. Actions that need the running app use Obsidian CLI, with obsidian:// URIs as fallback.",
    steps: ["Read the request", "Choose MCP or Obsidian CLI", "Run the operation"],
    icon: "2",
  },
  {
    title: "Review and patch",
    description: "Write a draft via MCP, review in Obsidian, then patch corrections back through MCP.",
    steps: ["MCP: write_note", "App: review in editor", "MCP: patch_note"],
    icon: "3",
  },
];

interface SafetyRule {
  title: string;
  description: string;
}

const SAFETY_RULES: SafetyRule[] = [
  {
    title: "Prefer MCP Writes",
    description: "File mutations go through MCPVault path validation. Destructive tools require explicit confirmation parameters.",
  },
  {
    title: "Confirm Destructive Actions",
    description: "Deletes and moves require explicit path confirmation parameters, preventing accidental data loss.",
  },
  {
    title: "Structured command arguments",
    description: "Commands pass argument arrays instead of building shell command strings from note content.",
  },
  {
    title: "Sandbox by Default",
    description: "MCP tools are scoped to the vault root. Path traversal is blocked at the server level.",
  },
];

interface Trigger {
  phrase: string;
  backend: string;
}

const TRIGGERS: Trigger[] = [
  { phrase: "search my vault for...", backend: "MCP" },
  { phrase: "update the frontmatter on...", backend: "MCP" },
  { phrase: "tag all notes about...", backend: "MCP" },
  { phrase: "open this note in Obsidian", backend: "Obsidian CLI" },
  { phrase: "sync my vault", backend: "Git CLI" },
  { phrase: "use git to store my vault", backend: "Git CLI" },
  { phrase: "move this note to...", backend: "MCP + backlink repair" },
];

const SYNC_FLOW: string[] = [
  "Preflight: verify git, repo, identity, and remote",
  "Ask one targeted question if setup is incomplete",
  "Run: git add -A → git commit (if changes) → git pull --rebase → git push",
  "Stop on conflicts and provide manual next steps",
];

interface ConversationTurn {
  role: string;
  text: string;
}

const EXAMPLE_CONVERSATION: ConversationTurn[] = [
  { role: "User", text: "Use git to store my vault and keep it synced." },
  { role: "Skill", text: "I will run a git preflight first (git, repo, identity, remote), then set up anything missing with one targeted question." },
  { role: "Skill", text: "Preflight OK. Running sync: git add -A → git commit (if changes) → git pull --rebase → git push." },
  { role: "Skill", text: "Done. Vault synced to origin/main. No force push used." },
];

const NEGATIVE_TRIGGERS: string[] = ["General markdown editing (no vault context)", "Non-Obsidian file management", "Web-based Obsidian Publish tasks"];

const INSTALL_CMD = "npx skills add bitbonsai/mcpvault";

interface MiniFeature {
  iconPath: string;
  title: string;
  desc: string;
}

const MINI_FEATURES: MiniFeature[] = [
  {
    iconPath: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
    title: "Search notes",
    desc: "Full-text search matches filenames and content, then ranks results with BM25.",
  },
  {
    iconPath: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z",
    title: "Manage tags and frontmatter",
    desc: "Add or remove tags, and update frontmatter fields without rewriting note content.",
  },
  {
    iconPath: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    title: "Edit notes through MCPVault",
    desc: "Read, write, and patch tools validate paths against the configured vault root.",
  },
  {
    iconPath: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    title: "Run Git sync",
    desc: "Optional Git commands commit, pull, and push a vault after checking repository setup.",
  },
];

function RoutingCell({ enabled }: { enabled: boolean }) {
  return enabled ? <span class="skill-routing-check">✓</span> : <span class="skill-routing-dash">—</span>;
}

function CollapsibleChevron() {
  return (
    <svg class="icon skill-collapsible-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function SkillsContent() {
  return (
    <section data-component="skill-content" aria-labelledby="skill-heading">
      <div class="skill-inner">
        {/* Hero */}
        <div class="skill-hero fade-in-on-scroll">
          <h1 id="skill-heading" class="skill-hero-title">
            Obsidian Skill
          </h1>
          <p class="skill-hero-lede">
            Routes file operations to MCPVault, app actions to Obsidian CLI, and sync tasks to Git.
          </p>
        </div>

        {/* Install command with copy button */}
        <div class="skill-install fade-in-on-scroll">
          <div class="skill-install-card">
            <div class="skill-install-header">
              <span class="skill-install-header-label">
                Install with one command via{" "}
                <a href="https://skills.sh" target="_blank" rel="noopener noreferrer" class="skill-link">
                  skills.sh
                </a>
              </span>
            </div>
            <div class="skill-install-row">
              <code class="skill-install-cmd">{INSTALL_CMD}</code>
              <button type="button" class="skill-copy-btn copy-btn" data-copy={INSTALL_CMD} title="Copy command" aria-label="Copy command to clipboard">
                <CopyIcon className="icon" />
                <span class="skill-copy-text">Copy</span>
              </button>
            </div>
          </div>

          <div class="skill-mini-grid">
            {MINI_FEATURES.map((card) => (
              <div class="skill-mini-card">
                <div class="skill-mini-card-row">
                  <div class="skill-mini-icon">
                    <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={card.iconPath} />
                    </svg>
                  </div>
                  <div>
                    <h3 class="skill-mini-card-title">{card.title}</h3>
                    <p class="skill-mini-card-desc">{card.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Routing Matrix */}
        <div class="skill-routing fade-in-on-scroll">
          <h2 class="skill-section-title">Routing Matrix</h2>
          <p class="skill-section-lede">Each operation maps to exactly one backend. The skill picks the right one automatically.</p>

          <div class="skill-routing-card">
            <div class="skill-routing-scroll">
              <table class="skill-routing-table">
                <thead>
                  <tr class="skill-routing-head-row">
                    <th class="skill-routing-head-cell skill-routing-head-cell--operation">Operation</th>
                    <th class="skill-routing-head-cell skill-routing-head-cell--center">MCP</th>
                    <th class="skill-routing-head-cell skill-routing-head-cell--center">Obsidian CLI</th>
                    <th class="skill-routing-head-cell skill-routing-head-cell--center">Git</th>
                    <th class="skill-routing-head-cell skill-routing-head-cell--notes">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTES.map((route) => (
                    <tr class="skill-routing-row">
                      <td class="skill-routing-cell skill-routing-cell--operation">{route.operation}</td>
                      <td class="skill-routing-cell skill-routing-cell--center">
                        <RoutingCell enabled={route.mcp} />
                      </td>
                      <td class="skill-routing-cell skill-routing-cell--center">
                        <RoutingCell enabled={route.app} />
                      </td>
                      <td class="skill-routing-cell skill-routing-cell--center">
                        <RoutingCell enabled={route.git} />
                      </td>
                      <td class="skill-routing-cell skill-routing-cell--notes">{route.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Flow Cheat Sheet */}
        <div class="skill-cheatsheet fade-in-on-scroll">
          <h2 class="skill-section-title">Flow Cheat Sheet</h2>
          <p class="skill-section-lede">The requested operation determines whether the skill uses MCPVault, Obsidian CLI, or Git.</p>
          <div class="skill-cheatsheet-grid">
            <div class="skill-card">
              <h3 class="skill-card-title">Intent Routing</h3>
              <div class="skill-numbered-list">
                <div class="skill-numbered-row">
                  <span class="skill-numbered-index">1.</span>
                  <span class="skill-numbered-text">
                    If the user asks to read/write/search notes, route to <strong class="skill-strong">MCP tools</strong>.
                  </span>
                </div>
                <div class="skill-numbered-row">
                  <span class="skill-numbered-index">2.</span>
                  <span class="skill-numbered-text">
                    If they ask to open or trigger app-level behavior, route to <strong class="skill-strong">Obsidian context</strong>.
                  </span>
                </div>
                <div class="skill-numbered-row">
                  <span class="skill-numbered-index">3.</span>
                  <span class="skill-numbered-text">
                    If they ask to sync/backup/store with git, route to <strong class="skill-strong">Git CLI</strong>.
                  </span>
                </div>
              </div>
            </div>
            <div class="skill-card">
              <h3 class="skill-card-title">Git Sync Flow</h3>
              <div class="skill-numbered-list">
                {SYNC_FLOW.map((step, i) => (
                  <div class="skill-numbered-row">
                    <span class="skill-numbered-index">{i + 1}.</span>
                    <span class="skill-numbered-text">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Expandable flow playbook */}
        <div class="skill-playbook fade-in-on-scroll">
          <details class="skill-collapsible">
            <summary class="skill-collapsible-summary">
              <div>
                <h3 class="skill-collapsible-title">Expanded Flow Playbook</h3>
                <p class="skill-collapsible-subtitle">Open for routing rules, preflight logic, and an end-to-end example</p>
              </div>
              <CollapsibleChevron />
            </summary>
            <div class="skill-collapsible-body">
              <div class="skill-playbook-block">
                <h4 class="skill-playbook-heading">Routing defaults</h4>
                <ul class="skill-bullet-list">
                  <li class="skill-bullet-row">
                    <span class="skill-bullet-mark">-</span>
                    <span>
                      <strong class="skill-strong">MCP first</strong> for read/write/search/frontmatter/tags and all note moves.
                    </span>
                  </li>
                  <li class="skill-bullet-row">
                    <span class="skill-bullet-mark">-</span>
                    <span>
                      <strong class="skill-strong">Obsidian context</strong> for app/editor/plugin-specific behavior and read-only backlink discovery.
                    </span>
                  </li>
                  <li class="skill-bullet-row">
                    <span class="skill-bullet-mark">-</span>
                    <span>
                      <strong class="skill-strong">Git CLI</strong> for sync, backup, and versioning actions.
                    </span>
                  </li>
                </ul>
              </div>
              <div class="skill-playbook-block">
                <h4 class="skill-playbook-heading">Safe note rename flow</h4>
                <ol class="skill-decimal-list">
                  <li>Search for the old wikilink target by vault-relative path and filename stem.</li>
                  <li>
                    Move the note with MCP <code class="skill-code-pill">move_note</code>, even when Obsidian is running.
                  </li>
                  <li>Patch exact wikilink targets while preserving aliases, embeds, and heading or block fragments.</li>
                  <li>Search again and report stale references. Do not claim exhaustive repair if the 20-result cap is reached or the basename is ambiguous.</li>
                </ol>
                <p class="skill-playbook-note">
                  The skill does not invoke <code class="skill-code-pill">obsidian move</code> automatically. Delayed stale-offset rewrites can corrupt notes edited while the command is still
                  running (
                  <a href="https://github.com/bitbonsai/mcpvault/issues/176" target="_blank" rel="noopener noreferrer" class="skill-link">
                    #176
                  </a>
                  ).
                </p>
              </div>
              <div class="skill-playbook-block">
                <h4 class="skill-playbook-heading">Preflight checks before sync</h4>
                <div class="skill-code-panel">
                  <pre class="skill-pre">{`git --version\ngit rev-parse --is-inside-work-tree\ngit config user.name\ngit config user.email\ngit remote -v`}</pre>
                </div>
                <p class="skill-playbook-note">If any check fails, ask one targeted setup question with a recommended default.</p>
              </div>
              <div class="skill-playbook-block">
                <h4 class="skill-playbook-heading">Example conversation</h4>
                <div class="skill-conversation">
                  {EXAMPLE_CONVERSATION.map((turn) => (
                    <div class="skill-conversation-turn">
                      <span class="skill-conversation-role">{turn.role}:</span>
                      <span class="skill-conversation-text">{turn.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* What It Is */}
        <div class="skill-what-it-is fade-in-on-scroll">
          <h2 class="skill-section-title">What It Is</h2>
          <div class="skill-triple-grid">
            <div class="skill-card">
              <h3 class="skill-card-title">MCP Server</h3>
              <p class="skill-card-body">
                Handles note reads, writes, searches, patches, and moves. It validates inputs and rejects paths outside the configured vault.
              </p>
            </div>
            <div class="skill-card">
              <h3 class="skill-card-title">Obsidian CLI</h3>
              <p class="skill-card-body">
                Uses Obsidian's official CLI for operations that need the running desktop app: active file, opening notes in the editor, daily notes with template expansion, read-only backlink
                discovery, and plugin commands. A preflight checks the installed CLI at runtime instead of assuming a fixed version.
              </p>
            </div>
            <div class="skill-card">
              <h3 class="skill-card-title">Git Sync</h3>
              <p class="skill-card-body">Git commits, pulls, and pushes vault files. Cron, launchd, or CI can run the commands without Obsidian.</p>
            </div>
          </div>
        </div>

        {/* Git Sync Details */}
        <div class="skill-git-sync fade-in-on-scroll">
          <details class="skill-collapsible">
            <summary class="skill-collapsible-summary">
              <div>
                <h3 class="skill-collapsible-title">Git-Based Vault Sync</h3>
                <p class="skill-collapsible-subtitle">Repository setup, automation, and conflict notes</p>
              </div>
              <CollapsibleChevron />
            </summary>
            <div class="skill-collapsible-body">
              <div class="skill-git-sync-grid">
                <div>
                  <h4 class="skill-playbook-heading">How it works</h4>
                  <p class="skill-git-sync-text">
                    An Obsidian vault is a folder of markdown files. Run <code class="skill-code-pill skill-code-pill--accent">git init</code> inside it, add a remote, then commit, pull, and push
                    like any repository.
                  </p>
                  <h4 class="skill-playbook-heading">Headless automation</h4>
                  <div class="skill-code-panel skill-code-panel--mb">
                    <pre class="skill-pre">{`# cron job or launchd plist\ncd /path/to/vault\ngit add -A\ngit commit -m "backup $(date +%Y-%m-%d)"\ngit push`}</pre>
                  </div>
                  <p class="skill-git-sync-text">No Obsidian CLI required. Works on servers, NAS, or any headless machine.</p>
                </div>
                <div>
                  <h4 class="skill-playbook-heading">Optional: Obsidian Git plugin</h4>
                  <p class="skill-git-sync-text">
                    The{" "}
                    <a href="https://github.com/Vinzent03/obsidian-git" target="_blank" rel="noopener noreferrer" class="skill-link">
                      Obsidian Git
                    </a>{" "}
                    community plugin (8k+ stars) adds GUI-driven auto-sync from within the app: auto-commit on interval, pull on startup, push on close, and a source control sidebar.
                  </p>
                  <h4 class="skill-playbook-heading">Caveats</h4>
                  <ul class="skill-bullet-list">
                    <li class="skill-bullet-row">
                      <span class="skill-bullet-mark">-</span>
                      <span>
                        <strong class="skill-strong">Commit intervals:</strong> Git sync runs when changes are committed.
                      </span>
                    </li>
                    <li class="skill-bullet-row">
                      <span class="skill-bullet-mark">-</span>
                      <span>
                        <strong class="skill-strong">Merge conflicts:</strong> Editing the same note on two devices before syncing requires manual resolution.
                      </span>
                    </li>
                    <li class="skill-bullet-row">
                      <span class="skill-bullet-mark">-</span>
                      <span>
                        <strong class="skill-strong">Large binaries:</strong> Images and PDFs may need <code class="skill-code-accent">.gitignore</code> or Git LFS.
                      </span>
                    </li>
                    <li class="skill-bullet-row">
                      <span class="skill-bullet-mark">-</span>
                      <span>
                        <strong class="skill-strong">Workspace files:</strong> Add <code class="skill-code-accent">.obsidian/workspace.json</code> to <code class="skill-code-accent">.gitignore</code>.
                      </span>
                    </li>
                  </ul>
                  <div class="skill-code-panel skill-code-panel--mt">
                    <p class="skill-code-panel-label">Recommended .gitignore</p>
                    <pre class="skill-pre">{`.obsidian/workspace.json\n.obsidian/workspace-mobile.json\n.obsidian/plugins/obsidian-git/data.json\n.trash/`}</pre>
                  </div>
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* When To Use */}
        <div class="skill-when-to-use fade-in-on-scroll">
          <h2 class="skill-section-title">When To Use</h2>
          <div class="skill-double-grid">
            <div>
              <h3 class="skill-subheading">Trigger phrases</h3>
              <div class="skill-trigger-list">
                {TRIGGERS.map((t) => (
                  <div class="skill-trigger-row">
                    <span class="skill-trigger-prompt">&gt;</span>
                    <span class="skill-trigger-phrase">{t.phrase}</span>
                    <span class="skill-trigger-badge">{t.backend}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 class="skill-subheading">Not a fit for</h3>
              <div class="skill-trigger-list">
                {NEGATIVE_TRIGGERS.map((t) => (
                  <div class="skill-trigger-row">
                    <span class="skill-trigger-prompt skill-trigger-prompt--muted">&times;</span>
                    <span class="skill-trigger-phrase skill-trigger-phrase--muted">{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Workflow Patterns */}
        <div class="skill-workflows fade-in-on-scroll">
          <h2 class="skill-section-title">Workflow Patterns</h2>
          <p class="skill-section-lede">Three patterns for combining MCP and Obsidian in a single session.</p>
          <div class="skill-triple-grid">
            {WORKFLOWS.map((wf) => (
              <div class="skill-card">
                <div class="skill-workflow-badge">{wf.icon}</div>
                <h3 class="skill-card-title">{wf.title}</h3>
                <p class="skill-card-body">{wf.description}</p>
                <div class="skill-workflow-steps">
                  {wf.steps.map((step, i) => (
                    <div class="skill-workflow-step">
                      <span class="skill-workflow-step-index">{i + 1}.</span>
                      <span class="skill-workflow-step-text">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Safety Defaults */}
        <div class="skill-safety fade-in-on-scroll">
          <h2 class="skill-section-title">Safety Defaults</h2>
          <div class="skill-double-grid">
            {SAFETY_RULES.map((rule) => (
              <div class="skill-card skill-card--compact">
                <h3 class="skill-card-title skill-card-title--sm">{rule.title}</h3>
                <p class="skill-card-body skill-card-body--sm">{rule.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Start */}
        <div class="skill-quickstart fade-in-on-scroll">
          <h2 class="skill-section-title">Quick Start</h2>
          <p class="skill-section-lede">Install the skill to teach your AI assistant the Obsidian workflow.</p>

          <div class="skill-double-grid">
            <div class="skill-code-card">
              <div class="skill-code-card-header">Skill folder structure</div>
              <div class="skill-code-card-body">
                <pre class="skill-pre">{`.claude/\n  skills/\n    obsidian/\n      SKILL.md                  # Gotchas, error recovery, index\n      resources/\n        tool-patterns.md        # Per-tool response shapes and recipes\n        obsidian-conventions.md # Vault structure, wikilinks, tags\n        git-sync.md             # Git backup/sync workflows`}</pre>
              </div>
            </div>

            <div class="skill-code-card">
              <div class="skill-code-card-header">SKILL.md frontmatter</div>
              <div class="skill-code-card-body">
                <pre class="skill-pre">{`---\nname: obsidian\ndescription: >\n  Activate when the user mentions their\n  Obsidian vault, notes, tags, frontmatter,\n  daily notes, backup, or sync. Route\n  operations across MCP, Obsidian CLI/app\n  actions, and git sync with safe defaults.\nmetadata:\n  version: "2.2"\n  author: bitbonsai\n---`}</pre>
              </div>
            </div>
          </div>

          <div class="skill-cta">
            <div class="skill-cta-card">
              <div class="skill-cta-text">
                <h3 class="skill-cta-title">Install the skill</h3>
                <p class="skill-cta-description">Add routing instructions for MCPVault, Obsidian CLI, and Git.</p>
                <a href="/install/" class="skill-cta-link">
                  <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Installation
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
