/**
 * Install-page terminal/config-tab UI. Ported from Terminal.astro.
 *
 * Scope for this group (Phase 2, group 4 -- "install"): markup, scoped CSS,
 * and the Markdown counterpart.
 *
 * Phase 3: `.copy-btn` clicks and `.config-tab` switching are now the
 * `terminal` Alpine.data() module (`../client/terminal.ts`) -- `x-data`
 * names it on the section root, tab buttons call `selectTab(id)` and bind
 * their own `active` class, panels bind their `hidden` class, and every
 * copy button calls `copy($el.dataset.copy)` and reads that same
 * `data-copy` attribute back for its own "Copied!" feedback (see
 * `terminal.ts` for why it's read from the attribute rather than named as
 * an inline string literal). Every tab/copy control still keeps its
 * `data-tab`/`data-content`/`data-copy` attribute, so a no-JS visitor sees
 * exactly the same server-rendered state as before: only the "standard"
 * tab is visible (`.config-content.hidden` on the rest), and every button
 * shows its static "Copy code" label.
 *
 * Also Phase 3 (maintainer decision 2026-08-10, demo-purpose only): the two
 * MCP Inspector command lines type themselves out on load via the same
 * module's `startTyping()`/`typed` state -- a cosmetic addition with no
 * production equivalent. Without JavaScript the full command text is what
 * server-renders and stays put, since `x-text` never runs.
 *
 * Simplification pass (maintainer decision 2026-08-10, recorded in
 * `.plans/shibumi-website-migration.md` "Approved deviations"): this
 * terminal is demo-purpose only, so the markup that repeated near-verbatim
 * across tabs/rows -- the tab buttons, "Usage Examples" tip cards, the
 * "Configuration Scopes" pill lists, the config-file-location entries, the
 * inspector command rows, the success badges, and the privacy checklist --
 * is hoisted into plain typed data arrays below and rendered through one
 * small helper/`.map()` each, instead of being copy-pasted per tab. Visual
 * result stays close to the original but is not held to pixel parity.
 *
 * `lucide-react`'s `Check`, `ChevronDown`, `Compass`, `Globe`, `Lightbulb`,
 * `Lock`, `Pencil`, `Search`, `X`, `Zap`, `FolderOpen`, `Layers` are
 * replaced with the audited inline SVG helpers in `icons.tsx` (`GlobeIcon`
 * and `SearchIcon` already existed from the features group). The raw
 * inline copy-icon `<svg>` (never a `lucide-react` import in the Astro
 * source) is centralized as `CopyIcon` there too, since it repeated 8+
 * times here verbatim.
 *
 * Syntax highlighting: the three JSON config samples that went through
 * `CodeBlock.tsx`'s `react-syntax-highlighter` (`client:only="react"`) are
 * now highlighted server-side with Shiki (`highlight.ts`), same audited
 * `raw()` pattern as `FeatureCard`. The Claude Code CLI command and the
 * OpenAI Codex TOML block were already static, hand-colored `<pre>`/`<span>`
 * markup in the Astro source (no CodeBlock/react involved) -- per the
 * plan's "preserve pre-rendered highlighted markup where static", that
 * markup is ported through `raw()` unchanged (fully server-controlled
 * fixed literals, never request/user data, so `raw()` is safe here too).
 *
 * `--color-border-rgb`/`--color-card-rgb` are referenced by
 * `.config-tab`/`.collapsible-card` below with `rgba(var(--...-rgb,
 * <fallback>), a)`, but neither custom property is defined anywhere in the
 * Astro source's global CSS (confirmed by grep) -- production always
 * renders the literal fallback (63, 63, 70) / (24, 24, 27), not the site's
 * real `--color-border`/`--color-card` hex values. `install.css` preserves
 * that fallback verbatim for parity rather than "fixing" it to the real
 * tokens.
 */
import { raw } from "hono/html";
import {
  CheckIcon,
  ChevronDownIcon,
  CompassIcon,
  CopyIcon,
  FolderOpenIcon,
  GlobeIcon,
  LayersIcon,
  LightbulbIcon,
  LockIcon,
  PencilIcon,
  SearchIcon,
  XIcon,
  ZapIcon,
  type IconProps,
} from "./icons";
import { highlightCode } from "../lib/highlight";
import type { FC } from "hono/jsx";

