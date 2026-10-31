import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSystemService } from './filesystem.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    open: vi.fn(actual.open),
    rename: vi.fn(actual.rename),
    readFile: vi.fn(actual.readFile),
  };
});

describe('atomic and serialized note writes', () => {
  let vault: string;
  let service: FileSystemService;

  beforeEach(async () => {
    vault = await fs.mkdtemp(join(tmpdir(), 'mcpvault-atomic-'));
    service = new FileSystemService(vault);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(vault, { recursive: true, force: true });
  });

  test('concurrent appends to the same note do not clobber each other', async () => {
    await service.writeNote({ path: 'log.md', content: 'start\n' });
    await Promise.all(Array.from({ length: 25 }, (_, index) => service.writeNote({
      path: 'log.md', content: `line-${index}\n`, mode: 'append',
    })));
    const note = await service.readNote('log.md');
    for (let index = 0; index < 25; index++) {
      expect(note.content).toContain(`line-${index}\n`);
    }
  });

  test('concurrent patches preserve each replacement', async () => {
    await fs.writeFile(join(vault, 'note.md'), Array.from({ length: 10 }, (_, index) => `old-${index}\n`).join(''));
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => service.patchNote({
      path: 'note.md', oldString: `old-${index}\n`, newString: `new-${index}\n`,
    })));
    expect(results.every((result) => result.success)).toBe(true);
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe(
      Array.from({ length: 10 }, (_, index) => `new-${index}\n`).join(''),
    );
  });

  test('successful writes leave no temporary files', async () => {
    await service.writeNote({ path: 'note.md', content: 'hello' });
    expect(await fs.readdir(vault)).toEqual(['note.md']);
  });

  test.each(['write', 'patch', 'frontmatter', 'tags'])('%s through a file symlink preserves link and updates target', async (operation) => {
    await fs.writeFile(join(vault, 'target.md'), 'original');
    await fs.symlink(join(vault, 'target.md'), join(vault, 'alias.md'));
    if (operation === 'write') {
      await service.writeNote({ path: 'alias.md', content: 'updated' });
    } else if (operation === 'patch') {
      expect((await service.patchNote({ path: 'alias.md', oldString: 'original', newString: 'updated' })).success).toBe(true);
    } else if (operation === 'frontmatter') {
      await service.updateFrontmatter({ path: 'alias.md', frontmatter: { status: 'updated' } });
    } else {
      expect((await service.manageTags({ path: 'alias.md', operation: 'add', tags: ['updated'] })).success).toBe(true);
    }
    expect((await fs.lstat(join(vault, 'alias.md'))).isSymbolicLink()).toBe(true);
    expect(await fs.readFile(join(vault, 'target.md'), 'utf8')).toContain('updated');
  });

  test.skipIf(process.platform === 'win32').each([0o600, 0o640])('replacement preserves mode %s despite umask', async (mode) => {
    const previousUmask = process.umask(0o077);
    try {
      await fs.writeFile(join(vault, 'private.md'), 'secret');
      await fs.chmod(join(vault, 'private.md'), mode);
      await service.writeNote({ path: 'private.md', content: 'new secret' });
      expect((await fs.stat(join(vault, 'private.md'))).mode & 0o777).toBe(mode);
    } finally {
      process.umask(previousUmask);
    }
  });

  test.skipIf(process.platform === 'win32')('a read-only note cannot be replaced through its writable parent', async () => {
    await fs.writeFile(join(vault, 'note.md'), 'original');
    await fs.chmod(join(vault, 'note.md'), 0o444);
    try {
      await expect(service.writeNote({ path: 'note.md', content: 'changed' })).rejects.toThrow('Permission denied');
      expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe('original');
      expect(await fs.readdir(vault)).toEqual(['note.md']);
    } finally {
      await fs.chmod(join(vault, 'note.md'), 0o600);
    }
  });

  test.each(['merge frontmatter', 'replace frontmatter', 'add tags', 'remove tags', 'patch'])('%s cannot discard a concurrent append', async (operation) => {
    await fs.writeFile(join(vault, 'note.md'), '---\nstatus: old\ntags: [old]\n---\nbody\n');
    let signalRead!: () => void;
    let releaseRead!: () => void;
    const captured = new Promise<void>((resolve) => { signalRead = resolve; });
    const released = new Promise<void>((resolve) => { releaseRead = resolve; });
    const originalRead = service.readNote.bind(service);
    let reads = 0;
    vi.spyOn(service, 'readNote').mockImplementation(async (path) => {
      const note = await originalRead(path);
      if (++reads === 1) {
        signalRead();
        await released;
      }
      return note;
    });
    const mutation = operation === 'patch'
      ? service.patchNote({ path: 'note.md', oldString: 'body', newString: 'updated body' })
      : operation === 'add tags' || operation === 'remove tags'
        ? service.manageTags({ path: 'note.md', operation: operation === 'add tags' ? 'add' : 'remove', tags: ['old', 'new'] })
        : service.updateFrontmatter({ path: 'note.md', frontmatter: { status: 'new' }, merge: operation === 'merge frontmatter' });
    await captured;
    const append = service.writeNote({ path: 'note.md', content: 'APPENDED\n', mode: 'append' });
    try {
      await Promise.race([append, new Promise<void>((resolve) => setTimeout(resolve, 200))]);
    } finally {
      releaseRead();
    }
    const [result] = await Promise.all([mutation, append]);
    if (result) expect(result.success).toBe(true);
    const note = await originalRead('note.md');
    expect(note.content).toContain('APPENDED\n');
    if (operation.endsWith('frontmatter')) expect(note.frontmatter.status).toBe('new');
    if (operation === 'add tags') expect(note.frontmatter.tags).toContain('new');
    if (operation === 'remove tags') expect(note.frontmatter.tags).toBeUndefined();
    if (operation === 'patch') expect(note.content).toContain('updated body');
  });

  test.each([true, false])('directory aliases share a queue when target exists: %s', async (exists) => {
    await fs.mkdir(join(vault, 'real'));
    if (exists) await fs.writeFile(join(vault, 'real/note.md'), 'start\n');
    await fs.symlink(join(vault, 'real'), join(vault, 'alias'));
    await Promise.all(Array.from({ length: 20 }, (_, index) => service.writeNote({
      path: index % 2 ? 'real/note.md' : 'alias/note.md',
      content: `line-${index}\n`, mode: 'append',
    })));
    const content = await fs.readFile(join(vault, 'real/note.md'), 'utf8');
    for (let index = 0; index < 20; index++) expect(content).toContain(`line-${index}\n`);
  });

  test('a blocked note does not block a different target', async () => {
    await fs.writeFile(join(vault, 'first.md'), 'first');
    let signalRead!: () => void;
    let releaseRead!: () => void;
    const captured = new Promise<void>((resolve) => { signalRead = resolve; });
    const released = new Promise<void>((resolve) => { releaseRead = resolve; });
    const originalRead = service.readNote.bind(service);
    vi.spyOn(service, 'readNote').mockImplementation(async (path) => {
      const note = await originalRead(path);
      signalRead();
      await released;
      return note;
    });
    const first = service.patchNote({ path: 'first.md', oldString: 'first', newString: 'updated' });
    await captured;
    try {
      await service.writeNote({ path: 'second.md', content: 'second' });
      expect(await fs.readFile(join(vault, 'second.md'), 'utf8')).toBe('second');
    } finally {
      releaseRead();
      await first;
    }
  });

  test('a failed rename preserves original, removes temporary file and releases queue', async () => {
    await fs.writeFile(join(vault, 'note.md'), 'original');
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('rename failed'), { code: 'EIO' }));
    await expect(service.writeNote({ path: 'note.md', content: 'changed' })).rejects.toThrow('rename failed');
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe('original');
    expect(await fs.readdir(vault)).toEqual(['note.md']);
    await service.writeNote({ path: 'note.md', content: '\nappended', mode: 'append' });
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe('original\nappended');
  });

  test('a partial temporary write never replaces original', async () => {
    await fs.writeFile(join(vault, 'note.md'), 'original');
    const originalOpen = fs.open;
    vi.spyOn(fs, 'open').mockImplementationOnce(async (...args) => {
      const file = await originalOpen(...args);
      vi.spyOn(file, 'writeFile').mockImplementationOnce(async () => {
        await file.write('partial');
        throw Object.assign(new Error('disk full'), { code: 'ENOSPC' });
      });
      return file;
    });
    await expect(service.writeNote({ path: 'note.md', content: 'changed' })).rejects.toThrow('No space left on device');
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe('original');
    expect(await fs.readdir(vault)).toEqual(['note.md']);
    await service.writeNote({ path: 'note.md', content: 'recovered' });
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe('recovered');
  });

  test.each(['append', 'prepend'] as const)('%s does not replace a note after a read failure', async (mode) => {
    const original = 'original body';
    await fs.writeFile(join(vault, 'note.md'), original);
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(Object.assign(new Error('read failed'), { code: 'EIO' }));
    await expect(service.writeNote({ path: 'note.md', content: 'changed', mode })).rejects.toThrow('read failed');
    expect(await fs.readFile(join(vault, 'note.md'), 'utf8')).toBe(original);
    await service.writeNote({ path: 'note.md', content: 'recovered' });
  });

  test('canonical targets still enforce restricted-path checks', async () => {
    await fs.mkdir(join(vault, '.obsidian'));
    await fs.writeFile(join(vault, '.obsidian/private.md'), 'private');
    await fs.symlink(join(vault, '.obsidian/private.md'), join(vault, 'alias.md'));
    await expect(service.writeNote({ path: 'alias.md', content: 'changed' })).rejects.toThrow('restricted');
    expect((await service.patchNote({ path: 'alias.md', oldString: 'private', newString: 'changed' })).success).toBe(false);
    expect(await fs.readFile(join(vault, '.obsidian/private.md'), 'utf8')).toBe('private');
  });

  test.each(['', 'folder.md'])('directory target %s is rejected before creating a temporary file', async (path) => {
    if (path) await fs.mkdir(join(vault, path));
    const open = vi.spyOn(fs, 'open').mockClear();
    await expect(service.writeNote({ path, content: 'must stay inside vault' })).rejects.toThrow('non-regular file');
    expect(open).not.toHaveBeenCalled();
    expect((await fs.stat(join(vault, path))).isDirectory()).toBe(true);
  });

  test('temporary names do not exceed limits for long note names', async () => {
    const path = `${'a'.repeat(240)}.md`;
    await service.writeNote({ path, content: 'long filename' });
    expect(await fs.readFile(join(vault, path), 'utf8')).toBe('long filename');
    expect(await fs.readdir(vault)).toEqual([path]);
  });
});
