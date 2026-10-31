/**
 * "Usage Examples" section. Ported from HowItWorks.astro.
 *
 * `ResponseRenderer.tsx` (a `client:only="react"` island using
 * `react-syntax-highlighter`) is replaced with server-side Shiki
 * highlighting (`highlight.ts`), same pattern as `FeatureCard.tsx`: the
 * two example responses are fixed, build-time-known strings, so they can
 * be highlighted once per request with no client JS and no hydration --
 * matching the plan's "Syntax highlighting and icons" section. Splitting
 * a response into text/JSON segments is the same
 * `response.split(/```json\n|```/)` the React component used; only the
 * rendering of the JSON segments changed.
 *
 * `lucide-react`'s `Target` is replaced with the audited `TargetIcon` in
 * `icons.tsx`. It sits next to a visible heading, so the default
 * `aria-hidden="true"` (no `title` prop) is correct, same reasoning as
 * every other icon call site in this app. The CTA's arrow-bolt icon was
 * already raw inline `<svg>` markup in the Astro source (not a
 * lucide-react import); it is ported as-is below with an explicit
 * `aria-hidden="true"` added, since it sits next to visible link text.
 *
 * Raw-HTML audit: the only non-escaped output is `highlightCode()`'s
 * return value, passed through `raw()`. Safe because the only inputs are
 * this module's own fixed literal `EXAMPLES` strings, never user/request
 * data -- same audited pattern as `FeatureCard`/`Layout`.
 */
import { raw } from "hono/html";
import { highlightCode } from "../lib/highlight";
import { TargetIcon } from "./icons";

interface UsageExample {
  title: string;
  description: string;
  tags: string[];
  prompt: string;
  response: string;
}

const EXAMPLES: UsageExample[] = [
  {
    title: "Search & Read Notes",
    description: "Find notes and read their content for analysis",
    tags: ["Search", "Read", "Analysis"],
    prompt: "Find my productivity notes and summarize the key concepts",
    response: `MCPVault: Using search_notes...

Request:
\`\`\`json
{
  "query": "productivity",
  "limit": 5
}
\`\`\`

Response:
\`\`\`json
[
  {
    "p": "Notes/Getting Things Done.md",
    "t": "Getting Things Done",
    "ex": "...a system for productivity and...",
    "mc": 5,
    "ln": 3
  },
  {
    "p": "Books/Deep Work.md",
    "t": "Deep Work",
    "ex": "...focus and productivity in...",
    "mc": 4,
    "ln": 12
  }
]
\`\`\`

MCPVault: Using read_multiple_notes...

Request:
\`\`\`json
{
  "paths": [
    "Notes/Getting Things Done.md",
    "Books/Deep Work.md"
  ]
}
\`\`\`

Done. I've analyzed the notes. Key concepts include:
• Time blocking and focused work sessions
• Eliminating distractions
• Weekly reviews for planning`,
  },
  {
    title: "Update Metadata",
    description: "Batch update frontmatter across multiple notes",
    tags: ["Frontmatter", "Batch Updates"],
    prompt: "Mark all my project notes as completed",
    response: `MCPVault: Using update_frontmatter...

Request:
\`\`\`json
{
  "path": "Projects/Website Redesign.md",
  "frontmatter": {
    "status": "completed",
    "completed": "2025-01-20"
  }
}
\`\`\`

Response:
Successfully updated frontmatter for: Projects/Website Redesign.md

Done. Updated 4 project notes with completion status`,
  },
];

/** Same segmentation `ResponseRenderer.tsx` used; odd indices are JSON blocks. */
async function renderResponseParts(response: string) {
  const parts = response.split(/```json\n|```/);
  return Promise.all(
    parts.map(async (part, index) => {
      if (index % 2 === 1) {
        const highlighted = await highlightCode(part.trim(), "json");
        return <div class="usage-example-json">{raw(highlighted)}</div>;
      }
      return (
        <pre class="usage-example-text">
          {part}
        </pre>
      );
    }),
  );
}

async function UsageExampleCard({ example, index }: { example: UsageExample; index: number }) {
  const responseParts = await renderResponseParts(example.response);

  return (
    <div class="usage-example fade-in-on-scroll" style={`animation-delay: ${index * 0.2}s`}>
      <div class="usage-example-window">
        <div class="usage-example-header">
          <div class="usage-example-dots">
            <span class="usage-example-dot usage-example-dot--red" />
            <span class="usage-example-dot usage-example-dot--yellow" />
            <span class="usage-example-dot usage-example-dot--green" />
          </div>
          <span class="usage-example-name">{example.title}</span>
          <div class="usage-example-tags">
            {example.tags.map((tag) => (
              <span class="usage-example-tag">{tag}</span>
            ))}
          </div>
        </div>

        <div class="usage-example-body">
          <div class="usage-example-message">
            <div class="usage-example-avatar usage-example-avatar--user">You</div>
            <div class="usage-example-bubble-wrap">
              <div class="usage-example-bubble usage-example-bubble--user">
                <p class="usage-example-prompt">{example.prompt}</p>
              </div>
            </div>
          </div>

          <div class="usage-example-message">
            <div class="usage-example-avatar usage-example-avatar--ai">AI</div>
            <div class="usage-example-bubble-wrap">
              <div class="usage-example-bubble usage-example-bubble--ai">
                <div class="demo-response">{responseParts}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="usage-example-footer">
          <p>{example.description}</p>
        </div>
      </div>
    </div>
  );
}

export async function HowItWorksSection() {
  const cards = await Promise.all(EXAMPLES.map((example, index) => UsageExampleCard({ example, index })));

  return (
    <section data-component="how-it-works" aria-labelledby="how-it-works-heading">
      <div class="how-it-works-inner">
        <div class="how-it-works-header fade-in-on-scroll">
          <h2 id="how-it-works-heading" class="how-it-works-title">
            Usage examples
          </h2>
          <p class="how-it-works-lede">Practical prompts you can try with your AI assistant and MCPVault.</p>
        </div>

        <div class="how-it-works-examples">{cards}</div>

        <div class="how-it-works-cta fade-in-on-scroll">
          <div class="how-it-works-cta-card">
            <div class="how-it-works-cta-icon">
              <TargetIcon className="icon" />
            </div>
            <div class="how-it-works-cta-text">
              <h3 class="how-it-works-cta-title">What these examples cover</h3>
              <p class="how-it-works-cta-description">The prompts show search, batch reads, and frontmatter updates from request to response.</p>
              <a href="/install/" class="how-it-works-cta-link">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Installation
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
