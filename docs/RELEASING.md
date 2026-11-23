# Releasing

## Prepare

1. Keep root `package.json` and `extension/manifest.json` on the release version. Pin the separately versioned companion through `webclip.harnessVersion` and keep the documentation consistent with both component versions.
2. Run `npm run check`, `npm test`, and `npm run build`.
3. Inspect source and runtime archives. Runtime `connection.json`, old fixed pairing data, private credentials, personal browser state, and `.git` must be absent.
4. Complete and record the relevant manual acceptance from [TESTING.md](TESTING.md). Until this is done, retain preview language and use a GitHub prerelease.

## Artifacts

The Python standard-library packager produces a standalone extension ZIP, local-install companion TGZ, full installation ZIP, source ZIP, and `SHA256SUMS.txt` under `dist/`. The companion has no external runtime dependency and no install scripts. The source bundle preserves GitHub workflow files and ignores generated outputs.

## GitHub workflow

`ci.yml` runs portable checks and automated tests on Windows and Ubuntu with Node.js 22 and 24. On a `v*` tag push, `release.yml` validates the version, runs tests and uploads build artifacts to the workflow run.

Publish from GitHub Releases. Choose a new version tag targeting the release commit on `main`, attach the verified files from `dist/` and select the prerelease checkbox for preview versions.

The workflows have been authored and structurally checked locally. They cannot be reported as having passed on GitHub until run in a real repository.

## Store publication

GitHub distribution is the scope of this project. Chrome Web Store / Edge Add-ons submission, store screenshots, store review, and signing have not been performed. Complete browser acceptance and the relevant store requirements before submitting a store build.
