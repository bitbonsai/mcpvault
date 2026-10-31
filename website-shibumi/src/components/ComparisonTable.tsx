/**
 * "Why Choose MCPVault?" comparison table. Ported from ComparisonTable.astro.
 *
 * `lucide-react`'s `CheckCircle2`/`AlertTriangle`/`XCircle` are replaced
 * with the audited `CheckCircle2Icon`/`AlertTriangleIcon`/`XCircleIcon`
 * (icons.tsx). Each status icon sits directly beside its own visible status
 * text (e.g. "Simple"), so the default `aria-hidden="true"` is correct.
 */
import { AlertTriangleIcon, CheckCircle2Icon, GitHubIcon, XCircleIcon, type IconProps } from "./icons";
import type { FC } from "hono/jsx";

type Status = "success" | "warning" | "error";

interface StatusCell {
  status: Status;
  text: string;
  description: string;
}

interface FeatureRow {
  name: string;
  mcpObsidian: StatusCell;
  otherMcpObsidian: StatusCell;
  directAccess: StatusCell;
}

const FEATURES: FeatureRow[] = [
  {
    name: "Setup",
    mcpObsidian: { status: "success", text: "One command", description: "Run npx with the vault path" },
    otherMcpObsidian: { status: "warning", text: "Plugin setup", description: "Install and configure a REST API plugin" },
    directAccess: { status: "warning", text: "Client-specific", description: "Configure filesystem access in each client" },
  },
  {
    name: "Obsidian running",
    mcpObsidian: { status: "success", text: "Not required", description: "Reads vault files directly" },
    otherMcpObsidian: { status: "warning", text: "Required", description: "The plugin runs inside Obsidian" },
    directAccess: { status: "success", text: "Not required", description: "Reads files outside Obsidian" },
  },
  {
    name: "Plugin dependency",
    mcpObsidian: { status: "success", text: "None", description: "Runs as a separate local process" },
    otherMcpObsidian: { status: "warning", text: "Required", description: "Uses a community REST API plugin" },
    directAccess: { status: "success", text: "None", description: "Uses client or shell file tools" },
  },
  {
    name: "Frontmatter updates",
    mcpObsidian: { status: "success", text: "AST-aware", description: "Preserves formatting for unchanged YAML fields" },
    otherMcpObsidian: { status: "warning", text: "Endpoint-specific", description: "Behavior depends on the plugin endpoint" },
    directAccess: { status: "warning", text: "Tool-specific", description: "Behavior depends on the file editing tool" },
  },
  {
    name: "Search",
    mcpObsidian: { status: "success", text: "Built in", description: "Filename and content search with BM25 ranking" },
    otherMcpObsidian: { status: "success", text: "Obsidian-backed", description: "Uses search exposed by the plugin" },
    directAccess: { status: "warning", text: "Tool-specific", description: "May use grep, indexing, or client search" },
  },
  {
    name: "Connection",
    mcpObsidian: { status: "success", text: "Local stdio", description: "The MCP client launches the server" },
    otherMcpObsidian: { status: "warning", text: "Local HTTP", description: "The plugin exposes an API port" },
    directAccess: { status: "success", text: "Local process", description: "The client reads files directly" },
  },
  {
    name: "Move operations",
    mcpObsidian: { status: "success", text: "Built in", description: "Note and file moves use vault path checks" },
    otherMcpObsidian: { status: "success", text: "Plugin endpoint", description: "Behavior follows the plugin implementation" },
    directAccess: { status: "warning", text: "Tool-specific", description: "Behavior depends on the file editing tool" },
  },
  {
    name: "Access boundary",
    mcpObsidian: { status: "success", text: "Vault-scoped", description: "Blocks traversal, symlink escapes, and restricted paths" },
    otherMcpObsidian: { status: "success", text: "API-scoped", description: "Access follows plugin and Obsidian settings" },
    directAccess: { status: "warning", text: "Client-scoped", description: "Access follows the client's filesystem permissions" },
  },
];

const STATUS_ICONS: Record<Status, FC<IconProps>> = {
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  error: XCircleIcon,
};

function StatusValue({ cell }: { cell: StatusCell }) {
  const Icon = STATUS_ICONS[cell.status];
  return (
    <div class="comparison-cell">
      <div class="comparison-cell-status">
        <Icon className={`comparison-icon comparison-icon--${cell.status}`} />
        <span class={`comparison-text comparison-text--${cell.status}`}>{cell.text}</span>
      </div>
      <div class="comparison-description">{cell.description}</div>
    </div>
  );
}

export function ComparisonTable() {
  return (
    <section data-component="comparison-table" aria-labelledby="comparison-table-heading">
      <div class="comparison-inner">
        <div class="comparison-header fade-in-on-scroll">
          <h2 id="comparison-table-heading" class="comparison-title">
            Compare access methods
          </h2>
          <p class="comparison-lede">The main difference is where each approach runs and which layer controls access to vault files.</p>
        </div>

        <div class="comparison-table-scroll fade-in-on-scroll">
          <div class="comparison-table">
            <div class="comparison-table-head">
              <div class="comparison-row comparison-row--head">
                <div class="comparison-head-cell comparison-head-cell--feature">Feature</div>
                <div class="comparison-head-cell">
                  <div class="comparison-head-cell-title comparison-head-cell-title--accent">MCPVault</div>
                  <div class="comparison-head-cell-subtitle">This package</div>
                </div>
                <div class="comparison-head-cell">
                  <div class="comparison-head-cell-title">Plugin + REST API</div>
                  <div class="comparison-head-cell-subtitle">Obsidian community plugin</div>
                </div>
                <div class="comparison-head-cell">
                  <div class="comparison-head-cell-title">General file access</div>
                  <div class="comparison-head-cell-subtitle">Client or shell tools</div>
                </div>
              </div>
            </div>

            <div class="comparison-table-body">
              {FEATURES.map((feature, index) => (
                <div class="comparison-row" style={`animation-delay: ${index * 0.1}s`}>
                  <div class="comparison-feature-name">{feature.name}</div>
                  <StatusValue cell={feature.mcpObsidian} />
                  <StatusValue cell={feature.otherMcpObsidian} />
                  <StatusValue cell={feature.directAccess} />
                </div>
              ))}
            </div>

            <div class="comparison-table-footer">
              <div class="comparison-summary">
                <div class="comparison-summary-item">
                  <div class="comparison-summary-value comparison-summary-value--accent">18</div>
                  <div class="comparison-summary-label">MCP tools</div>
                </div>
                <div class="comparison-summary-item">
                  <div class="comparison-summary-value comparison-summary-value--success">0</div>
                  <div class="comparison-summary-label">Required Obsidian plugins</div>
                </div>
                <div class="comparison-summary-item">
                  <div class="comparison-summary-value comparison-summary-value--warning">5</div>
                  <div class="comparison-summary-label">Supported note file types</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="comparison-cta fade-in-on-scroll">
          <div class="comparison-cta-card">
            <div class="comparison-cta-links">
              <a href="/install/" class="comparison-cta-primary">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Installation
              </a>
              <a href="https://github.com/bitbonsai/mcpvault" target="_blank" rel="noopener noreferrer" class="comparison-cta-secondary">
                <GitHubIcon className="icon" />
                Source code
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
