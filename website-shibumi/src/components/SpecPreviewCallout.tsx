/**
 * "Latest MCP spec" banner. Ported from SpecPreviewCallout.astro.
 *
 * `lucide-react`'s `ArrowRight` and `GitBranch` are replaced with the
 * audited `ArrowRightIcon`/`GitBranchIcon` (icons.tsx).
 */
import { ArrowRightIcon, GitBranchIcon } from "./icons";

const SPEC_URL = "https://modelcontextprotocol.io/specification/latest";

export function SpecPreviewCallout() {
  return (
    <section data-component="spec-preview-callout" aria-label="Latest MCP specification development preview">
      <div class="callout-inner" style="position:relative">
        <div id="spec-confetti" style="position:absolute;inset:0;pointer-events:none;z-index:20" aria-hidden="true"></div>
        <div class="callout-card">
          <div class="callout-row">
            <div class="callout-message">
              <span class="callout-icon">
                <GitBranchIcon className="icon" />
              </span>

              <p class="callout-text">
                <span class="callout-headline">
                  MCPVault runs on{" "}
                  <a href={SPEC_URL} target="_blank" rel="noopener noreferrer" class="spec-link">
                    MCP v2
                  </a>
                  , the latest spec.
                </span>
                <span class="callout-short"> No material slowdown in tests.</span>
                <span class="callout-long"> Existing and new clients showed no material slowdown in our benchmarks.</span>
              </p>
            </div>

            <a href="/benchmarks/" aria-label="See the MCP v2 benchmarks" class="work-link">
              <span class="work-link-label">See the benchmarks</span>
              <ArrowRightIcon className="icon" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