const STANDARD_CONFIG_JSON = `{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
    }
  }
}`;
const STANDARD_CONFIG_COPY = '{"mcpServers": {"obsidian": {"command": "npx", "args": ["@bitbonsai/mcpvault@latest", "/path/to/your/vault"]}}}';

const CLAUDE_CODE_CLI_COPY = `claude mcp add-json obsidian --scope user '{"type":"stdio","command":"npx","args":["@bitbonsai/mcpvault@latest","/path/to/your/vault"]}'`;

const OPENCODE_CONFIG_JSON = `{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["npx", "-y", "@bitbonsai/mcpvault@latest", "/path/to/your/vault"]
    }
  }
}`;
const OPENCODE_CONFIG_COPY = '{"$schema": "https://opencode.ai/config.json", "mcp": {"obsidian": {"type": "local", "command": ["npx", "-y", "@bitbonsai/mcpvault@latest", "/path/to/your/vault"]}}}';
const OPENCODE_CLI_COPY = "opencode mcp add";

const GEMINI_CONFIG_COPY = STANDARD_CONFIG_COPY;
const GEMINI_CLI_COPY = "gemini mcp add obsidian -- npx @bitbonsai/mcpvault@latest /path/to/your/vault";

const CODEX_COPY = `[mcp_servers.obsidian]
command = "npx"
args = ["-y", "@bitbonsai/mcpvault@latest", "/path/to/your/vault"]`;

const INSPECTOR_INSTALL_COPY = "npm install -g @modelcontextprotocol/inspector";
const INSPECTOR_TEST_COPY = "mcp-inspector npx @bitbonsai/mcpvault@latest /path/to/vault";

/** `raw()`-audited: fixed literal, matches the Astro source's own hand-colored spans (Catppuccin Mocha), not Shiki output. */
const CLAUDE_CODE_CLI_HTML =
  '<span style="color: #cba6f7;">claude</span> <span style="color: #89b4fa;">mcp add-json</span> <span style="color: #a6e3a1;">obsidian</span> <span style="color: #fab387;">--scope user</span> <span style="color: #f38ba8;">\'{"type":"stdio","command":"npx","args":["@bitbonsai/mcpvault@latest","/path/to/your/vault"]}\'</span>';

/** `raw()`-audited: fixed literal, same reasoning as `CLAUDE_CODE_CLI_HTML`. */
const CODEX_TOML_HTML = `<span style="color: #cba6f7;">[mcp_servers.obsidian]</span>
<span style="color: #89b4fa;">command</span> <span style="color: #94e2d5;">=</span> <span style="color: #a6e3a1;">"npx"</span>
<span style="color: #89b4fa;">args</span> <span style="color: #94e2d5;">=</span> <span style="color: #cdd6f4;">[</span><span style="color: #a6e3a1;">"-y"</span><span style="color: #cdd6f4;">,</span> <span style="color: #a6e3a1;">"@bitbonsai/mcpvault@latest"</span><span style="color: #cdd6f4;">,</span> <span style="color: #a6e3a1;">"/path/to/your/vault"</span><span style="color: #cdd6f4;">]</span>`;

/** Reused verbatim on every copy button -- see the Phase 3 port comment above and `terminal.ts`. */
const COPY_ON_CLICK = "copy($el.dataset.copy)";
const COPY_LABEL_XTEXT = "copiedText === $el.closest('button').dataset.copy ? 'Copied!' : 'Copy code'";
const COPY_IS_COPIED_CLASS = "{ 'is-copied': copiedText === $el.dataset.copy }";

interface ConfigTab {
  id: string;
  label: string;
}

const CONFIG_TABS: ConfigTab[] = [
  { id: "standard", label: "Claude Desktop / ChatGPT+" },
  { id: "claude-code", label: "Claude Code" },
  { id: "gemini-cli", label: "Gemini CLI" },
  { id: "opencode", label: "OpenCode" },
  { id: "codex", label: "OpenAI Codex" },
];

interface UsageExamplesData {
  intro: string;
  examples: string[];
}

