# Release

This package uses npm Trusted Publishing with GitHub Actions OIDC.

Do not add `NPM_TOKEN` or long-lived npm tokens to GitHub Secrets.

## One-time npm setup

On npmjs.com, configure Trusted Publishing for this package:

- Publisher: GitHub Actions
- Repository: this GitHub repository
- Workflow filename: `publish.yml`

## Publish

An authorized human starts `.github/workflows/auto-release.yml` with `workflow_dispatch` on `main`. A version bump merged to `main` does not create a tag, GitHub Release, or npm publication by itself. The manually started workflow creates the tag and release, then explicitly dispatches `.github/workflows/publish.yml` for that tag.

`.github/workflows/publish.yml` runs CI and can publish after an authorized `v*.*.*` tag or published GitHub Release, or through its own `workflow_dispatch`.

The workflow skips `name@version` if that exact package version already exists on npm.

## Workflow guardrail

Do not ship a new Pi OSS package or version bump with only `package.json` changes.
The repository must include the release workflow pair:

- `.github/workflows/auto-release.yml` is manually dispatched on `main` to create `v<version>` tags and GitHub Releases.
- `.github/workflows/publish.yml` publishes to npm through Trusted Publishing.

Important: tags or releases created by `GITHUB_TOKEN` do not reliably fan out into another workflow through normal `push.tags` or `release.published` triggers. The release workflow explicitly dispatches `publish.yml` after an authorized manual run. If you change the release flow, keep one explicit handoff path: `workflow_dispatch` from auto-release, `repository_dispatch`, or `workflow_run` on the auto-release workflow.

## GitHub Actions requirements

- `permissions: id-token: write`
- `permissions: actions: write` on auto-release so it can dispatch `publish.yml`
- `auto-release.yml` must call `gh workflow run publish.yml --ref "$TAG" -f ref="$TAG"`, or `publish.yml` must have an equivalent explicit handoff trigger such as `workflow_run`
- GitHub-hosted runner
- Node.js 24, so the release job uses a current npm CLI for Trusted Publishing
- No `NPM_TOKEN`
- `npm publish` from the configured workflow file

## First release checklist

Completed for the initial public npm release (`pi-localgpt@0.1.0` onward; current npm: `0.10.2` as of 2026-07):

- [x] `package.json` name is final
- [x] `repository.url` points to the real GitHub repository
- [x] npm Trusted Publisher is configured
- [x] `npm run ci` passes
- [x] `npm pack --dry-run` contains only intended files
- [x] CHANGELOG.md has the release date

