import { join, resolve, relative, dirname } from 'path';
import { readdir, stat, readFile, writeFile, unlink, mkdir, access, rename, copyFile } from 'node:fs/promises';
import { constants, realpathSync } from 'node:fs';
import trash from 'trash';
import { FrontmatterHandler } from './frontmatter.js';
import { PathFilter } from './pathfilter.js';
import { generateObsidianUri } from './uri.js';
/**
 * Map a filesystem write failure to a clear, accurate Error.
 *
 * Classifies by the Node error `code`, NOT by message substring. The old
 * substring matching (`message.includes('space')`) mislabeled any error whose
 * message merely contained "space" as a disk-full error, producing false
 * "No space left on device" reports (#109). Errors we threw ourselves with a
 * meaningful message (no `code`) pass through unchanged.
 */
export function classifyWriteError(error, path) {
    const code = error instanceof Error ? error.code : undefined;
    switch (code) {
        case 'ENOSPC':
            return new Error(`No space left on device: ${path}`);
        case 'EACCES':
        case 'EPERM':
            return new Error(`Permission denied: ${path}`);
        case 'EROFS':
            return new Error(`Read-only filesystem: ${path}`);
    }
    // No filesystem code: an error we raised with a clear message (path
    // traversal, validation, etc.). Preserve it as-is.
    if (error instanceof Error && !code) {
        return error;
    }
    return new Error(`Failed to write file: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`);
}
export class FileSystemService {
    vaultPath;
    frontmatterHandler;
    pathFilter;
    constructor(vaultPath, pathFilter, frontmatterHandler) {
        this.vaultPath = vaultPath;
        const resolved = resolve(vaultPath);
        try {
            this.vaultPath = realpathSync(resolved);
        }
        catch {
            // Vault path doesn't exist yet or is inaccessible; fall back to lexical resolution
            this.vaultPath = resolved;
        }
        this.pathFilter = pathFilter || new PathFilter();
        this.frontmatterHandler = frontmatterHandler || new FrontmatterHandler();
    }
    resolvePath(relativePath) {
        // Handle undefined or null path
        if (!relativePath) {
            relativePath = '';
        }
        // Trim whitespace from path
        relativePath = relativePath.trim();
        // Normalize and resolve the path within the vault
        const normalizedPath = relativePath.startsWith('/')
            ? relativePath.slice(1)
            : relativePath;
        const fullPath = resolve(join(this.vaultPath, normalizedPath));
        // Security check: ensure path is within vault (lexical)
        const relativeToVault = relative(this.vaultPath, fullPath);
        if (relativeToVault.startsWith('..')) {
            throw new Error(`Path traversal not allowed: ${relativePath}. Paths must be within the vault directory.`);
        }
        // Security check: ensure symlinks don't escape vault boundary
        try {
            const realPath = realpathSync(fullPath);
            const realRelative = relative(this.vaultPath, realPath);
            if (realRelative.startsWith('..')) {
                throw new Error(`Symlink target is outside vault: ${relativePath}. Symbolic links must resolve to a path within the vault directory.`);
            }
        }
        catch (err) {
            if (err instanceof Error && 'code' in err) {
                const code = err.code;
                if (code === 'ENOENT') {
                    // File doesn't exist yet (e.g. writing a new note). Verify the parent directory resolves inside vault.
                    try {
                        const parentReal = realpathSync(dirname(fullPath));
                        const parentRelative = relative(this.vaultPath, parentReal);
                        if (parentRelative.startsWith('..')) {
                            throw new Error(`Symlink target is outside vault: ${relativePath}. Symbolic links must resolve to a path within the vault directory.`);
                        }
                    }
                    catch (parentErr) {
                        // Parent doesn't exist either (will be created by mkdir). Lexical check above is sufficient.
                        if (parentErr instanceof Error && parentErr.message.includes('outside vault')) {
                            throw parentErr;
                        }
                    }
                }
                else if (code === 'ELOOP') {
                    throw new Error(`Circular symlink detected: ${relativePath}. The symbolic link chain forms a loop.`);
                }
                else if (code === 'EACCES') {
                    throw new Error(`Permission denied resolving symlink: ${relativePath}. Cannot verify the symbolic link target is within the vault.`);
                }
                else {
                    throw err;
                }
            }
            else {
                throw err;
            }
        }
        return fullPath;
    }
    async readNote(path) {
        const fullPath = this.resolvePath(path);
        if (!this.pathFilter.isAllowed(path)) {
            throw new Error(`Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`);
        }
        // Check if the path is a directory first
        const isDir = await this.isDirectory(path);
        if (isDir) {
            throw new Error(`Cannot read directory as file: ${path}. Use list_directory tool instead.`);
        }
        try {
            const content = await readFile(fullPath, 'utf-8');
            return this.frontmatterHandler.parse(content);
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                if (error.code === 'ENOENT') {
                    throw new Error(`File not found: ${path}. Use list_directory to see available files, or check the path spelling.`);
                }
                if (error.code === 'EACCES') {
                    throw new Error(`Permission denied: ${path}. The file exists but cannot be read due to filesystem permissions.`);
                }
                if (error.code === 'EISDIR') {
                    throw new Error(`Cannot read directory as file: ${path}. Use list_directory tool instead.`);
                }
            }
            throw new Error(`Failed to read file: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async writeNote(params) {
        const { path, content, frontmatter, mode = 'overwrite' } = params;
        const fullPath = this.resolvePath(path);
        if (!this.pathFilter.isAllowed(path)) {
            throw new Error(`Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`);
        }
        // Validate content is a defined string to prevent writing literal "undefined"
        if (content === undefined || content === null) {
            throw new Error(`Content is required for writing a note: ${path}. The content parameter must be a string.`);
        }
        // Validate frontmatter if provided
        if (frontmatter) {
            const validation = this.frontmatterHandler.validate(frontmatter);
            if (!validation.isValid) {
                throw new Error(`Invalid frontmatter: ${validation.errors.join(', ')}`);
            }
        }
        try {
            let finalContent;
            if (mode === 'overwrite') {
                // Original behavior - replace entire content
                finalContent = frontmatter
                    ? this.frontmatterHandler.stringify(frontmatter, content)
                    : content;
            }
            else {
                // For append/prepend, we need to read existing content
                let existingNote;
                try {
                    existingNote = await this.readNote(path);
                }
                catch (error) {
                    // File doesn't exist, treat as overwrite
                    finalContent = frontmatter
                        ? this.frontmatterHandler.stringify(frontmatter, content)
                        : content;
                }
                if (existingNote) {
                    // Merge frontmatter if provided
                    const mergedFrontmatter = frontmatter
                        ? { ...existingNote.frontmatter, ...frontmatter }
                        : existingNote.frontmatter;
                    const mergedContent = mode === 'append'
                        ? existingNote.content + content
                        : content + existingNote.content;
                    if (existingNote.matter && existingNote.matter.trim() !== '') {
                        // Preserve raw formatting for unmodified fields by only applying explicit updates
                        finalContent = this.frontmatterHandler.preserveStringify(existingNote.matter, frontmatter || {}, mergedContent);
                    }
                    else {
                        finalContent = this.frontmatterHandler.stringify(mergedFrontmatter, mergedContent);
                    }
                }
            }
            // Create directories if they don't exist
            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, finalContent, 'utf-8');
        }
        catch (error) {
            throw classifyWriteError(error, path);
        }
    }
    async patchNote(params) {
        const { path, oldString, newString, replaceAll = false } = params;
        if (!this.pathFilter.isAllowed(path)) {
            return {
                success: false,
                path,
                message: `Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        // Validate that strings are not empty
        if (!oldString || oldString.trim() === '') {
            return {
                success: false,
                path,
                message: 'oldString cannot be empty'
            };
        }
        if (newString === undefined || newString === null) {
            return {
                success: false,
                path,
                message: 'newString is required'
            };
        }
        // Validate that oldString and newString are different
        if (oldString === newString) {
            return {
                success: false,
                path,
                message: 'oldString and newString must be different'
            };
        }
        try {
            // Read the existing note
            const note = await this.readNote(path);
            // Get the full content with frontmatter
            const fullContent = note.originalContent;
            // Count occurrences of oldString
            const occurrences = fullContent.split(oldString).length - 1;
            if (occurrences === 0) {
                return {
                    success: false,
                    path,
                    message: `String not found in note: "${oldString.substring(0, 50)}${oldString.length > 50 ? '...' : ''}"`,
                    matchCount: 0
                };
            }
            // If not replaceAll and multiple occurrences exist, fail
            if (!replaceAll && occurrences > 1) {
                return {
                    success: false,
                    path,
                    message: `Found ${occurrences} occurrences of the string. Use replaceAll=true to replace all occurrences, or provide a more specific string to match exactly one occurrence.`,
                    matchCount: occurrences
                };
            }
            // Perform the replacement
            const updatedContent = replaceAll
                ? fullContent.split(oldString).join(newString)
                : fullContent.replace(oldString, newString);
            // Write the updated content
            const fullPath = this.resolvePath(path);
            await writeFile(fullPath, updatedContent, 'utf-8');
            return {
                success: true,
                path,
                message: `Successfully replaced ${replaceAll ? occurrences : 1} occurrence${occurrences > 1 ? 's' : ''}`,
                matchCount: occurrences
            };
        }
        catch (error) {
            return {
                success: false,
                path,
                message: `Failed to patch note: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async listDirectory(path = '') {
        // Normalize path: treat '.' as root directory
        const normalizedPath = path === '.' ? '' : path;
        const fullPath = this.resolvePath(normalizedPath);
        try {
            const entries = await readdir(fullPath, { withFileTypes: true });
            const files = [];
            const directories = [];
            for (const entry of entries) {
                const entryPath = normalizedPath ? `${normalizedPath}/${entry.name}` : entry.name;
                if (!this.pathFilter.isAllowedForListing(entryPath)) {
                    continue;
                }
                if (entry.isSymbolicLink()) {
                    // Follow symlinks that resolve inside the vault
                    try {
                        const entryFullPath = join(fullPath, entry.name);
                        const realPath = realpathSync(entryFullPath);
                        const realRelative = relative(this.vaultPath, realPath);
                        if (realRelative.startsWith('..')) {
                            continue; // Symlink target outside vault, skip silently
                        }
                        const targetStat = await stat(entryFullPath);
                        if (targetStat.isDirectory()) {
                            directories.push(entry.name);
                        }
                        else if (targetStat.isFile()) {
                            files.push(entry.name);
                        }
                    }
                    catch {
                        continue; // Broken/circular/inaccessible symlink, skip silently
                    }
                }
                else if (entry.isDirectory()) {
                    directories.push(entry.name);
                }
                else if (entry.isFile()) {
                    files.push(entry.name);
                }
            }
            return {
                files: files.sort(),
                directories: directories.sort()
            };
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('not found') || error.message.includes('ENOENT')) {
                    throw new Error(`Directory not found: ${path}. Use list_directory with no path or '/' to see root folders.`);
                }
                if (error.message.includes('permission') || error.message.includes('access')) {
                    throw new Error(`Permission denied: ${path}. The directory exists but cannot be read due to filesystem permissions.`);
                }
                if (error.message.includes('not a directory') || error.message.includes('ENOTDIR')) {
                    throw new Error(`Not a directory: ${path}. This path points to a file, not a folder. Use read_note to read files.`);
                }
            }
            throw new Error(`Failed to list directory: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async exists(path) {
        const fullPath = this.resolvePath(path);
        if (!this.pathFilter.isAllowed(path)) {
            return false;
        }
        try {
            await access(fullPath, constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async isDirectory(path) {
        const fullPath = this.resolvePath(path);
        if (!this.pathFilter.isAllowed(path)) {
            return false;
        }
        try {
            const stats = await stat(fullPath);
            return stats.isDirectory();
        }
        catch {
            return false;
        }
    }
    async deleteNote(params) {
        const { path, confirmPath, trashMode = 'none' } = params;
        // Confirmation check - paths must match exactly
        if (path !== confirmPath) {
            return {
                success: false,
                path: path,
                message: "Deletion cancelled: confirmation path does not match. For safety, both 'path' and 'confirmPath' must be identical."
            };
        }
        const fullPath = this.resolvePath(path);
        if (!this.pathFilter.isAllowed(path)) {
            return {
                success: false,
                path: path,
                message: `Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        try {
            // Check if it's a directory first (can't delete directories with this method)
            const isDir = await this.isDirectory(path);
            if (isDir) {
                return {
                    success: false,
                    path: path,
                    message: `Cannot delete: ${path} is not a file`
                };
            }
            if (trashMode === 'local') {
                const trashDir = join(this.vaultPath, '.trash');
                const trashPath = join(trashDir, path);
                // Ensure trash directory exists
                await mkdir(dirname(trashPath), { recursive: true });
                // Handle collisions by appending a timestamp
                let finalTrashPath = trashPath;
                try {
                    await access(finalTrashPath, constants.F_OK);
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const ext = path.endsWith('.md') ? '.md' : '';
                    const base = ext ? path.slice(0, -ext.length) : path;
                    const collidedPath = `${base}-${timestamp}${ext}`;
                    finalTrashPath = join(trashDir, collidedPath);
                }
                catch {
                    // File does not exist in trash, no collision
                }
                await rename(fullPath, finalTrashPath);
                return {
                    success: true,
                    path: path,
                    message: `Successfully moved note to vault trash: ${path}`
                };
            }
            if (trashMode === 'system') {
                await trash(fullPath);
                return {
                    success: true,
                    path: path,
                    message: `Successfully moved note to system trash: ${path}`
                };
            }
            // Perform the deletion using Node.js native API
            await unlink(fullPath);
            return {
                success: true,
                path: path,
                message: `Successfully deleted note: ${path}. This action cannot be undone.`
            };
        }
        catch (error) {
            if (error instanceof Error && 'code' in error) {
                if (error.code === 'ENOENT') {
                    return {
                        success: false,
                        path: path,
                        message: `File not found: ${path}. Use list_directory to see available files.`
                    };
                }
                if (error.code === 'EACCES') {
                    return {
                        success: false,
                        path: path,
                        message: `Permission denied: ${path}. The file exists but cannot be deleted due to filesystem permissions.`
                    };
                }
            }
            return {
                success: false,
                path: path,
                message: `Failed to delete file: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async moveNote(params) {
        const { oldPath, newPath, overwrite = false } = params;
        if (!this.pathFilter.isAllowed(oldPath)) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Access denied: ${oldPath}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        if (!this.pathFilter.isAllowed(newPath)) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Access denied: ${newPath}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        const oldFullPath = this.resolvePath(oldPath);
        const newFullPath = this.resolvePath(newPath);
        try {
            // Read source content (will throw ENOENT if not found)
            let content;
            try {
                content = await readFile(oldFullPath, 'utf-8');
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                    return {
                        success: false,
                        oldPath,
                        newPath,
                        message: `Source file not found: ${oldPath}. Use list_directory to see available files.`
                    };
                }
                throw error;
            }
            // Create directories if needed
            await mkdir(dirname(newFullPath), { recursive: true });
            // Write to new location, checking for existing file atomically if !overwrite
            try {
                if (overwrite) {
                    await writeFile(newFullPath, content, 'utf-8');
                }
                else {
                    // wx flag: write exclusive - fails if file exists
                    await writeFile(newFullPath, content, { encoding: 'utf-8', flag: 'wx' });
                }
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
                    return {
                        success: false,
                        oldPath,
                        newPath,
                        message: `Target file already exists: ${newPath}. Use overwrite=true to replace it.`
                    };
                }
                throw error;
            }
            // Delete the source file
            await unlink(oldFullPath);
            return {
                success: true,
                oldPath,
                newPath,
                message: `Successfully moved note from ${oldPath} to ${newPath}`
            };
        }
        catch (error) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Failed to move note: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async moveFile(params) {
        const { oldPath, newPath, confirmOldPath, confirmNewPath, overwrite = false } = params;
        if (oldPath !== confirmOldPath || newPath !== confirmNewPath) {
            return {
                success: false,
                oldPath,
                newPath,
                message: "Move cancelled: confirmation paths do not match. For safety, oldPath must equal confirmOldPath and newPath must equal confirmNewPath."
            };
        }
        if (!this.pathFilter.isAllowedForListing(oldPath)) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Access denied: ${oldPath}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        if (!this.pathFilter.isAllowedForListing(newPath)) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Access denied: ${newPath}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        const oldFullPath = this.resolvePath(oldPath);
        const newFullPath = this.resolvePath(newPath);
        try {
            const sourceStat = await stat(oldFullPath);
            if (sourceStat.isDirectory()) {
                return {
                    success: false,
                    oldPath,
                    newPath,
                    message: `Source path is a directory: ${oldPath}. move_file currently supports files only.`
                };
            }
        }
        catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return {
                    success: false,
                    oldPath,
                    newPath,
                    message: `Source file not found: ${oldPath}. Use list_directory to see available files.`
                };
            }
            return {
                success: false,
                oldPath,
                newPath,
                message: `Failed to inspect source file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
        try {
            if (!overwrite) {
                try {
                    await access(newFullPath, constants.F_OK);
                    return {
                        success: false,
                        oldPath,
                        newPath,
                        message: `Target file already exists: ${newPath}. Use overwrite=true to replace it.`
                    };
                }
                catch (error) {
                    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
                        throw error;
                    }
                }
            }
            await mkdir(dirname(newFullPath), { recursive: true });
            if (overwrite) {
                try {
                    const targetStat = await stat(newFullPath);
                    if (targetStat.isDirectory()) {
                        return {
                            success: false,
                            oldPath,
                            newPath,
                            message: `Target path is a directory: ${newPath}. Please provide a file path.`
                        };
                    }
                    await unlink(newFullPath);
                }
                catch (error) {
                    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
                        throw error;
                    }
                }
            }
            try {
                await rename(oldFullPath, newFullPath);
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'EXDEV') {
                    await copyFile(oldFullPath, newFullPath);
                    await unlink(oldFullPath);
                }
                else {
                    throw error;
                }
            }
            return {
                success: true,
                oldPath,
                newPath,
                message: `Successfully moved file from ${oldPath} to ${newPath}`
            };
        }
        catch (error) {
            return {
                success: false,
                oldPath,
                newPath,
                message: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async readMultipleNotes(params) {
        const { paths, includeContent = true, includeFrontmatter = true } = params;
        if (paths.length > 10) {
            throw new Error('Maximum 10 files per batch read request');
        }
        const results = await Promise.allSettled(paths.map(async (path) => {
            if (!this.pathFilter.isAllowed(path)) {
                throw new Error(`Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`);
            }
            const note = await this.readNote(path);
            const result = {
                path,
                obsidianUri: generateObsidianUri(this.vaultPath, path)
            };
            if (includeFrontmatter) {
                result.frontmatter = note.frontmatter;
            }
            if (includeContent) {
                result.content = note.content;
            }
            return result;
        }));
        const successful = [];
        const failed = [];
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                successful.push(result.value);
            }
            else {
                failed.push({
                    path: paths[index] || '',
                    error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
                });
            }
        });
        return { successful, failed };
    }
    async updateFrontmatter(params) {
        const { path, frontmatter, merge = true } = params;
        if (!this.pathFilter.isAllowed(path)) {
            throw new Error(`Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`);
        }
        // Read the existing note
        const note = await this.readNote(path);
        // Prepare new frontmatter
        const newFrontmatter = merge
            ? { ...note.frontmatter, ...frontmatter }
            : frontmatter;
        // Validate the new frontmatter
        const validation = this.frontmatterHandler.validate(newFrontmatter);
        if (!validation.isValid) {
            throw new Error(`Invalid frontmatter: ${validation.errors.join(', ')}`);
        }
        const fullPath = this.resolvePath(path);
        if (merge && note.matter && note.matter.trim() !== '') {
            // Preserve raw formatting for unmodified fields
            const updatedContent = this.frontmatterHandler.preserveStringify(note.matter, frontmatter, note.content);
            await writeFile(fullPath, updatedContent, 'utf-8');
        }
        else {
            // Replace frontmatter entirely (or no existing matter to preserve)
            await this.writeNote({
                path,
                content: note.content,
                frontmatter: newFrontmatter
            });
        }
    }
    async getNotesInfo(paths) {
        const results = await Promise.allSettled(paths.map(async (path) => {
            if (!this.pathFilter.isAllowed(path)) {
                throw new Error(`Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`);
            }
            const fullPath = this.resolvePath(path);
            let stats;
            try {
                stats = await stat(fullPath);
            }
            catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                    throw new Error(`File not found: ${path}`);
                }
                throw error;
            }
            const size = stats.size;
            const lastModified = stats.mtime.getTime();
            // Quick check for frontmatter without reading full content
            const file = await readFile(fullPath, 'utf-8');
            const firstChunk = file.slice(0, 100);
            const hasFrontmatter = firstChunk.startsWith('---\n');
            return {
                path,
                size,
                modified: lastModified,
                hasFrontmatter,
                obsidianUri: generateObsidianUri(this.vaultPath, path)
            };
        }));
        // Return only successful results, filter out failed ones
        return results
            .filter((result) => result.status === 'fulfilled')
            .map(result => result.value);
    }
    async manageTags(params) {
        const { path, operation, tags = [] } = params;
        if (!this.pathFilter.isAllowed(path)) {
            return {
                path,
                operation,
                tags: [],
                success: false,
                message: `Access denied: ${path}. This path is restricted (system files like .obsidian, .git, and dotfiles are not accessible).`
            };
        }
        try {
            const note = await this.readNote(path);
            let currentTags = [];
            // Extract tags from frontmatter
            if (note.frontmatter.tags) {
                if (Array.isArray(note.frontmatter.tags)) {
                    currentTags = note.frontmatter.tags;
                }
                else if (typeof note.frontmatter.tags === 'string') {
                    currentTags = [note.frontmatter.tags];
                }
            }
            // Also extract inline tags from content
            const inlineTagMatches = note.content.match(/#[a-zA-Z0-9_-]+/g) || [];
            const inlineTags = inlineTagMatches.map(tag => tag.slice(1)); // Remove #
            currentTags = [...new Set([...currentTags, ...inlineTags])]; // Deduplicate
            if (operation === 'list') {
                return {
                    path,
                    operation,
                    tags: currentTags,
                    success: true
                };
            }
            let newTags = [...currentTags];
            if (operation === 'add') {
                for (const tag of tags) {
                    if (!newTags.includes(tag)) {
                        newTags.push(tag);
                    }
                }
            }
            else if (operation === 'remove') {
                newTags = newTags.filter(tag => !tags.includes(tag));
            }
            // Build tag updates for preserveStringify
            const tagUpdates = {};
            if (newTags.length > 0) {
                tagUpdates.tags = newTags;
            }
            else {
                tagUpdates.tags = undefined;
            }
            // Write back the note with updated frontmatter, preserving raw formatting for unmodified fields
            let updatedContent;
            if (note.matter && note.matter.trim() !== '') {
                updatedContent = this.frontmatterHandler.preserveStringify(note.matter, tagUpdates, note.content);
            }
            else {
                const updatedFrontmatter = { ...note.frontmatter };
                if (newTags.length > 0) {
                    updatedFrontmatter.tags = newTags;
                }
                else {
                    delete updatedFrontmatter.tags;
                }
                updatedContent = this.frontmatterHandler.stringify(updatedFrontmatter, note.content);
            }
            const fullPath = this.resolvePath(path);
            await writeFile(fullPath, updatedContent, 'utf-8');
            return {
                path,
                operation,
                tags: newTags,
                success: true,
                message: `Successfully ${operation === 'add' ? 'added' : 'removed'} tags`
            };
        }
        catch (error) {
            return {
                path,
                operation,
                tags: [],
                success: false,
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    getVaultPath() {
        return this.vaultPath;
    }
    async getVaultStats(recentCount = 5) {
        let totalNotes = 0;
        let totalFolders = 0;
        let totalSize = 0;
        const recentFiles = [];
        const scanDirectory = async (dirPath, relativePath = '') => {
            const entries = await readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                const fullEntryPath = join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    if (!this.pathFilter.isAllowedForListing(entryRelativePath)) {
                        continue;
                    }
                    totalFolders++;
                    await scanDirectory(fullEntryPath, entryRelativePath);
                }
                else if (entry.isFile()) {
                    if (!this.pathFilter.isAllowed(entryRelativePath)) {
                        continue;
                    }
                    totalNotes++;
                    const stats = await stat(fullEntryPath);
                    totalSize += stats.size;
                    // Track recent files
                    const fileInfo = { path: entryRelativePath, modified: stats.mtime.getTime() };
                    // Insert in sorted order (most recent first)
                    const insertIndex = recentFiles.findIndex(f => f.modified < fileInfo.modified);
                    if (insertIndex === -1) {
                        if (recentFiles.length < recentCount) {
                            recentFiles.push(fileInfo);
                        }
                    }
                    else {
                        recentFiles.splice(insertIndex, 0, fileInfo);
                        if (recentFiles.length > recentCount) {
                            recentFiles.pop();
                        }
                    }
                }
            }
        };
        await scanDirectory(this.vaultPath);
        return {
            totalNotes,
            totalFolders,
            totalSize,
            recentlyModified: recentFiles
        };
    }
    async listAllTags() {
        const tagCounts = new Map();
        const inlineTagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/\-]*)/g;
        const scanDirectory = async (dirPath, relativePath = '') => {
            const entries = await readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                const fullEntryPath = join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    if (!this.pathFilter.isAllowedForListing(entryRelativePath))
                        continue;
                    await scanDirectory(fullEntryPath, entryRelativePath);
                }
                else if (entry.isFile() && this.pathFilter.isAllowed(entryRelativePath)) {
                    try {
                        const content = await readFile(fullEntryPath, 'utf-8');
                        const parsed = this.frontmatterHandler.parse(content);
                        // Frontmatter tags
                        const fmTags = parsed.frontmatter?.tags;
                        if (Array.isArray(fmTags)) {
                            for (const tag of fmTags) {
                                if (typeof tag === 'string' && tag.trim()) {
                                    const normalized = tag.trim().toLowerCase();
                                    tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
                                }
                            }
                        }
                        // Inline #tags from body content
                        let match;
                        while ((match = inlineTagRegex.exec(parsed.content)) !== null) {
                            const normalized = match[1].toLowerCase();
                            tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
                        }
                    }
                    catch {
                        // Skip files that can't be read
                    }
                }
            }
        };
        await scanDirectory(this.vaultPath);
        return Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
    }
}