/** Repeats near-identically across the claude-code, opencode, gemini-cli, and codex tabs. */
function UsageExamplesCard({ intro, examples }: UsageExamplesData) {
  return (
    <div class="info-card info-card--tip">
      <div class="info-card-row">
        <LightbulbIcon className="info-card-icon" />
        <div class="info-card-body">
          <p class="info-card-title">Usage Examples</p>
          <p class="info-card-text">{intro}</p>
          <div class="usage-examples">
            {examples.map((example) => (
              <code class="code-chip code-chip--example">{example}</code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ScopeListData {
  intro: string;
  items: Array<{ pill: string; desc: string }>;
}

/** Repeats across the claude-code and opencode tabs (pill + description rows). */
function ScopeListCard({ intro, items }: ScopeListData) {
  return (
    <div class="info-card info-card--tip">
      <div class="info-card-row">
        <LightbulbIcon className="info-card-icon" />
        <div class="info-card-body">
          <p class="info-card-title">Configuration Scopes</p>
          <p class="info-card-text">{intro}</p>
          <div class="info-card-list">
            {items.map((item) => (
              <div class="info-card-list-row">
                <code class="code-chip code-chip--pill">{item.pill}</code>
                <span class="info-card-list-desc">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfigLocation {
  heading: string;
  rows: Array<{ label: string; value: string }>;
  hint?: { prefix: string; code: string; suffix: string };
}

const CONFIG_LOCATIONS: ConfigLocation[] = [
  {
    heading: "Claude Desktop (JSON)",
    rows: [
      { label: "macOS", value: "~/Library/Application Support/Claude/claude_desktop_config.json" },
      { label: "Windows", value: "%APPDATA%\\Claude\\claude_desktop_config.json" },
    ],
  },
  {
    heading: "Claude Code (CLI)",
    rows: [{ label: "User scope", value: "~/.claude.json" }],
    hint: { prefix: "Use", code: "claude mcp add-json --scope user", suffix: "for global access" },
  },
  {
    heading: "ChatGPT+ Desktop (JSON)",
    rows: [
      { label: "macOS", value: "~/Library/Application Support/ChatGPT/chatgpt_config.json" },
      { label: "Windows", value: "%APPDATA%\\ChatGPT\\chatgpt_config.json" },
    ],
  },
  {
    heading: "Gemini CLI (JSON)",
    rows: [{ label: "All platforms", value: "~/.gemini/settings.json" }],
  },
  {
    heading: "OpenCode (JSON)",
    rows: [
      { label: "Per project", value: "opencode.json" },
      { label: "Global", value: "~/.config/opencode/opencode.json" },
    ],
  },
  {
    heading: "OpenAI Codex (TOML)",
    rows: [
      { label: "macOS/Linux", value: "~/.codex/config.toml" },
      { label: "Windows", value: "%USERPROFILE%\\.codex\\config.toml" },
    ],
  },
];

interface InspectorCommand {
  comment: string;
  command: string;
  copy: string;
  ariaLabel: string;
}

const INSPECTOR_COMMANDS: InspectorCommand[] = [
  { comment: "# Install MCP Inspector globally", command: INSPECTOR_INSTALL_COPY, copy: INSPECTOR_INSTALL_COPY, ariaLabel: "Copy npm install command to clipboard" },
  { comment: "# Test MCPVault server", command: INSPECTOR_TEST_COPY, copy: INSPECTOR_TEST_COPY, ariaLabel: "Copy test command to clipboard" },
];

interface SuccessBadge {
  icon: FC<IconProps>;
  label: string;
}

const SUCCESS_BADGES: SuccessBadge[] = [
  { icon: SearchIcon, label: "Search notes" },
  { icon: PencilIcon, label: "Edit content" },
  { icon: FolderOpenIcon, label: "Organize files" },
  { icon: LayersIcon, label: "Batch operations" },
];

interface PrivacyItem {
  icon: FC<IconProps>;
  variant: "success" | "error";
  text: string;
}

const PRIVACY_ITEMS: PrivacyItem[] = [
  { icon: CheckIcon, variant: "success", text: "MCPVault reads files from the vault path you configure" },
  { icon: CheckIcon, variant: "success", text: "MCPVault has no hosted service that receives your vault files" },
  { icon: CheckIcon, variant: "success", text: "Path checks keep file tools inside the configured vault" },
  { icon: XIcon, variant: "error", text: "Your AI client or provider may receive note content used in requests" },
];

export async function Terminal() {
  const [standardHtml, opencodeHtml, geminiHtml] = await Promise.all([
    highlightCode(STANDARD_CONFIG_JSON, "json"),
    highlightCode(OPENCODE_CONFIG_JSON, "json"),
    highlightCode(STANDARD_CONFIG_JSON, "json"),
  ]);

  return (
    <section id="install" data-component="terminal" aria-labelledby="terminal-heading" x-data="terminal" x-init="startTyping()">
      <div class="terminal-inner">
        <div class="terminal-intro fade-in-on-scroll">
          <h2 id="terminal-heading" class="terminal-intro-title">
            Install MCPVault
          </h2>
          <p class="terminal-intro-lede">Choose your MCP client and add one local server entry.</p>
        </div>

        <div class="terminal-steps">
          {/* Step 1: Configure AI Platform */}
          <div class="terminal-step fade-in-on-scroll">
            <div class="step-heading">
              <div class="step-number">1</div>
              <h3 class="step-title">Configure your MCP client</h3>
            </div>

            <div class="terminal-window">
              <div class="terminal-header">
                <span class="terminal-button red" />
                <span class="terminal-button yellow" />
                <span class="terminal-button green" />
                <span class="terminal-window-title">AI Platform Config</span>
              </div>
              <div class="terminal-body">
                <div class="config-tabs">
                  {CONFIG_TABS.map((tab) => (
                    <button
                      class={`config-tab${tab.id === "standard" ? " active" : ""}`}
                      data-tab={tab.id}
                      x-on:click={`selectTab('${tab.id}')`}
                      x-bind:class={`{ active: activeTab === '${tab.id}' }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Standard config (Claude Desktop / ChatGPT+) */}
                <div class="config-content" data-content="standard" x-bind:class="{ hidden: activeTab !== 'standard' }">
                  <div class="code-scroll">{raw(standardHtml)}</div>
                  <button class="copy-code-btn copy-btn" data-copy={STANDARD_CONFIG_COPY} title="Copy configuration" aria-label="Copy configuration to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                    <CopyIcon className="icon" />
                    <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                  </button>
                </div>

                {/* Claude Code config */}
                <div class="config-content hidden" data-content="claude-code" x-bind:class="{ hidden: activeTab !== 'claude-code' }">
                  <div class="info-card info-card--mb">
                    <div class="info-card-row">
                      <ZapIcon className="info-card-icon" />
                      <div class="info-card-body">
                        <p class="info-card-title">Use the CLI</p>
                        <div class="code-scroll">
                          <pre class="cli-command">{raw(CLAUDE_CODE_CLI_HTML)}</pre>
                        </div>
                        <button class="copy-code-btn copy-btn info-card-copy" data-copy={CLAUDE_CODE_CLI_COPY} title="Copy configuration" aria-label="Copy configuration to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                          <CopyIcon className="icon" />
                          <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <ScopeListCard
                    intro="Claude Code supports three configuration scopes:"
                    items={[
                      { pill: "--scope user", desc: "Available across all your projects (recommended)" },
                      { pill: "--scope project", desc: "Team-shared via .mcp.json file" },
                      { pill: "--scope local", desc: "Current project only (private)" },
                    ]}
                  />

                  <UsageExamplesCard
                    intro="After configuration, Claude Code can access your vault:"
                    examples={["Read my meeting notes from yesterday", "Search my vault for notes about machine learning", "Create a new note summarizing our discussion"]}
                  />
                </div>

                {/* OpenCode config */}
                <div class="config-content hidden" data-content="opencode" x-bind:class="{ hidden: activeTab !== 'opencode' }">
                  <div class="info-card">
                    <div class="info-card-row">
                      <ZapIcon className="info-card-icon" />
                      <div class="info-card-body">
                        <p class="info-card-title">Use the CLI</p>
                        <code class="code-chip code-chip--cli">{OPENCODE_CLI_COPY}</code>
                        <button class="copy-code-btn copy-btn info-card-copy" data-copy={OPENCODE_CLI_COPY} title="Copy command" aria-label="Copy command to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                          <CopyIcon className="icon" />
                          <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                        </button>
                        <p class="info-card-hint">
                          Interactive wizard — select <strong class="info-card-hint-strong">local</strong>, then enter the command:{" "}
                          <code class="code-chip code-chip--plain">npx -y @bitbonsai/mcpvault@latest /path/to/your/vault</code>
                        </p>
                      </div>
                    </div>
                  </div>

                  <p class="config-content-note">Or configure manually:</p>
                  <div class="code-scroll">{raw(opencodeHtml)}</div>
                  <button class="copy-code-btn copy-btn" data-copy={OPENCODE_CONFIG_COPY} title="Copy configuration" aria-label="Copy configuration to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                    <CopyIcon className="icon" />
                    <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                  </button>

                  <ScopeListCard
                    intro="OpenCode supports multiple config locations:"
                    items={[
                      { pill: "opencode.json", desc: "In your project root for per-project config (recommended)" },
                      { pill: "~/.config/opencode/opencode.json", desc: "Global config for all projects" },
                    ]}
                  />

                  <UsageExamplesCard
                    intro="After configuration, OpenCode can access your vault:"
                    examples={["Read my meeting notes from yesterday", "Search my vault for notes about machine learning", "Create a new note summarizing our discussion"]}
                  />
                </div>

                {/* Gemini CLI config */}
                <div class="config-content hidden" data-content="gemini-cli" x-bind:class="{ hidden: activeTab !== 'gemini-cli' }">
                  <div class="info-card info-card--mb">
                    <div class="info-card-row">
                      <ZapIcon className="info-card-icon" />
                      <div class="info-card-body">
                        <p class="info-card-title">Use the CLI</p>
                        <code class="code-chip code-chip--cli">{GEMINI_CLI_COPY}</code>
                        <button class="copy-code-btn copy-btn info-card-copy" data-copy={GEMINI_CLI_COPY} title="Copy command" aria-label="Copy command to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                          <CopyIcon className="icon" />
                          <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <p class="config-content-note">
                    Or configure manually in <code class="code-chip code-chip--plain">~/.gemini/settings.json</code>:
                  </p>
                  <div class="code-scroll">{raw(geminiHtml)}</div>
                  <button class="copy-code-btn copy-btn" data-copy={GEMINI_CONFIG_COPY} title="Copy configuration" aria-label="Copy configuration to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                    <CopyIcon className="icon" />
                    <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                  </button>

                  <UsageExamplesCard
                    intro="After configuration, use commands like:"
                    examples={["Read my daily note from yesterday", "Search my vault for meeting notes", "Create a new note about project ideas"]}
                  />
                </div>

                {/* OpenAI Codex config (TOML) */}
                <div class="config-content hidden" data-content="codex" x-bind:class="{ hidden: activeTab !== 'codex' }">
                  <div class="code-scroll">
                    <pre class="cli-command cli-command--toml">{raw(CODEX_TOML_HTML)}</pre>
                  </div>
                  <button class="copy-code-btn copy-btn" data-copy={CODEX_COPY} title="Copy configuration" aria-label="Copy configuration to clipboard" x-on:click={COPY_ON_CLICK} x-bind:class={COPY_IS_COPIED_CLASS}>
                    <CopyIcon className="icon" />
                    <span x-text={COPY_LABEL_XTEXT}>Copy code</span>
                  </button>

                  <UsageExamplesCard
                    intro="After configuration, interact with your vault naturally:"
                    examples={["Show me my recent journal entries", "Find notes tagged with #project", "Update my todo list with new tasks"]}
                  />
                </div>
              </div>
            </div>

            <div class="terminal-notes">
              <div class="note-card">
                <p class="note-card-text">
                  <CompassIcon className="note-card-icon" />
                  <span>
                    <strong class="note-card-strong">Optional no-path mode:</strong> if your client starts MCPVault from inside your vault folder, you can omit the vault path and use current
                    working directory.
                  </span>
                </p>
                <div class="note-card-grid">
                  <code class="code-chip code-chip--block">npx @bitbonsai/mcpvault@latest</code>
                  <code class="code-chip code-chip--block">"args": ["@bitbonsai/mcpvault@latest"]</code>
                </div>
              </div>

              <div class="note-card">
                <p class="note-card-text">
                  <LockIcon className="note-card-icon" />
                  <span>
                    <strong class="note-card-strong">Read-only mode:</strong> add <code class="code-chip code-chip--pill-inline">--read-only</code> after the vault path. Mutating tools are
                    hidden from discovery and rejected if called directly.
                  </span>
                </p>
                <code class="code-chip code-chip--block code-chip--example">"args": ["@bitbonsai/mcpvault@latest", "/path/to/vault", "--read-only"]</code>
              </div>

              <div class="note-card">
                <p class="note-card-text">
                  <FolderOpenIcon className="note-card-icon" />
                  <span>
                    <strong class="note-card-strong">Default exclusions:</strong> repeat <code class="code-chip code-chip--pill-inline">--exclude &lt;subtree&gt;</code> to hide vault-relative folders from
                    search and directory listings. Direct read and write tools remain available for those paths.
                  </span>
                </p>
                <code class="code-chip code-chip--block code-chip--example">
                  "args": ["@bitbonsai/mcpvault@latest", "/path/to/vault", "--exclude", "Archive", "--exclude", "Snapshots/Old"]
                </code>
              </div>

              <div class="note-card">
                <p class="note-card-text note-card-text--small">
                  <FolderOpenIcon className="note-card-icon" />
                  <span>
                    Supported note file types: <code class="code-chip code-chip--pill-inline">.md</code>, <code class="code-chip code-chip--pill-inline">.markdown</code>,{" "}
                    <code class="code-chip code-chip--pill-inline">.txt</code>, <code class="code-chip code-chip--pill-inline">.base</code>, and{" "}
                    <code class="code-chip code-chip--pill-inline">.canvas</code>.
                  </span>
                </p>
              </div>
            </div>

            {/* Optional setup details */}
            <div class="setup-details">
              <div class="info-card info-card--highlight">
                <p class="setup-details-note">
                  <ZapIcon className="info-card-icon" />
                  <span>
                    <strong>Package download:</strong> npx downloads MCPVault when the client starts the server.
                  </span>
                </p>
              </div>

              <details class="collapsible-card">
                <summary class="collapsible-summary">
                  <ChevronDownIcon className="collapsible-chevron" />
                  <span class="collapsible-summary-text">
                    <strong>Config file locations</strong>
                  </span>
                </summary>

                <div class="collapsible-content config-locations">
                  {CONFIG_LOCATIONS.map((loc) => (
                    <div>
                      <div class="config-locations-heading">{loc.heading}</div>
                      <div class="config-locations-body">
                        {loc.rows.map((row) => (
                          <div>
                            {row.label}: <code class="code-chip code-chip--pill-inline">{row.value}</code>
                          </div>
                        ))}
                        {loc.hint && (
                          <div class="config-locations-hint">
                            {loc.hint.prefix} <code class="code-chip code-chip--pill-inline">{loc.hint.code}</code> {loc.hint.suffix}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </details>

              <details class="collapsible-card">
                <summary class="collapsible-summary">
                  <ChevronDownIcon className="collapsible-chevron" />
                  <span class="collapsible-summary-text">
                    <strong>Need your vault path?</strong>
                  </span>
                </summary>

                <div class="collapsible-content vault-path-help">
                  <div class="vault-path-grid">
                    <div>
                      <span class="vault-path-os">macOS:</span> In Finder, right-click your vault folder while holding <code class="code-chip code-chip--pill-inline">Option</code> and choose{" "}
                      <span class="vault-path-emphasis">Copy "..." as Pathname</span>.
                    </div>
                    <div>
                      <span class="vault-path-os">Windows:</span> In File Explorer, hold <code class="code-chip code-chip--pill-inline">Shift</code>, right-click your vault folder, and choose{" "}
                      <span class="vault-path-emphasis">Copy as path</span>.
                    </div>
                    <div class="vault-path-grid-full">
                      <span class="vault-path-os">Linux:</span> Open a terminal in your vault folder and run <code class="code-chip code-chip--pill-inline">pwd</code>.
                    </div>
                  </div>

                  <p>
                    Replace <code class="code-chip code-chip--pill-inline">/path/to/your/vault</code> with that full absolute path.
                  </p>

                  <div class="info-card info-card--highlight">
                    <p class="vault-path-cwd-heading">
                      <CompassIcon className="info-card-icon" />
                      <strong>Optional CWD mode</strong>
                    </p>
                    <p class="vault-path-cwd-text">
                      You can omit the vault path entirely when your client starts this server from inside your vault directory. In that case, MCPVault uses the current working directory as vault
                      root.
                    </p>
                    <div class="vault-path-cwd-examples">
                      <code class="code-chip code-chip--block">npx @bitbonsai/mcpvault@latest</code>
                      <code class="code-chip code-chip--block">npm start</code>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Step 2: Developers - MCP Inspector */}
          <div class="terminal-step fade-in-on-scroll">
            <div class="step-heading">
              <div class="step-number step-number--accent-2">2</div>
              <h3 class="step-title">Test with MCP Inspector</h3>
            </div>

            <div class="terminal-window">
              <div class="terminal-header">
                <span class="terminal-button red" />
                <span class="terminal-button yellow" />
                <span class="terminal-button green" />
                <span class="terminal-window-title">Terminal</span>
              </div>
              <div class="terminal-body">
                <div class="inspector-commands">
                  {INSPECTOR_COMMANDS.map((cmd, index) => (
                    <>
                      <div class="inspector-comment">{cmd.comment}</div>
                      <div class="inspector-command-row">
                        <span class="inspector-prompt">$</span>
                        <span class="inspector-command-text" x-text={`typed[${index}]`}>
                          {cmd.command}
                        </span>
                        <button
                          class="inspector-copy-btn copy-btn"
                          data-copy={cmd.copy}
                          title="Copy to clipboard"
                          aria-label={cmd.ariaLabel}
                          x-on:click={COPY_ON_CLICK}
                          x-bind:class="{ 'is-copied': copiedText === $el.dataset.copy }"
                        >
                          <CopyIcon className="icon" />
                        </button>
                      </div>
                    </>
                  ))}

                  <div class="inspector-success">
                    <span class="inspector-success-row">
                      <GlobeIcon className="icon" />
                      Opens interactive web interface at http://localhost:5173
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="inspector-note">
              <p class="inspector-note-lede">
                <SearchIcon className="inspector-note-icon" />
                <span>
                  <strong>MCP Inspector</strong> provides a web UI to test all MCP methods interactively.
                </span>
              </p>
              <div class="inspector-list">
                <div class="inspector-list-label">Use it to:</div>
                <ul class="inspector-list-items">
                  <li>Testing server functionality before integration</li>
                  <li>Debugging MCP method calls and responses</li>
                  <li>Exploring available tools and resources</li>
                  <li>Development and troubleshooting</li>
                </ul>
                <div class="inspector-github">
                  <svg class="inspector-github-bullet" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    />
                  </svg>
                  <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="inspector-github-link">
                    View on GitHub for more details
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Other Platforms */}
          <div class="terminal-step fade-in-on-scroll">
            <div class="platforms-banner">
              <p class="platforms-banner-text">
                <span class="platforms-banner-row">
                  <GlobeIcon className="icon" />
                  <span>
                    <strong>Client support:</strong> The examples above cover Claude Desktop, ChatGPT+, Claude Code, OpenCode, Gemini CLI, Cursor, and Windsurf.
                  </span>
                </span>
                <br />
                Other clients can use MCPVault if they support local stdio MCP servers.
              </p>
            </div>
            <div class="privacy-card">
              <p class="privacy-heading">
                <LockIcon className="icon" />
                <strong class="privacy-heading-strong">What "private" means:</strong>
              </p>

              <div class="privacy-list">
                {PRIVACY_ITEMS.map((item) => (
                  <div class="privacy-item">
                    <item.icon className={`privacy-icon privacy-icon--${item.variant}`} />
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              <div class="privacy-footer">
                <p class="privacy-footer-text">Your AI provider's retention and training terms still apply to content it receives.</p>
              </div>
            </div>
          </div>

          {/* Success message */}
          <div class="terminal-step fade-in-on-scroll">
            <div class="success-card">
              <div class="success-heading">
                <div class="success-icon">
                  <CheckIcon className="icon" />
                </div>
                <h3 class="success-title">Verify the connection</h3>
              </div>
              <p class="success-text">Restart your client, then ask it to list MCPVault tools or search for a known note.</p>
              <div class="success-badges">
                {SUCCESS_BADGES.map((badge) => (
                  <span class="success-badge">
                    <badge.icon className="icon" />
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
