# Releasing

## Prepare

1. Keep root `package.json` and `extension/manifest.json` on the release version. Pin the separately versioned companion through root `webclip.harnessVersion`; browser 1.2.1 pairs with companion 1.2.0. Keep user instructions and release notes consistent with both component versions.
2. Run `npm run check`, `npm test`, and `npm run build`.
3. Inspect source and runtime archives. Runtime `connection.json`, old fixed pairing data, private credentials, personal browser state, and `.git` must be absent.
4. Complete and record the relevant manual acceptance from [TESTING.md](TESTING.md). Until this is done, retain preview language and use a GitHub prerelease.

## Artifacts

The Python standard-library packager produces a standalone extension ZIP, local-install companion TGZ, full installation ZIP, source ZIP, and `SHA256SUMS.txt` under `dist/`. The companion has no external runtime dependency and no install scripts. The source bundle preserves GitHub workflow files and ignores generated outputs.

## GitHub workflow

`ci.yml` runs portable checks and automated tests on Windows / Ubuntu with Node.js 22 / 24, then builds archives. `release.yml` runs on `v*` tag pushes, validates that the tag matches the package version, runs checks/tests/build, and uses the hosted runner's GitHub CLI to create a prerelease from the generated files. It receives `contents: write` only for that workflow; pull-request CI receives read-only contents access.

For 1.2.1, push the tag `v1.2.1`. For a later release, update the notes path in the release workflow together with the version and documentation. The workflow uses the repository's built-in `GITHUB_TOKEN`; no personal access token, npm token, model key, or local pairing token is required.

The workflows have been authored and structurally checked locally. They cannot be reported as having passed on GitHub until run in a real repository.

## Store publication

GitHub distribution is the scope of this project. Chrome Web Store / Edge Add-ons submission, store screenshots, store review, and signing have not been performed. Complete browser acceptance and the relevant store requirements before submitting a store build.
