/**
 * Benchmark bar charts for the /benchmarks/ page. Ported from
 * website/src/components/BenchmarkCharts.astro.
 *
 * Bars are server-rendered markup; the grow-in animation is added by the
 * `bench-reveal` client module (IntersectionObserver toggles `.in-view` on
 * each `.bench-card`), keeping the page free of inline scripts under CSP.
 *
 * Measured 2026-08-17 on macOS (Darwin 25.6), Node v26.7.0, against a real
 * vault (381 notes, 84 folders, 3.2 MB) over stdio in read-only mode.
 * Scripts: benchmarks/ in the repo root.
 */

interface Stat {
  median: number;
  p95: number;
  n: number;
}

interface Pairing {
  name: string;
  short: string;
  detail: string;
  coldStart: Stat;
  tools: Record<string, Stat>;
}

const PAIRINGS: Pairing[] = [
  {
    name: "MCPVault today",
    short: "today",
    detail: "the current npm release, measured as a baseline",
    coldStart: { median: 107.3, p95: 155.5, n: 8 },
    tools: {
      "tools/list": { median: 0.15, p95: 0.28, n: 50 },
      get_vault_stats: { median: 12.13, p95: 13.95, n: 50 },
      read_note: { median: 0.46, p95: 0.84, n: 50 },
      list_directory: { median: 0.45, p95: 0.66, n: 50 },
      search_notes: { median: 85.53, p95: 107.44, n: 20 },
    },
  },
  {
    name: "MCP v2 with today’s apps",
    short: "MCP v2, today’s apps",
    detail: "the MCP v2 build answering the apps you already use, unchanged (Claude Desktop, Cursor, and friends)",
    coldStart: { median: 109.8, p95: 116.8, n: 8 },
    tools: {
      "tools/list": { median: 0.14, p95: 0.28, n: 50 },
      get_vault_stats: { median: 11.4, p95: 12.2, n: 50 },
      read_note: { median: 0.43, p95: 0.58, n: 50 },
      list_directory: { median: 0.43, p95: 0.49, n: 50 },
      search_notes: { median: 84.33, p95: 86.4, n: 20 },
    },
  },
  {
    name: "MCP v2 with new apps",
    short: "MCP v2, new apps",
    detail: "the MCP v2 build with an app on the new SDK (2.0.0), how connections will look as the ecosystem updates",
    coldStart: { median: 105.8, p95: 107.8, n: 8 },
    tools: {
      "tools/list": { median: 0.17, p95: 0.34, n: 50 },
      get_vault_stats: { median: 11.66, p95: 12.33, n: 50 },
      read_note: { median: 0.45, p95: 0.65, n: 50 },
      list_directory: { median: 0.46, p95: 0.64, n: 50 },
      search_notes: { median: 85.62, p95: 88.15, n: 20 },
    },
  },
];

// Validated for CVD separation and 3:1 contrast on the #171717 card surface.
const COLORS = ["#0891b2", "#8b5cf6", "#d97706"];
const TOOLS = Object.keys(PAIRINGS[0]?.tools ?? {});

// Round an axis limit up to a clean 1/1.2/1.5/2/2.5/5/10 step, e.g. 109.8 -> 120.
function niceCeil(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 1.2, 1.5, 2, 2.5, 5, 10]) {
    if (v <= step * mag) return step * mag;
  }
  return 10 * mag;
}

const fmt = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2));

interface ChartRow {
  pairing: Pairing;
  stat: Stat;
  color: string;
}

interface ChartProps {
  title: string;
  unit?: string;
  rows: ChartRow[];
  compact?: boolean;
}

function chartRows(pick: (p: Pairing) => Stat): ChartRow[] {
  return PAIRINGS.map((pairing, i) => ({ pairing, stat: pick(pairing), color: COLORS[i] ?? "#8b5cf6" }));
}

function BarChart({ title, unit, rows, compact }: ChartProps) {
  const axisMax = niceCeil(Math.max(...rows.map((r) => r.stat.median)) * 1.02);
  return (
    <figure class={`bench-card${compact ? " bench-card-compact" : ""}`}>
      <figcaption>
        {title}
        {unit ? <span class="bench-unit"> · {unit}</span> : null}
      </figcaption>
      {rows.map((row, i) => (
        <div class="bench-row">
          <span class="bench-label">{row.pairing.short}</span>
          <div
            class="bench-track"
            title={`${row.pairing.name}: median ${fmt(row.stat.median)} ms, p95 ${fmt(row.stat.p95)} ms, n=${row.stat.n}`}
          >
            <div
              class="bench-bar"
              style={`width:${(row.stat.median / axisMax) * 100}%;background:${row.color};animation-delay:${i * 80}ms`}
            ></div>
          </div>
          {compact ? null : <span class="bench-value">{fmt(row.stat.median)}</span>}
        </div>
      ))}
      {compact ? (
        <div class="bench-chips">
          {rows.map((row) => (
            <span class="bench-chip">
              <span class="bench-swatch" style={`background:${row.color}`} aria-hidden="true"></span>
              <span class="bench-chip-value">{fmt(row.stat.median)}</span>
            </span>
          ))}
          <span class="bench-chip-unit">ms</span>
        </div>
      ) : (
        <div class="bench-axis">
          <span>0</span>
          <span>{axisMax} ms</span>
        </div>
      )}
    </figure>
  );
}

export function BenchmarkCharts() {
  return (
    <div class="bench-charts">
      <BarChart
        title="Cold start"
        unit="spawn to first response, median ms, lower is better"
        rows={chartRows((p) => p.coldStart)}
      />

      <h3 class="bench-group-title">
        Per request, warm connection <span class="bench-unit">· median ms</span>
      </h3>
      <div class="bench-grid">
        {TOOLS.map((tool) => (
          <BarChart title={tool} rows={chartRows((p) => p.tools[tool] ?? { median: 0, p95: 0, n: 0 })} compact />
        ))}
      </div>

      <div class="bench-legend">
        {PAIRINGS.map((p, i) => (
          <span class="bench-legend-item">
            <span class="bench-swatch" style={`background:${COLORS[i] ?? "#8b5cf6"}`} aria-hidden="true"></span>
            <span>
              <strong>{p.name}</strong>: {p.detail}
            </span>
          </span>
        ))}
      </div>

      <details class="bench-table-details">
        <summary>Full numbers (median and p95, in ms)</summary>
        <div class="bench-table-scroll">
          <table>
            <thead>
              <tr>
                <th>metric</th>
                {PAIRINGS.map((p) => (
                  <th>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>cold start (n=8)</td>
                {PAIRINGS.map((p) => (
                  <td>
                    {p.coldStart.median} · p95 {p.coldStart.p95}
                  </td>
                ))}
              </tr>
              {TOOLS.map((tool) => (
                <tr>
                  <td>
                    {tool} (n={PAIRINGS[0]?.tools[tool]?.n ?? 0})
                  </td>
                  {PAIRINGS.map((p) => (
                    <td>
                      {p.tools[tool]?.median} · p95 {p.tools[tool]?.p95}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
