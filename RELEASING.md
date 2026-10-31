# Releasing MCPVault

Production releases are created through GitHub Releases. Publishing a release triggers `.github/workflows/publish.yml`, which tests, builds, and publishes the matching package version to npm with provenance.

Do not backfill a GitHub Release for `0.15.0`: that version was published manually, and publishing a release now would trigger a duplicate npm publish. Start this process with the next version.

## 1. Prepare the release in a PR

The release PR must contain every artifact users will receive:

- the semver bump in `package.json` and `package-lock.json`
- source and tests
- rebuilt `dist/` from the same source
- `CHANGELOG.md`
- website release history in both `website-shibumi/src/components/UpdateCallout.tsx` and `website-shibumi/public/index.md`
- any feature documentation in both browser and Markdown formats

Run the root tests, build, audit, dry-run package, and website build before merging.

## 2. Verify main

After the release PR merges, wait for required main checks to pass. Confirm the intended version is not already on npm:

```bash
VERSION=$(node -p "require('./package.json').version")
npm view "@bitbonsai/mcpvault@$VERSION" version
```

A not-found response is expected before publishing. Stop if npm already has the version.

## 3. Publish a GitHub Release

Write concise release notes from the matching changelog entry, then create the release. This command creates the `vX.Y.Z` tag at the selected main commit and publishes the GitHub Release:

```bash
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" \
  --repo bitbonsai/mcpvault \
  --target main \
  --title "v$VERSION" \
  --notes-file /tmp/mcpvault-release-notes.md
```

Do not use generated notes for the first GitHub Release because the repository has no historical release tags; use the curated changelog entry instead.

## 4. Verify publication

Watch the `Publish` workflow and verify npm after it succeeds:

```bash
gh run list --repo bitbonsai/mcpvault --workflow Publish --limit 1
npm view @bitbonsai/mcpvault version
npx --yes "@bitbonsai/mcpvault@$VERSION" --version
```

Confirm the GitHub Release tag, npm version, installed CLI version, and website release copy all agree before considering the release complete.

## Failure handling

- npm versions are immutable. Never bump or republish the same version after a partial failure.
- If the workflow fails before npm publication, fix the workflow and rerun it.
- If npm already shows the version, do not rerun the publish step; verify the package and repair only the missing release metadata.
- `npm run publish:latest` is an emergency fallback, not the normal production path. It does not provide the GitHub Release-driven provenance flow.
- Beta publishing remains explicit through `npm run publish:beta`; do not create a production GitHub Release for an unapproved beta.
