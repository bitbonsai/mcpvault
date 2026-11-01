import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const repository = 'bitbonsai/mcpvault';

function run(command, args, input) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', input }).trim();
}

function cleanMainCommit() {
  if (run('git', ['branch', '--show-current']) !== 'main') {
    throw new Error('Switch to main before releasing.');
  }
  if (run('git', ['status', '--porcelain'])) {
    throw new Error('Commit or remove local changes before releasing.');
  }
  return run('git', ['rev-parse', 'HEAD']);
}

export function releaseNotes(changelog, version) {
  const section = changelog.split(/^## /m).find(part => part.startsWith(`[${version}] - `));
  const notes = section?.split('\n').slice(1).join('\n').trim();
  if (!notes || !notes.replace(/^#+[^\n]*$/gm, '').trim()) {
    throw new Error(`Add release notes for ${version} to CHANGELOG.md first.`);
  }
  return notes;
}

export async function release(checkOnly = false, yes = false) {
  if (checkOnly && yes) throw new Error('--check and --yes cannot be combined.');
  const commit = cleanMainCommit();
  const { name, version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  if (name !== '@bitbonsai/mcpvault' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('This command releases stable MCPVault versions only.');
  }
  const tag = `v${version}`;
  const notes = releaseNotes(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version);
  if (run('gh', ['api', `repos/${repository}/git/ref/heads/main`, '--jq', '.object.sha']) !== commit) {
    throw new Error('Local main differs from GitHub main. Pull before releasing.');
  }

  const releases = run('gh', ['api', '--paginate', `repos/${repository}/releases`, '--jq', '.[].tag_name']);
  if (releases.split('\n').includes(tag)) {
    throw new Error(`${tag} already has a GitHub Release. Check its Publish workflow instead.`);
  }
  const tags = JSON.parse(run('gh', ['api', `repos/${repository}/git/matching-refs/tags/${tag}`]));
  if (tags.some(ref => ref.ref === `refs/tags/${tag}`)) {
    throw new Error(`${tag} already exists. Review the existing tag before releasing.`);
  }

  const runs = JSON.parse(run('gh', [
    'run', 'list', '--repo', repository, '--commit', commit, '--branch', 'main',
    '--event', 'push', '--limit', '20', '--json', 'name,status,conclusion',
  ]));
  for (const name of ['CI', 'CodeQL']) {
    const workflow = runs.find(run => run.name === name);
    if (workflow?.status !== 'completed' || workflow.conclusion !== 'success') {
      throw new Error(`Wait for ${name} to pass on ${commit} before releasing.`);
    }
  }

  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, {
    signal: AbortSignal.timeout(15_000), headers: { 'cache-control': 'no-cache' },
  });
  if (response.status === 200) throw new Error(`${name}@${version} is already published. Do not republish it.`);
  if (response.status !== 404) throw new Error(`npm registry returned HTTP ${response.status}. Release stopped.`);

  console.log(`Repository: ${repository}\nRelease: ${tag}\nCommit: ${commit}\n\n${notes}\n`);
  if (checkOnly) return;
  if (!yes) {
    if (!stdin.isTTY || !stdout.isTTY) {
      throw new Error('Use your own terminal to confirm publication, or --yes for an approved automated release.');
    }
    const prompt = createInterface({ input: stdin, output: stdout });
    let answer;
    try {
      answer = await prompt.question(`Creating this GitHub Release publishes to npm. Type ${tag} to continue: `);
    } finally {
      prompt.close();
    }
    if (answer.trim() !== tag) {
      console.log('Release cancelled.');
      return;
    }
  }
  if (cleanMainCommit() !== commit) throw new Error('Checkout changed during confirmation. Release stopped.');
  // Reserve the tag atomically so a concurrent tag cannot override --target.
  run('gh', [
    'api', `repos/${repository}/git/refs`, '--method', 'POST',
    '--raw-field', `ref=refs/tags/${tag}`, '--raw-field', `sha=${commit}`,
  ]);
  console.log(run('gh', [
    'release', 'create', tag, '--repo', repository, '--target', commit,
    '--verify-tag', '--title', tag, '--notes-file', '-',
  ], notes));
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (args.length > 1 || (args.length === 1 && !['--check', '--yes'].includes(args[0]))) {
      throw new Error('Usage: npm run release [-- --check | -- --yes]');
    }
    return release(args[0] === '--check', args[0] === '--yes');
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
