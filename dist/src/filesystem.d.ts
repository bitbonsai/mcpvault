import { FrontmatterHandler } from './frontmatter.js';
import { PathFilter } from './pathfilter.js';
import type { ParsedNote, DirectoryListing, NoteWriteParams, DeleteNoteParams, DeleteResult, MoveNoteParams, MoveFileParams, MoveResult, CreateFolderParams, DeleteFolderParams, FolderResult, BatchReadParams, BatchReadResult, UpdateFrontmatterParams, NoteInfo, TagManagementParams, TagManagementResult, PatchNoteParams, PatchNoteResult, VaultStats, NoteHeading, ReadNoteLinesParams } from './types.js';
/**
 * Map a filesystem write failure to a clear, accurate Error.
 *
 * Classifies by the Node error `code`, NOT by message substring. The old
 * substring matching (`message.includes('space')`) mislabeled any error whose
 * message merely contained "space" as a disk-full error, producing false
 * "No space left on device" reports (#109). Errors we threw ourselves with a
 * meaningful message (no `code`) pass through unchanged.
 */
export declare function classifyWriteError(error: unknown, path: string): Error;
export declare class FileSystemService {
    private vaultPath;
    private frontmatterHandler;
    private pathFilter;
    private writeChains;
    constructor(vaultPath: string, pathFilter?: PathFilter, frontmatterHandler?: FrontmatterHandler);
    /**
     * Normalize an incoming path to be vault-relative. Strips leading slashes
     * and the vault path prefix when a caller accidentally passes an absolute path
     * (e.g. "/Users/me/vault/wiki/note.md" instead of "wiki/note.md").
     */
    private normalizePath;
    private resolvePath;
    private withPathLock;
    private atomicWrite;
    readNote(path: string): Promise<ParsedNote>;
    writeNote(params: NoteWriteParams): Promise<void>;
    patchNote(params: PatchNoteParams): Promise<PatchNoteResult>;
    listDirectory(path?: string): Promise<DirectoryListing>;
    exists(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    deleteNote(params: DeleteNoteParams): Promise<DeleteResult>;
    /**
     * Normalize a folder path argument: vault-relative, no trailing slashes.
     */
    private normalizeFolderPath;
    /**
     * Folder paths may not contain "." or ".." segments: the path filter's
     * canonical form strips trailing dots, so "." would otherwise pass and
     * resolve to the vault root itself.
     */
    private isAllowedFolderPath;
    /**
     * Resolve a folder path inside the vault and check that the real location of
     * its nearest existing ancestor is not a restricted path. Without this, a
     * symlinked folder inside the vault (e.g. `link -> .obsidian`) would let the
     * folder tools create or remove folders under a restricted directory.
     */
    private resolveFolderPath;
    private static folderErrorCode;
    /**
     * Create a folder (and its parents) inside the vault. Idempotent: an existing
     * folder is reported as success with `created: false`. Refuses the vault root,
     * dot folders and restricted names, a path that is an existing file, and a
     * name differing only in case from an existing sibling (Obsidian Sync on a
     * case-insensitive device keeps only one of the two).
     */
    createFolder(params: CreateFolderParams): Promise<FolderResult>;
    /**
     * Delete a folder. By default only an empty folder is removed (rmdir).
     * recursive=true is accepted only with trashMode 'local', which moves the
     * whole folder to .trash/<path> so it can be restored: this server never
     * erases a non-empty folder for good. Refuses the vault root, dot folders,
     * symbolic links and paths outside the vault.
     */
    deleteFolder(params: DeleteFolderParams): Promise<FolderResult>;
    moveNote(params: MoveNoteParams): Promise<MoveResult>;
    moveFile(params: MoveFileParams): Promise<MoveResult>;
    readMultipleNotes(params: BatchReadParams): Promise<BatchReadResult>;
    updateFrontmatter(params: UpdateFrontmatterParams): Promise<void>;
    getNotesInfo(paths: string[]): Promise<NoteInfo[]>;
    manageTags(params: TagManagementParams): Promise<TagManagementResult>;
    getVaultPath(): string;
    /**
     * Resolve an Obsidian wiki link name to its vault-relative paths.
     * Scans the vault for exact filename matches (name + .md).
     *
     * A name containing `/` is path-qualified (Obsidian emits these when a
     * basename is ambiguous, e.g. [[folder/Note]]): it must match the full
     * vault-relative path instead of just the basename.
     *
     * Returns all matches sorted root-first (by path depth ascending), with
     * alphabetical tiebreak at equal depth. Empty array on zero matches.
     * The caller decides how to handle zero/single/multi — this function does
     * not throw on lookup outcomes.
     *
     * Throws only on caller misuse (empty name).
     */
    findPathForWikiLink(wikiLinkName: string): Promise<string[]>;
    getNoteOutline(path: string): Promise<NoteHeading[]>;
    readNoteLines(params: ReadNoteLinesParams): Promise<string>;
    getVaultStats(recentCount?: number): Promise<VaultStats>;
    listAllTags(): Promise<Array<{
        tag: string;
        count: number;
    }>>;
}
//# sourceMappingURL=filesystem.d.ts.map