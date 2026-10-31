# How MCPVault works

Practical prompts you can try with your AI assistant and MCPVault.

## Search and read notes

**Prompt:** Find my productivity notes and summarize the key concepts

**What happens:**

1. AI calls `search_notes` with query "productivity", limit 5
2. Returns BM25-ranked matching notes with paths and match counts
3. AI calls `read_multiple_notes` with the found paths
4. AI analyzes the content and provides a summary

**Example response:**
- Found notes: "Notes/Getting Things Done.md" (5 matches), "Books/Deep Work.md" (4 matches)
- Key concepts: Time blocking, focused work sessions, eliminating distractions, weekly reviews

## Update metadata

**Prompt:** Mark all my project notes as completed

**What happens:**

1. AI calls `update_frontmatter` for each project note
2. Sets status to "completed" and adds completion date
3. MCPVault merges the changed fields; unmodified keys keep their raw formatting

**Example request:**
```json
{
  "path": "Projects/Website Redesign.md",
  "frontmatter": {
    "status": "completed",
    "completed": "2025-01-20"
  }
}
```

## Available MCP tools

| Tool | Description |
|------|-------------|
| read_note | Read a single note with frontmatter |
| write_note | Create or overwrite a note (supports overwrite, append, prepend modes) |
| patch_note | Replace an exact text match without rewriting the full note |
| list_directory | List files and folders in the vault (includes non-note filenames) |
| delete_note | Delete a note with optional soft-delete: permanent, vault trash, or system trash |
| search_notes | Search by note name or content across the vault |
| move_note | Move or rename a note |
| move_file | Move or rename any file (binary-safe, file-only, requires path confirmation) |
| read_multiple_notes | Batch read up to 10 notes |
| update_frontmatter | Validate and update YAML frontmatter |
| get_notes_info | Get metadata without reading content |
| get_frontmatter | Extract frontmatter only |
| manage_tags | Add, remove, or list tags |
| get_vault_stats | Vault statistics: total notes, folders, size, recent files |
