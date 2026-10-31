/**
 * FAQ section. Ported from FAQ.astro. No icons/raw HTML in the source --
 * plain `<details>`/`<summary>` disclosure widgets, which work with no
 * JavaScript.
 */
interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Does my data leave my computer?",
    a: "MCPVault reads and writes files on your machine and has no hosted service. Your AI client or provider may receive note content used in requests.",
  },
  {
    q: "Does Obsidian need to be running?",
    a: "No. MCPVault uses filesystem access, so Obsidian can be closed.",
  },
  {
    q: "Can I use multiple vaults?",
    a: "Yes. Configure one MCP server entry for each vault path.",
  },
  {
    q: "What file types are supported?",
    a: "Read and write tools support .md, .markdown, .txt, .base, and .canvas files. list_directory may show other filenames, but note tools do not read those files as notes.",
  },
  {
    q: "Is search semantic?",
    a: "Search uses lexical matching with BM25 ranking, not embeddings or a vector index. For semantic search, pair MCPVault with a separate vector-search MCP server such as Qdrant's mcp-server-qdrant or Chroma's chroma-mcp.",
  },
  {
    q: "What if the AI makes a mistake?",
    a: "Use backups or version control for recovery. Deletions require path confirmation, and file operations are restricted to the configured vault.",
  },
];

export function FAQ() {
  return (
    <section data-component="faq" aria-labelledby="faq-heading">
      <div class="faq-inner">
        <div class="faq-header">
          <h2 id="faq-heading" class="faq-title">
            FAQ
          </h2>
          <p class="faq-lede">Setup, file access, and recovery.</p>
        </div>

        <div class="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details class="faq-item">
              <summary class="faq-question">{item.q}</summary>
              <p class="faq-answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
