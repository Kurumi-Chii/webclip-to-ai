# Changelog

## 1.3.1 · OCR fixes · 2026-11-04

- Fix popup-focus/resource-loading false positives; retain foreground/document checks for capture and delivery.
- Accept authenticated same-extension service-worker OCR messages without a sender URL, require matching startup receipts, and use getContexts on Chromium 116–149.
- Show OCR progress and add cancellation/reload recovery. 76 automated checks and seven real browser OCR/HTTP pipeline checks passed; native installed-extension acceptance remains pending.


## Companion 1.2.1 · rc.5 adaptation · 2026-11-04

- Add explicit dsh 0.2.1-rc.5 support after actual SDK contract, CLI installation and 11 Host/HTTP checks. Retain rc.2 compatibility, pairing and manual submission. Native rc.5 draft confirmation remains pending.

## 1.3.0 · local candidate · 2026-11-04

- Add local region OCR through Alt+Shift+O, popup and context-menu entries, including preview mode and simplified/traditional Chinese, Japanese and English models.
- Bind capture to the source tab/document and viewport; cancel stale/duplicate deliveries and retain recognized text on failure.
- Package pinned third-party engines, license notices and checksummed models. Add 18 flow checks and four real WASM recognition fixtures.
- Native Edge/Chrome OCR-to-Harness acceptance and remote CI remain pending; four browser-worker harness samples passed.


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
