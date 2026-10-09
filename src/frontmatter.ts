import matter from 'gray-matter';
import { parse, stringify, parseDocument } from 'yaml';
import type { ParsedNote, FrontmatterValidationResult } from './types.js';

// Use the 'yaml' package as gray-matter's engine instead of js-yaml.
// js-yaml@3.x (pinned by gray-matter@4) has known quadratic-DoS via
// crafted YAML merge-key aliases (CVE-2023-44270). The 'yaml' package
// is already a dependency (used in preserveStringify) and is not affected.
const yamlEngine = {
  // YAML 1.2 schema (default). Dates stay as strings, but this avoids the
  // yaml-1.1 bug where single-letter keys like 'y'/'n' become booleans.
  // Merge keys (<<) are not resolved, which is fine for Obsidian frontmatter.
  parse: (str: string) => parse(str),
  stringify: (data: any) => stringify(data),
};

function withYamlEngine(options: Record<string, any> = {}): Record<string, any> {
  return { ...options, engines: { yaml: yamlEngine } };
}

/** The dominant line ending of a chunk of text. Defaults to LF when there is none. */
function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

/**
 * Normalize line endings to LF for YAML parsing. Also drops stray CRs: gray-matter
 * hands back the raw matter of a CRLF note with a trailing \r (the one before the
 * closing ---), which YAML would otherwise fold into the last scalar — turning the
 * tag `a` into `a\r`, a different tag as far as Obsidian is concerned.
 */
function toLf(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '');
}

/** Re-apply CRLF to LF-only text. */
function applyEol(text: string, eol: '\r\n' | '\n'): string {
  return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}

/**
 * Parse a frontmatter value that may be a JSON string (LLM clients sometimes
 * pass frontmatter as a serialized JSON string instead of an object).
 * Returns undefined if the value is null/undefined, or throws if invalid.
 */
export function parseFrontmatter(value: any): Record<string, any> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // not valid JSON
    }
    throw new Error('frontmatter must be a JSON object, got a string that is not valid JSON');
  }
  throw new Error(`frontmatter must be a JSON object, got ${typeof value}`);
}

export class FrontmatterHandler {
  parse(content: string): ParsedNote {
    try {
      const parsed = matter(content, withYamlEngine());
      // On a CRLF note the raw matter carries stray CRs that YAML folds into the
      // last scalar, so re-parse the frontmatter from an LF-normalized copy.
      // content/originalContent stay byte-identical — patch_note matches on them.
      let data = parsed.data;
      if (parsed.matter && parsed.matter.includes('\r')) {
        data = (parse(toLf(parsed.matter)) as Record<string, any>) ?? {};
      }
      return {
        frontmatter: data,
        content: parsed.content,
        originalContent: content,
        matter: parsed.matter
      };
    } catch (error) {
      // If parsing fails, treat as content without frontmatter
      return {
        frontmatter: {},
        content: content,
        originalContent: content,
        matter: ''
      };
    }
  }

  stringify(frontmatterData: Record<string, any>, content: string): string {
    try {
      // If no frontmatter, return content as-is
      if (!frontmatterData || Object.keys(frontmatterData).length === 0) {
        return content;
      }

      return matter.stringify(content, frontmatterData, withYamlEngine());
    } catch (error) {
      throw new Error(`Failed to stringify frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  validate(frontmatterData: Record<string, any>): FrontmatterValidationResult {
    const result: FrontmatterValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Test if the frontmatter can be serialized to valid YAML using gray-matter
      matter.stringify('', frontmatterData, withYamlEngine());
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Invalid YAML structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Check for problematic values
    this.checkForProblematicValues(frontmatterData, result, '');

    return result;
  }

  private checkForProblematicValues(
    obj: any,
    result: FrontmatterValidationResult,
    path: string
  ): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'function') {
      result.errors.push(`Functions are not allowed in frontmatter at path: ${path}`);
      result.isValid = false;
      return;
    }

    if (typeof obj === 'symbol') {
      result.errors.push(`Symbols are not allowed in frontmatter at path: ${path}`);
      result.isValid = false;
      return;
    }

    if (obj instanceof Date) {
      // Dates are fine, but warn if they're invalid
      if (isNaN(obj.getTime())) {
        result.warnings.push(`Invalid date at path: ${path}`);
      }
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.checkForProblematicValues(item, result, `${path}[${index}]`);
      });
      return;
    }

    if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;

        // Check for problematic keys
        if (typeof key !== 'string') {
          result.errors.push(`Non-string keys are not allowed: ${key}`);
          result.isValid = false;
        }

        this.checkForProblematicValues(value, result, currentPath);
      }
    }
  }

  preserveStringify(rawMatter: string, updates: Record<string, any>, content: string): string {
    try {
      if (!rawMatter || rawMatter.trim() === '') {
        // No existing frontmatter to preserve - fall back to regular stringify
        if (!updates || Object.keys(updates).length === 0) {
          return content;
        }
        return matter.stringify(content, updates, withYamlEngine());
      }

      // Keep the note's own line endings: the YAML round-trip is done in LF and
      // re-encoded afterwards, so a CRLF note does not come back with an LF
      // frontmatter block glued onto a CRLF body.
      const eol = rawMatter.includes('\r\n') ? '\r\n' : detectEol(content);
      const doc = parseDocument(toLf(rawMatter).trimStart());
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          doc.delete(key);
        } else {
          doc.set(key, value);
        }
      }
      const yamlContent = applyEol(doc.toString(), eol);
      return `---${eol}${yamlContent}---${eol}${content}`;
    } catch (error) {
      throw new Error(`Failed to stringify frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  extractFrontmatter(content: string): Record<string, any> {
    const parsed = this.parse(content);
    return parsed.frontmatter;
  }

  updateFrontmatter(content: string, updates: Record<string, any>): string {
    const parsed = this.parse(content);
    const updatedFrontmatter = { ...parsed.frontmatter, ...updates };

    const validation = this.validate(updatedFrontmatter);
    if (!validation.isValid) {
      throw new Error(`Invalid frontmatter: ${validation.errors.join(', ')}`);
    }

    return this.preserveStringify(parsed.matter || '', updates, parsed.content);
  }
}