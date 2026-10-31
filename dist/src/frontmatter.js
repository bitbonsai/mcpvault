import matter from 'gray-matter';
import { parse, stringify, parseDocument } from 'yaml';
// Use the 'yaml' package as gray-matter's engine instead of js-yaml.
// js-yaml@3.x (pinned by gray-matter@4) has known quadratic-DoS via
// crafted YAML merge-key aliases (CVE-2023-44270). The 'yaml' package
// is already a dependency (used in preserveStringify) and is not affected.
const yamlEngine = {
    // YAML 1.2 schema (default). Dates stay as strings, but this avoids the
    // yaml-1.1 bug where single-letter keys like 'y'/'n' become booleans.
    // Merge keys (<<) are not resolved, which is fine for Obsidian frontmatter.
    parse: (str) => parse(toLf(str)),
    stringify: (data) => stringify(data),
};
function withYamlEngine(options = {}) {
    return {
        ...options,
        engines: {
            yaml: yamlEngine,
            // gray-matter merges default engines; override JavaScript to prevent eval, including its js alias.
            javascript: {
                parse: () => { throw new Error('JavaScript frontmatter is not supported'); },
            },
        },
    };
}
/** Use CRLF when present, otherwise LF. */
function detectEol(text) {
    return text.includes('\r\n') ? '\r\n' : '\n';
}
// gray-matter leaves a trailing CR before the closing delimiter; normalize before YAML parsing.
function toLf(text) {
    return text.replace(/\r\n?/g, '\n');
}
/** Re-apply CRLF to LF-only text. */
function applyEol(text, eol) {
    return eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text;
}
/**
 * Parse a frontmatter value that may be a JSON string (LLM clients sometimes
 * pass frontmatter as a serialized JSON string instead of an object).
 * Returns undefined if the value is null/undefined, or throws if invalid.
 */
export function parseFrontmatter(value) {
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
        }
        catch {
            // not valid JSON
        }
        throw new Error('frontmatter must be a JSON object, got a string that is not valid JSON');
    }
    throw new Error(`frontmatter must be a JSON object, got ${typeof value}`);
}
export class FrontmatterHandler {
    parse(content) {
        try {
            const parsed = matter(content, withYamlEngine());
            return {
                frontmatter: parsed.data,
                content: parsed.content,
                originalContent: content,
                matter: parsed.matter
            };
        }
        catch (error) {
            // If parsing fails, treat as content without frontmatter
            return {
                frontmatter: {},
                content: content,
                originalContent: content,
                matter: ''
            };
        }
    }
    stringify(frontmatterData, content) {
        try {
            // If no frontmatter, return content as-is
            if (!frontmatterData || Object.keys(frontmatterData).length === 0) {
                return content;
            }
            const eol = detectEol(content);
            // Serialize only the header so body bytes stay untouched; drop gray-matter's empty-body newline.
            const header = matter.stringify('', frontmatterData, withYamlEngine()).slice(0, -1);
            return applyEol(header, eol) + content + (content.endsWith('\n') ? '' : eol);
        }
        catch (error) {
            throw new Error(`Failed to stringify frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    validate(frontmatterData) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        try {
            // Test if the frontmatter can be serialized to valid YAML using gray-matter
            matter.stringify('', frontmatterData, withYamlEngine());
        }
        catch (error) {
            result.isValid = false;
            result.errors.push(`Invalid YAML structure: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Check for problematic values
        this.checkForProblematicValues(frontmatterData, result, '');
        return result;
    }
    checkForProblematicValues(obj, result, path) {
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
    preserveStringify(rawMatter, updates, content) {
        try {
            if (!rawMatter || rawMatter.trim() === '') {
                // No existing frontmatter to preserve - fall back to regular stringify
                if (!updates || Object.keys(updates).length === 0) {
                    return content;
                }
                return this.stringify(updates, content);
            }
            // Normalize only YAML; preserve the body's original bytes.
            const eol = rawMatter.includes('\r\n') ? '\r\n' : detectEol(content);
            const doc = parseDocument(toLf(rawMatter).trimStart());
            for (const [key, value] of Object.entries(updates)) {
                if (value === undefined) {
                    doc.delete(key);
                }
                else {
                    doc.set(key, value);
                }
            }
            const yamlContent = applyEol(doc.toString(), eol);
            return `---${eol}${yamlContent}---${eol}${content}`;
        }
        catch (error) {
            throw new Error(`Failed to stringify frontmatter: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractFrontmatter(content) {
        const parsed = this.parse(content);
        return parsed.frontmatter;
    }
    updateFrontmatter(content, updates) {
        const parsed = this.parse(content);
        const updatedFrontmatter = { ...parsed.frontmatter, ...updates };
        const validation = this.validate(updatedFrontmatter);
        if (!validation.isValid) {
            throw new Error(`Invalid frontmatter: ${validation.errors.join(', ')}`);
        }
        return this.preserveStringify(parsed.matter || '', updates, parsed.content);
    }
}
