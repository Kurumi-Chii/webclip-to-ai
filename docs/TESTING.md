# Validation and manual acceptance

## Automated coverage

Prepare assets with `npm ci --ignore-scripts` and `npm run prepare:ocr`, then run `npm run check` and `npm test` from the repository root. The extension suite mocks Chrome APIs while using a real local HTTP server. The Harness suite runs the actual receiver and client plugin code against a simulated editor interface. Pairing tests use temporary directories and synthetic credentials.

Coverage includes JSON escaping and nesting; endpoint validation; authentication; missing host permission; malformed configuration; text bounds; context-menu setup guidance; actionable Harness errors; insertion acknowledgement; preservation of draft selections; revision/session changes; deduplication after acknowledgement loss; generated credential persistence and uniqueness; and import rejection for unexpected destinations.

These tests do not replace real browser or Harness acceptance. No supplied screenshot or CI badge is presented as proof of an actual installed integration.

## Actual installed-runtime acceptance

On 2026-10-31, the packaged companion was installed offline through the actual `dsh 0.2.1-rc.2` CLI into an isolated Windows profile. Authentication, client boot graph and exact served Client code, routes, health, and 11 real Host/HTTP integration checks passed. An incompatible-version fixture was also refused without an exemption.

The Host and transport were real; the editor interface in these integration checks was still simulated. Native desktop and browser checks remain separate. See the [dated acceptance record](ACCEPTANCE_2026-10-31.zh-CN.md).

## User-assisted native acceptance and remaining cases

User-assisted testing on 2026-10-31 confirmed Edge installation, pairing save, native context-menu delivery, visible feedback, real draft insertion and absence of automatic submission. The restricted fixture exposed merged lines in 1.2.0; extension **1.2.1** fixed raw selection capture and its real multiline retest passed with companion **1.2.0**. Existing draft text, one-step undo, repeated enable, restore, re-enable and refresh behavior were also confirmed. These outcomes establish the tested Edge core flow, not Chrome acceptance or every edge case.

| Surface | Check | Current status |
| --- | --- | --- |
| Chrome | Load unpacked, save permission, real drag selection and native menu | Blocked: Chrome control connection unavailable |
| Edge | Load unpacked, page feedback, real drag selection and native menu | User-assisted core delivery passed, including multiline retest on 1.2.1 |
| Restricted selection demo | Enable twice, restore, refresh, then re-enable | Passed with user assistance |
| Harness dsh 0.2.1-rc.2 | Install TGZ, start Host, generate pairing file and serve Client code | Actual CLI / Host passed; desktop version, enabled state and real core flow user-confirmed |
| Harness current draft | Insertion, existing text, multiline and one-step undo | Passed with user assistance; selected-draft and exact Unicode boundary cases remain |
| Harness race cases | Change draft/session during delivery; no unintended submission | No automatic submission user-confirmed; native race cases pending (Host/simulated-editor checks passed) |
| Browser restart | Keep pairing and host grants across full browser exit/reopen | Pending; extension reload delivery already passed |
| Other Harness versions | Compatibility refusal or tested adaptation | Refusal verified with an incompatible fixture; other real runtimes unsupported |
| macOS / Linux Harness | Actual desktop integration and permissions | Unverified |

Direct desktop capture still fails, so completed native cases use explicit user operation, reports and screenshots. Remaining native cases require the same assistance or a restored control connection. The v1.2.1 hosted workflow subsequently passed on Windows/Linux with Node 22/24. This does not certify the v1.3.0 local candidate, whose hosted execution and native OCR flow remain pending.

## Reproducible local diagnostic

1. Run `python examples/local_receiver.py`.
2. Open `http://127.0.0.1:8765/demo`.
3. Configure generic HTTP mode with `http://127.0.0.1:8765/receive`, no token, and the default template.
4. Confirm the page initially restricts selection. Enable assistance, select the sample, and use the extension menu.
5. Confirm the terminal receives the expected text and the extension shows the response.
6. Stop the receiver with Ctrl+C.

Record the operating system, exact browser version, extension version, dsh runtime version, result, and any errors when completing manual acceptance. Use synthetic text and remove credentials from reports.

## v1.3.0 OCR candidate

60 automated checks include 18 new OCR flow checks and four actual packaged-WASM language fixtures. Four actual browser Worker cases also passed through a local harness using the real offscreen module, locally packaged engine/models and restricted CSP; its extension-message carrier was mocked. [OCR scope and manual checks](OCR.zh-CN.md).

`npm run test:browser` is an optional isolated Playwright integration suite. It uses a test-only copy with loopback fixture host grants, never the user browser profile or Harness. It does not prove native activeTab user gestures. Installation of its browser and execution were blocked locally by process permissions (`spawn EPERM` / browser Mojo access denied), so this suite is not claimed passed and is not required by CI until verified in a suitable environment.

## v1.3.1 regression checks

76 automated checks passed, including popup focus, resource-loading status, pending navigation, post-capture document validation, missing/mismatched OCR acceptance, cancellation and late-result rejection, sender identity validation, Chromium 116 getContexts compatibility and handoff timeouts. Seven real-browser OCR/HTTP pipeline checks passed using the actual controller, offscreen module, local WASM/models and a synthetic browser API/message carrier. Native browser permissions/capture remain pending. See [release notes](RELEASE_NOTES_1.3.1.md).
