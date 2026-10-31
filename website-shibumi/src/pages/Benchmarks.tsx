/**
 * Benchmarks page. Ported from website/src/pages/benchmarks.astro.
 *
 * Composition: Nav, hero + TL;DR, BenchmarkCharts, prose sections
 * (Why should we move? / HTTP / Method), skeptics FAQ, Footer.
 */
import { BenchmarkCharts } from "../components/BenchmarkCharts";
import { Footer } from "../components/Footer";
import { Nav } from "../components/Nav";
import { Layout } from "../layouts/Layout";

const SPEC_URL = "https://modelcontextprotocol.io/specification/latest";
const SCRIPTS_URL = "https://github.com/bitbonsai/mcpvault/tree/main/benchmarks";
const ISSUE_URL = "https://github.com/bitbonsai/mcpvault/issues/49";

interface FaqItem {
  q: string;
  a: unknown;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Sub-millisecond tool calls? That looks made up.",
    a: "It's stdio on the same machine: no network, and the file is already in the OS cache. The number isolates server processing, the only part the SDK swap could change.",
  },
  {
    q: "Eight cold starts and twenty searches is a tiny sample.",
    a: "True. It's enough to compare medians of a quiet local process, and it's why we claim a tie, never a speedup. Every p95 is in the table above.",
  },
  {
    q: "MCP v2 wins some rows. Convenient.",
    a: (
      <>
        Noise. Those differences flip between runs. The claim is only that <strong>MCP v2</strong> isn't slower.
      </>
    ),
  },
  {
    q: "You benchmarked your own project and concluded it's fine.",
    a: "The scripts are in the repo and print the exact numbers on this page. Rerun them on your own vault; if you get different results, open an issue.",
  },
  {
    q: "Two protocol versions in one server sounds like per-request overhead.",
    a: "The version is settled once, when the client connects. Requests never re-check it, which is what the flat per-request numbers show.",
  },
  {
    q: "So nothing at all got slower? Really?",
    a: (
      <>
        One thing: pinning an <strong>MCP v2</strong> client to the new protocol version adds about 110 ms, once, at
        connect. Only our test harness does that; shipping apps don't pin. Publishing it because you'd find it anyway.
      </>
    ),
  },
];

export interface BenchmarksPageProps {
  currentPath: string;
  version: string;
}

export function BenchmarksPage({ currentPath, version }: BenchmarksPageProps) {
  return (
    <Layout
      title="MCP v2 benchmarks"
      description="MCPVault compatibility benchmarks for current clients and clients using the MCP 2026-07-28 specification."
      canonical="https://mcpvault.org/benchmarks/"
      page="benchmarks"
      pageStylesheet="/styles/benchmarks.css"
      clientScript="/client/alpine.js"
      version={version}
    >
      <Nav currentPath={currentPath} version={version} />

      <main id="main-content" data-component="benchmarks">
        <section class="bench-section bench-hero">
          <div class="bench-container">
            <h1>MCP v2 compatibility benchmarks</h1>
            <p>
              The Model Context Protocol published its{" "}
              <a href={SPEC_URL} target="_blank" rel="noopener noreferrer">
                2026-07-28 specification
              </a>{" "}
              in July 2026. MCPVault uses the new official SDK, which we call <strong>MCP v2</strong>. One process
              accepts both protocol generations, so existing client configurations continue to work.
            </p>
            <p>We benchmarked the upgrade before shipping it. Three pairings, one real vault (381 notes), everything over stdio.</p>

            <aside class="bench-tldr" aria-label="Summary">
              <p class="bench-tldr-label">TL;DR</p>
              <p>
                Across this test, <strong>MCP v2</strong> connected in about 107 ms and showed no material per-request
                slowdown for current or new clients.
              </p>
            </aside>
          </div>
        </section>

        <section class="bench-section" aria-label="Benchmark results">
          <div class="bench-container">
            <BenchmarkCharts />
          </div>
        </section>

        <section class="bench-section">
          <div class="bench-container bench-prose">
            <div>
              <h2>Why MCPVault moved</h2>
              <ul>
                <li>One process accepts clients using either protocol generation.</li>
                <li>New MCP fixes and security updates land on the 2.x SDK line.</li>
                <li>The specification supports JSON Schema 2020-12 for more precise tool input definitions.</li>
              </ul>
            </div>

            <div>
              <h2>Stateless HTTP</h2>
              <p>
                The 2026-07-28 specification removes per-client server sessions from the HTTP transport. This can
                simplify running an MCP server behind a load balancer. MCPVault does not expose an HTTP transport
                today. A separate, opt-in HTTP package is tracked in{" "}
                <a href={ISSUE_URL} target="_blank" rel="noopener noreferrer">
                  issue #49
                </a>
                {". "}Local stdio will remain the default.
              </p>
            </div>

            <div>
              <h2>Method</h2>
              <p>
                Each pairing spawns <code>mcpvault &lt;vault&gt; --read-only</code> over stdio. Cold start is the
                median of 8 full connect cycles, spawn to first response. Per-request numbers are medians on a warm
                connection after one warmup call (50 iterations per tool, 20 for search_notes). Measured 2026-08-17 on
                macOS, Node 26, SDK 1.30.0 vs 2.0.0. The scripts live in the repo's{" "}
                <a href={SCRIPTS_URL} target="_blank" rel="noopener noreferrer">
                  benchmarks folder
                </a>
                {", "}so you can rerun them against your own vault.
              </p>
            </div>
          </div>
        </section>

        <section class="bench-section bench-faq" aria-label="Frequently asked questions">
          <div class="bench-container">
            <h2>For the skeptics</h2>
            <p class="bench-faq-intro">Fair questions a developer should ask about a project benchmarking itself.</p>
            <div class="bench-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </Layout>
  );
}
