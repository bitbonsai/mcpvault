# MCPVault tool examples

Each example shows a prompt, the MCP tool request, and the resulting file operation.

## Exact patch (`patch_note`)

**User:** Add the equation for energy-mass equivalence to my physics notes

**AI uses patch_note:**
```json
{
  "path": "Physics/Relativity.md",
  "oldString": "## Energy and Mass",
  "newString": "## Energy and Mass\n\nE = mc²"
}
```

**Result:** MCPVault replaced the matching section. Surrounding content and frontmatter were unchanged.

## Create a note (`write_note`)

**User:** Create a quick note about today's meeting

**AI uses write_note:**
```json
{
  "path": "Meetings/Team Sync.md",
  "content": "# Team Sync\n\n- Discussed Q1 goals\n- Action items assigned"
}
```

**Result:** MCPVault wrote the note to disk. `write_note` also supports append and prepend modes.

## Read multiple notes (`read_multiple_notes`)

**User:** Read all my book club notes and give me a summary

**AI uses read_multiple_notes:**
```json
{
  "paths": [
    "Reading/The Phoenix Project.md",
    "Reading/Atomic Habits.md",
    "Reading/Deep Work.md"
  ]
}
```

**Result:** All three notes were returned in one request for the client to summarize.

## Update frontmatter (`update_frontmatter`)

**User:** Update the status and add tags to my project planning note

**AI uses update_frontmatter:**
```json
{
  "path": "Projects/Website Redesign.md",
  "frontmatter": {
    "tags": ["project", "web-design", "priority-high"],
    "status": "in-progress",
    "created": "2025-01-15",
    "updated": "2025-01-20"
  }
}
```

**Result:** Existing frontmatter fields kept their formatting, changed fields were updated, and note content was untouched.

## Search content (`search_notes`)

**User:** Search for "React hooks" in my notes

**AI uses search_notes:**
```json
{
  "query": "React hooks",
  "limit": 10
}
```

**Response:**
```json
[
  {
    "p": "Development/React Best Practices.md",
    "t": "React Best Practices",
    "ex": "...State **React hooks** provide...",
    "mc": 8,
    "ln": 42
  },
  {
    "p": "Learning/Modern JavaScript.md",
    "t": "Modern JavaScript",
    "ex": "...useEffect are common **React hooks**...",
    "mc": 3,
    "ln": 156
  }
]
```

**Result:** Found 2 notes with 11 total matches. Token-optimized response with minified field names (p=path, t=title, ex=excerpt, mc=matchCount, ln=lineNumber).

## Technical notes

- `prettyPrint` defaults to false for compact responses
- Write and frontmatter tools validate inputs before writing
- Frontmatter updates preserve formatting for unchanged fields
- Search returns 21-char context excerpts around matches
