import { FrontmatterHandler } from './frontmatter.js';
import { PathFilter } from './pathfilter.js';
import type { ParsedNote, DirectoryListing, NoteWriteParams, MoveNoteParams, MoveFileParams, MoveResult, BatchReadParams, BatchReadResult, UpdateFrontmatterParams, NoteInfo, TagManagementParams, TagManagementResult, PatchNoteParams, PatchNoteResult, VaultStats } from './types.js';
export declare class FileSystemService {
    private vaultPath;
    private frontmatterHandler;
    private pathFilter;
    constructor(vaultPath: string, pathFilter?: PathFilter, frontmatterHandler?: FrontmatterHandler);
    private resolvePath;
    readNote(path: string): Promise<ParsedNote>;
    writeNote(params: NoteWriteParams): Promise<void>;
    patchNote(params: PatchNoteParams): Promise<PatchNoteResult>;
    listDirectory(path?: string): Promise<DirectoryListing>;
    exists(path: string): Promise<boolean>;
    isDirectory(path: string): Promise<boolean>;
    /**
     * Save a snapshot of a file to _trash/ with a timestamped "deleted-" prefix.
     * Can accept pre-read content to guarantee the backup captures the correct state
     * even if the file on disk has already been modified by a prior operation.
     */
    backupToTrash(relativePath: string, snapshotContent?: string): Promise<string>;
    /**
     * Soft-delete: moves the file to _trash/ instead of permanently deleting it.
     */
    softDeleteNote(path: string): Promise<{
        success: boolean;
        path: string;
        trashPath?: string;
        message: string;
    }>;
    moveNote(params: MoveNoteParams): Promise<MoveResult>;
    moveFile(params: MoveFileParams): Promise<MoveResult>;
    readMultipleNotes(params: BatchReadParams): Promise<BatchReadResult>;
    updateFrontmatter(params: UpdateFrontmatterParams): Promise<void>;
    getNotesInfo(paths: string[]): Promise<NoteInfo[]>;
    manageTags(params: TagManagementParams): Promise<TagManagementResult>;
    getVaultPath(): string;
    getVaultStats(recentCount?: number): Promise<VaultStats>;
    listAllTags(): Promise<Array<{
        tag: string;
        count: number;
    }>>;
}
//# sourceMappingURL=filesystem.d.ts.map