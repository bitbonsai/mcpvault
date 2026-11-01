import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exec: vi.fn(),
  read: vi.fn(),
  question: vi.fn(),
  close: vi.fn(),
  fetch: vi.fn(),
  stdin: { isTTY: true },
  stdout: { isTTY: true },
}));
vi.mock('node:child_process', () => ({ execFileSync: mocks.exec }));
vi.mock('node:fs', () => ({ readFileSync: mocks.read }));
vi.mock('node:process', () => ({ stdin: mocks.stdin, stdout: mocks.stdout }));
vi.mock('node:readline/promises', () => ({
  createInterface: () => ({ question: mocks.question, close: mocks.close }),
}));

import { release, releaseNotes } from './release.mjs';

const commit = 'a'.repeat(40);
const notes = '### Fixed\n- Preserve note content.';
let state: {
  branch: string;
  changes: string;
  commit: string;
  remoteCommit: string;
  version: string;
  releases: string;
  tags: { ref: string }[];
  tagCreationFails: boolean;
  runs: { name: string; status: string; conclusion: string }[];
};

function creations() {
  return mocks.exec.mock.calls.filter(([command, args]) => command === 'gh'
    && (args[0] === 'release' || args.includes('POST')));
}

beforeEach(() => {
  vi.clearAllMocks();
  state = {
    branch: 'main', changes: '', commit, remoteCommit: commit, version: '0.18.4',
    releases: '', tags: [], tagCreationFails: false,
    runs: ['CI', 'CodeQL'].map(name => ({ name, status: 'completed', conclusion: 'success' })),
  };
  mocks.stdin.isTTY = true;
  mocks.stdout.isTTY = true;
  mocks.question.mockResolvedValue('v0.18.4');
  mocks.fetch.mockResolvedValue({ status: 404 });
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  mocks.read.mockImplementation((path: URL) => path.pathname.endsWith('package.json')
    ? JSON.stringify({ name: '@bitbonsai/mcpvault', version: state.version })
    : `# Changelog\n\n## [Unreleased]\n\n## [0.18.4] - 2026-11-01\n\n${notes}\n\n## [0.18.3] - 2026-11-01\n\nOld notes.`);
  mocks.exec.mockImplementation((command: string, args: string[]) => {
    if (command === 'git') {
      if (args[0] === 'branch') return state.branch;
      if (args[0] === 'status') return state.changes;
      if (args[0] === 'rev-parse') return state.commit;
    }
    if (command === 'gh') {
      if (args[0] === 'run') return JSON.stringify(state.runs);
      if (args[0] === 'release') return 'https://github.com/bitbonsai/mcpvault/releases/tag/v0.18.4';
      if (args[1] === '--paginate') return state.releases;
      if (args[1]?.includes('matching-refs')) return JSON.stringify(state.tags);
      if (args[1]?.endsWith('git/ref/heads/main')) return state.remoteCommit;
      if (args[1]?.endsWith('git/refs')) {
        if (state.tagCreationFails) throw new Error('Tag already created by another release');
        return JSON.stringify({ ref: 'refs/tags/v0.18.4', object: { sha: commit } });
      }
    }
    throw new Error(`Unexpected command: ${command} ${args.join(' ')}`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('release notes', () => {
  test('extracts only the matching changelog entry', () => {
    expect(releaseNotes(`## [Unreleased]\n\nLater\n\n## [0.18.4] - 2026-11-01\n\n${notes}\n\n## [0.18.3] - 2026-11-01\nOld`, '0.18.4')).toBe(notes);
  });

  test.each(['# Changelog', '## [0.18.4] - 2026-11-01\n', '## [0.18.4] - 2026-11-01\n### Fixed\n'])(
    'rejects missing or empty release notes (%j)', changelog => {
      expect(() => releaseNotes(changelog, '0.18.4')).toThrow('Add release notes');
    },
  );
});

test('check mode never prompts or creates a release', async () => {
  mocks.stdin.isTTY = false;
  await release(true);
  expect(mocks.question).not.toHaveBeenCalled();
  expect(creations()).toHaveLength(0);
});

test('--check and --yes cannot be combined', async () => {
  await expect(release(true, true)).rejects.toThrow('--check and --yes cannot be combined');
  expect(mocks.exec).not.toHaveBeenCalled();
  expect(mocks.fetch).not.toHaveBeenCalled();
});

test('--yes permits an approved release without a terminal or prompt', async () => {
  mocks.stdin.isTTY = false;
  mocks.stdout.isTTY = false;
  await release(false, true);
  expect(mocks.question).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(creations()).toHaveLength(2);
  expect(creations()[0]?.[1]).toContain(`sha=${commit}`);
  expect(creations()[1]?.[1]).toContain('--verify-tag');
  expect(creations()[1]?.[2]).toEqual(expect.objectContaining({ input: notes }));
});

test.each(['dirty checkout', 'failed CI', 'existing release', 'existing tag', 'published version'])(
  '--yes still blocks %s', async scenario => {
    if (scenario === 'dirty checkout') state.changes = ' M package.json';
    if (scenario === 'failed CI') state.runs[0]!.conclusion = 'failure';
    if (scenario === 'existing release') state.releases = 'v0.18.4';
    if (scenario === 'existing tag') state.tags = [{ ref: 'refs/tags/v0.18.4' }];
    if (scenario === 'published version') mocks.fetch.mockResolvedValue({ status: 200 });
    await expect(release(false, true)).rejects.toThrow();
    expect(mocks.question).not.toHaveBeenCalled();
    expect(creations()).toHaveLength(0);
  },
);

test('--yes rechecks the checkout immediately before creating the tag', async () => {
  mocks.fetch.mockImplementation(async () => {
    state.changes = ' M package.json';
    return { status: 404 };
  });
  await expect(release(false, true)).rejects.toThrow('local changes');
  expect(creations()).toHaveLength(0);
});

test('confirmed release pins the checked commit and sends changelog notes on stdin', async () => {
  await release();
  expect(mocks.question).toHaveBeenCalledWith(expect.stringContaining('publishes to npm'));
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(creations()).toEqual([
    ['gh', ['api', 'repos/bitbonsai/mcpvault/git/refs', '--method', 'POST',
      '--raw-field', 'ref=refs/tags/v0.18.4', '--raw-field', `sha=${commit}`],
    expect.anything()],
    ['gh', ['release', 'create', 'v0.18.4', '--repo', 'bitbonsai/mcpvault', '--target', commit,
      '--verify-tag', '--title', 'v0.18.4', '--notes-file', '-'],
    expect.objectContaining({ input: notes })],
  ]);
});

test('declining leaves the release unpublished', async () => {
  mocks.question.mockResolvedValue('no');
  await release();
  expect(creations()).toHaveLength(0);
});

test.each([
  { field: 'branch', value: 'feature', error: 'Switch to main' },
  { field: 'changes', value: ' M package.json', error: 'local changes' },
  { field: 'remoteCommit', value: 'b'.repeat(40), error: 'differs from GitHub main' },
  { field: 'version', value: '0.18.4-beta.1', error: 'stable MCPVault versions' },
  { field: 'version', value: '0.018.4', error: 'stable MCPVault versions' },
] as const)('rejects invalid $field', async ({ field, value, error }) => {
  state[field] = value;
  await expect(release()).rejects.toThrow(error);
  expect(creations()).toHaveLength(0);
});

test('existing GitHub release is not recreated or retried', async () => {
  state.releases = 'v0.18.4\nv0.18.3';
  await expect(release()).rejects.toThrow('already has a GitHub Release');
  expect(creations()).toHaveLength(0);
});

test('existing tag cannot redirect the release to another commit', async () => {
  state.tags = [{ ref: 'refs/tags/v0.18.4' }];
  await expect(release()).rejects.toThrow('Review the existing tag');
  expect(creations()).toHaveLength(0);
});

test.each(['missing', 'pending', 'failed'])('blocks %s CI', async status => {
  if (status === 'missing') state.runs = [];
  else {
    state.runs[0]!.status = status === 'pending' ? 'in_progress' : 'completed';
    state.runs[0]!.conclusion = status === 'failed' ? 'failure' : '';
  }
  await expect(release()).rejects.toThrow('Wait for CI to pass');
  expect(creations()).toHaveLength(0);
});

test.each([200, 401, 503])('blocks registry HTTP %i', async status => {
  mocks.fetch.mockResolvedValue({ status });
  await expect(release()).rejects.toThrow(status === 200 ? 'already published' : `HTTP ${status}`);
  expect(creations()).toHaveLength(0);
});

test('CodeQL is required even when CI passes', async () => {
  state.runs = state.runs.slice(0, 1);
  await expect(release()).rejects.toThrow('Wait for CodeQL to pass');
  expect(creations()).toHaveLength(0);
});

test('registry network failures stop publication', async () => {
  mocks.fetch.mockRejectedValue(new Error('Network unavailable'));
  await expect(release()).rejects.toThrow('Network unavailable');
  expect(creations()).toHaveLength(0);
});

test('publishing needs an interactive terminal', async () => {
  mocks.stdin.isTTY = false;
  await expect(release()).rejects.toThrow('your own terminal');
  expect(creations()).toHaveLength(0);
});

test('tag creation races stop before creating a GitHub Release', async () => {
  state.tagCreationFails = true;
  await expect(release()).rejects.toThrow('Tag already created');
  expect(creations()).toHaveLength(1);
  expect(creations()[0]?.[1]).toContain('POST');
});

test('commit changes during confirmation stop publication', async () => {
  mocks.question.mockImplementation(async () => {
    state.commit = 'b'.repeat(40);
    return 'v0.18.4';
  });
  await expect(release()).rejects.toThrow('Checkout changed');
  expect(creations()).toHaveLength(0);
});

test('local changes during confirmation stop publication', async () => {
  mocks.question.mockImplementation(async () => {
    state.changes = ' M package.json';
    return 'v0.18.4';
  });
  await expect(release()).rejects.toThrow('local changes');
  expect(creations()).toHaveLength(0);
});
