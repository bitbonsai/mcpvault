# Releasing MCPVault

Production releases are created through GitHub Releases. Publishing a release triggers `.github/workflows/publish.yml`, which tests, builds, and publishes the matching package version to npm with provenance.

Never create a GitHub Release for a version already on npm, including versions published manually. That would trigger a duplicate npm publish.

## 1. Prepare the release in a PR

The release PR must contain every artifact users will receive:

- the semver bump in `package.json` and `package-lock.json`
- source and tests
- rebuilt `dist/` from the same source
- `CHANGELOG.md`
- website release history in both `website-shibumi/src/components/UpdateCallout.tsx` and `website-shibumi/public/index.md`
- any feature documentation in both browser and Markdown formats

Run the root tests, build, audit, dry-run package, and website build before merging.

## 2. Check release readiness

After the release PR merges, switch to clean, up-to-date `main`. Run:

```bash
npm run release -- --check
```

The repository-only command in `scripts/release.mjs` reads the version from `package.json` and release notes from the matching `CHANGELOG.md` entry. It checks that local `main` matches GitHub, CI and CodeQL passed for that exact commit, and the npm version, GitHub Release, and tag do not already exist. Registry or GitHub errors stop the release.

This check prints the release preview without publishing anything. It does not bump versions or prepare the release PR.

## 3. Publish a GitHub Release

Run this in your own terminal:

```bash
npm run release
```

Review the version, commit, and changelog notes, then type the displayed tag to confirm. The command first creates the tag at the checked commit, then publishes its GitHub Release with notes directly from the changelog. Publishing that release triggers npm publication through GitHub Actions. Keep npm 2FA enabled; the workflow uses the package's trusted publisher configuration.

The assistant may run `--check`; final confirmation belongs to the user. There is no non-interactive publish flag. An existing release is never recreated or automatically retried.

## 4. Verify publication

Watch the `Publish` workflow and verify npm after it succeeds:

```bash
VERSION=$(node -p "require('./package.json').version")
gh run list --repo bitbonsai/mcpvault --workflow Publish --limit 1
npm view @bitbonsai/mcpvault version
(cd "$(mktemp -d)" && npx --yes "@bitbonsai/mcpvault@$VERSION" --version)
```

Confirm the GitHub Release tag, npm version, installed CLI version, and website release copy all agree before considering the release complete.

## Failure handling

- npm versions are immutable. Never bump or republish the same version after a partial failure.
- If the command creates the tag but GitHub Release creation fails, inspect that tag and recover the release manually. The command stops on existing tags rather than guessing whether a retry is safe.
- If the workflow fails before npm publication, fix the workflow and rerun it.
- If npm already shows the version, do not rerun the publish step; verify the package and repair only the missing release metadata.
- `npm run publish:latest` is an emergency fallback, not the normal production path. It does not provide the GitHub Release-driven provenance flow.
- Beta publishing remains explicit through `npm run publish:beta`; do not create a production GitHub Release for an unapproved beta.
