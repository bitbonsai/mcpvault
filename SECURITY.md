# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| Latest npm release | Yes |
| Older releases | No |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them via GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/bitbonsai/mcpvault/security)
2. Click "Report a vulnerability"
3. Include the affected version, reproduction steps, and impact

### What to include

- Type of vulnerability (path traversal, injection, data leak, etc.)
- Step-by-step reproduction instructions
- Affected versions
- Potential impact
- Suggested fix, if you have one

### Response timeline

- **Initial response**: within 72 hours
- **Status update**: within 7 days
- **Fix timeline**: depends on severity, typically 30 days for critical issues

## Security scope

### In scope

Given that this MCP server accesses personal data in Obsidian vaults, we consider the following as security vulnerabilities:

- **Path traversal**: accessing files outside the vault directory
- **Arbitrary file access**: reading/writing to system files, dotfiles, or `.obsidian/` configuration
- **Command injection**: executing arbitrary commands via tool parameters
- **Data exfiltration**: unintended data exposure to unauthorized parties
- **Frontmatter corruption**: malicious YAML that could exploit parsers
- **Denial of service**: crashes or resource exhaustion via malformed input
- **Supply chain**: compromised dependencies or build process

### Out of scope

- Vulnerabilities in the MCP protocol itself (report to [Anthropic](https://github.com/anthropics/modelcontextprotocol))
- Vulnerabilities in Obsidian (report to [Obsidian](https://obsidian.md/security))
- Issues requiring physical access to the machine
- Social engineering attacks
- Vulnerabilities in dependencies with no realistic exploit path in this context

## Security controls

- **Path filtering**: blocks access to `.obsidian/`, `.git/`, `node_modules/`, and system files
- **Path traversal prevention**: validates all paths stay within vault boundaries
- **Frontmatter validation**: blocks functions, symbols, and potentially dangerous YAML constructs
- **Confirmation parameters**: `delete_note` and `move_file` require matching path confirmation
- **Dependency security**: automated updates via Dependabot, npm audit in CI
- **Static analysis**: CodeQL scans on every PR and weekly
- **Provenance**: npm packages published with SLSA provenance attestation

## Published advisories

Resolved vulnerabilities are listed in the repository's [security advisories](https://github.com/bitbonsai/mcpvault/security/advisories).
