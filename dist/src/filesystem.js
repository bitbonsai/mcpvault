import { join, resolve, relative, dirname, basename } from 'path';
import { readdir, stat, readFile, writeFile, unlink, mkdir, access, rename, copyFile } from 'node:fs/promises';
import { constants, realpathSync } from 'node:fs';
import { FrontmatterHandler } from './frontmatter.js';
import { PathFilter } from './pathfilter.js';
import { generateObsidianUri } from './uri.js';
/** Folder inside the vault where soft-deleted / overwritten originals are kept */
const TRASH_FOLDER = '_trash';
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
                // Read and snapshot the original content FIRST, before any writes
                const fileExists = await this.exists(path);
                if (fileExists) {
                    const originalContent = await readFile(fullPath, 'utf-8');
                    await this.backupToTrash(path, originalContent);
                }
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
                    if (mode === 'append') {
                        finalContent = this.frontmatterHandler.stringify(mergedFrontmatter, existingNote.content + content);
                    }
                    else if (mode === 'prepend') {
                        finalContent = this.frontmatterHandler.stringify(mergedFrontmatter, content + existingNote.content);
                    }
                }
            }
            // Create directories if they don't exist
            await mkdir(dirname(fullPath), { recursive: true });
            await writeFile(fullPath, finalContent, 'utf-8');
        }
        catch (error) {
            if (error instanceof Error) {
                if (error.message.includes('permission') || error.message.includes('access')) {
                    throw new Error(`Permission denied: ${path}`);
                }
                if (error.message.includes('space') || error.message.includes('ENOSPC')) {
                    throw new Error(`No space left on device: ${path}`);
                }
            }
            throw new Error(`Failed to write file: ${path} - ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        if (!newString) {
            return {
                success: false,
                path,
                message: 'newString cannot be empty'
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
            // Back up the original content we already read — pass it directly
            // so the backup is guaranteed to be the pre-patch state
            await this.backupToTrash(path, fullContent);
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
    /**
     * Save a snapshot of a file to _trash/ with a timestamped "deleted-" prefix.
     * Can accept pre-read content to guarantee the backup captures the correct state
     * even if the file on disk has already been modified by a prior operation.
     */
    async backupToTrash(relativePath, snapshotContent) {
        const fullPath = this.resolvePath(relativePath);
        // Build trash destination: _trash/deleted-20260326-153012-OriginalName.md
        const now = new Date();
        const timestamp = now.getFullYear().toString()
            + String(now.getMonth() + 1).padStart(2, '0')
            + String(now.getDate()).padStart(2, '0')
            + '-'
            + String(now.getHours()).padStart(2, '0')
            + String(now.getMinutes()).padStart(2, '0')
            + String(now.getSeconds()).padStart(2, '0'); // 20260326-153012
        const fileName = basename(relativePath);
        const trashRelative = `${TRASH_FOLDER}/deleted-${timestamp}-${fileName}`;
        const trashFull = join(this.vaultPath, trashRelative);
        // Ensure _trash/ exists
        await mkdir(dirname(trashFull), { recursive: true });
        if (snapshotContent !== undefined) {
            // Write the pre-captured content — guaranteed to be the original state
            await writeFile(trashFull, snapshotContent, 'utf-8');
        }
        else {
            // Read from disk right now and write to trash
            const content = await readFile(fullPath, 'utf-8');
            await writeFile(trashFull, content, 'utf-8');
        }
        return trashRelative;
    }
    /**
     * Soft-delete: moves the file to _trash/ instead of permanently deleting it.
     */
    async softDeleteNote(path) {
        if (!this.pathFilter.isAllowed(path)) {
            return {
                success: false,
                path,
                message: `Access denied: ${path}. This path is restricted.`
            };
        }
        const fullPath = this.resolvePath(path);
        // Can't delete directories
        const isDir = await this.isDirectory(path);
        if (isDir) {
            return { success: false, path, message: `Cannot delete: ${path} is a directory, not a file.` };
        }
        // Check exists
        const fileExists = await this.exists(path);
        if (!fileExists) {
            return { success: false, path, message: `File not found: ${path}. Use list_directory to see available files.` };
        }
        try {
            // Read the content first, then save to trash with that snapshot
            const originalContent = await readFile(fullPath, 'utf-8');
            const trashPath = await this.backupToTrash(path, originalContent);
            // Remove original
            await unlink(fullPath);
            return {
                success: true,
                path,
                trashPath,
                message: `Soft-deleted ${path} → moved to ${trashPath}. You can recover it from the _trash folder.`
            };
        }
        catch (error) {
            return {
                success: false,
                path,
                message: `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        // Update the note with new frontmatter, preserving content
        await this.writeNote({
            path,
            content: note.content,
            frontmatter: newFrontmatter
        });
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
            // Update frontmatter with new tags
            const updatedFrontmatter = {
                ...note.frontmatter
            };
            if (newTags.length > 0) {
                updatedFrontmatter.tags = newTags;
            }
            else if ('tags' in updatedFrontmatter) {
                delete updatedFrontmatter.tags;
            }
            // Write back the note with updated frontmatter
            await this.writeNote({
                path,
                content: note.content,
                frontmatter: updatedFrontmatter,
                mode: 'overwrite'
            });
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
