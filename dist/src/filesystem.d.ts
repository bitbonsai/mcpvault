import { FrontmatterHandler } from './frontmatter.js';
import { PathFilter } from './pathfilter.js';
import type { ParsedNote, DirectoryListing, NoteWriteParams, DeleteNoteParams, DeleteResult, MoveNoteParams, MoveFileParams, MoveResult, BatchReadParams, BatchReadResult, UpdateFrontmatterParams, NoteInfo, TagManagementParams, TagManagementResult, PatchNoteParams, PatchNoteResult, VaultStats, NoteHeading, ReadNoteLinesParams } from './types.js';
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
    /**
     * Join appended or prepended text to the existing body on a line boundary.
     * Exactly one line break (matching the note's line endings) is inserted when
     * neither side of the boundary provides one; a newline already there, at the
     * end of the first part or the start of the second, is kept as is, so no
     * blank line is introduced. An empty side needs no separator.
     */
    private joinNoteContent;
    patchNote(params: PatchNoteParams): Promise<PatchNoteResult>;
    listDirectory(path?: string): Promise<DirectoryListing>;
    exists(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    deleteNote(params: DeleteNoteParams): Promise<DeleteResult>;
    moveNote(params: MoveNoteParams): Promise<MoveResult>;
    /**
     * Rewrite [[wikilinks]] that target the note formerly at oldPath so they
     * point at newPath. Covers [[Name]], [[Name|alias]], [[Name#heading]],
     * ![[Name]] embeds and the path-qualified [[folder/Name]] and
     * [[folder/Name.md]] forms. Only an exact, case-sensitive target matches, so
     * [[Older]] or [[Name-thing]] are left alone. Bare targets become the new
     * basename and path-qualified targets the new vault-relative path, both
     * without the .md extension. Aliases, headings and the embed marker are kept.
     * Only notes that changed are written back, with their bytes otherwise
     * untouched, so line endings are preserved.
     *
     * With write=false nothing is written: notesUpdated then lists the notes
     * that would change (reported as linkedFrom). Bare targets are skipped when
     * another note still has the old basename, since [[Name]] may mean that
     * note; those notes are reported in `ambiguous`. A link whose rewrite would
     * be identical (same basename, new folder) does not count as a change.
     */
    private updateWikiLinksAfterMove;
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