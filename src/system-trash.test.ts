import { test, expect, vi } from 'vitest';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import trash from 'trash';
import { FileSystemService } from './filesystem.js';

vi.mock('trash', () => ({ default: vi.fn().mockResolvedValue(undefined) }));

test.each(['note[1].md', 'note{1,2}.md'])(
  'system trash passes %s as a literal path',
  async (name) => {
    const vault = await realpath(await mkdtemp(join(tmpdir(), 'mcpvault-trash-[1]-')));
    try {
      vi.mocked(trash).mockClear();
      const fullPath = join(vault, name);
      await writeFile(fullPath, '# Temporary note');

      const result = await new FileSystemService(vault).deleteNote({
        path: name,
        confirmPath: name,
        trashMode: 'system',
      });

      expect(result.success).toBe(true);
      expect(trash).toHaveBeenCalledExactlyOnceWith(fullPath, { glob: false });
    } finally {
      await rm(vault, { recursive: true });
    }
  },
);
