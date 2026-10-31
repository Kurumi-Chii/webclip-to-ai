# Changelog

## 1.2.1 — 2026-10-31

Browser-only patch; Harness companion remains at 1.2.0.

- Fix a newline-loss path discovered during user-assisted Edge acceptance: read the raw selection from the clicked frame after the explicit menu action instead of relying only on native `selectionText`.
- Reconcile whitespace-folded text with the native selection so a page cannot replace the selected words during the menu interaction.
- Retain a native-text fallback for restricted frames, without adding permissions or all-site observers.
- Add regression checks covering real HTTP delivery of multiline text, clicked-frame targeting, changed selections, and inaccessible frames.
- User-assisted native Edge multiline retest passed: the newly delivered selection occupies two lines. Remaining independent GUI cases stay pending; automated regression alone is not presented as native acceptance.

## 1.2.0 — 2026-10-31

First public-source preview.

### Features

- Chrome / Edge selection context menu and reversible selection assistance.
- Generic JSON POST delivery with authentication and custom templates.
- DeepSeek Harness desktop companion for draft insertion without automatic submission.
- Visible page feedback, setup guidance, and last-result recovery.

### Publication changes

- Replace bundled shared pairing data with runtime-generated local pairing files and explicit browser import.
- Add portable source layout, MIT license, Chinese / English documentation, automated tests, packaging, CI, and a prerelease workflow.
- Document model-agnostic behavior, exact Harness runtime compatibility, privacy boundaries, and pending manual acceptance.
