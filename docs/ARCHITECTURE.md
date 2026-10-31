# Architecture

## Components

`extension/` is a Manifest V3 browser extension. Its worker owns native context menus, validated delivery, endpoint host-permission checks, and bounded result storage. The popup provides selection assistance and manual delivery. The options page validates configuration and locally imports the Harness pairing file.

After an explicit context-menu click, the worker reads the selected text from that frame through `activeTab` / existing host permission. It uses the raw string only if whitespace folding matches the native menu's selection, restoring line breaks without allowing a changed DOM selection to substitute different words. If frame access fails, it falls back to the native event text, whose whitespace may be normalized by Chromium. No persistent selection observer is installed.

`packages/harness-webclip/` is an optional, private local Harness bundle. Its host half creates installation-local credentials and a loopback HTTP listener. Its desktop client half polls through Harness's authenticated Connection carrier, captures a current session/revision, inserts plain text with `inputActions`, and acknowledges the result.

`examples/local_receiver.py` is a dependency-free diagnostic endpoint and a deliberately selection-restricted demo page. It never forwards data to a model.

## Harness delivery

```mermaid
sequenceDiagram
  actor User
  participant Extension
  participant Receiver as Loopback receiver
  participant Client as Harness desktop client
  participant Draft as Current draft
  User->>Extension: Explicit context-menu action
  Extension->>Receiver: POST text + local Bearer token
  Receiver->>Receiver: Validate and bind ticket to current session/client
  Client->>Receiver: Authenticated poll through Harness
  Receiver-->>Client: Ticket with deadline and session identity
  Client->>Draft: Insert only if session/revision still match
  Client->>Receiver: Insertion acknowledgement
  Receiver-->>Extension: Confirmed insertion or actionable error
  Extension-->>User: Visible result; user sends draft manually
```

No model-call or composer-submit API is part of this sequence. The companion's runtime-version pin reflects its use of the current `uiSession.current` and `inputActions` interfaces.

## Runtime pairing

On first activation, `pairing.js` writes a 32-random-byte token and loopback endpoint to `$DSH_HOME/webclip-to-ai/connection.json`, using exclusive creation and restrictive POSIX modes. Later activations reuse it. An invalid existing file fails closed rather than silently changing an already imported credential.

The extension accepts only the expected file format, a literal `http://127.0.0.1/.../receive` endpoint, and an appropriately shaped token. It imports only endpoint and token, then uses its own fixed Harness text-only template. Importing a file does not itself make a network request or grant host permissions; the user saves and grants access separately.

## Lifecycle and bounds

- Extension delivery is serialized within a worker generation, never automatically retried, and has a 20-second timeout.
- The companion keeps at most eight pending requests, a 12-second insertion-confirmation deadline, and a six-second client heartbeat window.
- Client acknowledgements are deduplicated in memory. Restart and timeout are ambiguity boundaries; the user must inspect a draft before re-delivery.
- Disabling the companion closes the listener and resolves pending requests as unsuccessful.
- The text limit is 100,000 JavaScript string code units; this is a pragmatic size limit rather than a Unicode grapheme count.

## References

- [Chrome context menus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)
- [Chrome scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- [Optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Harness client modules](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/modules)
- [Harness conversation interfaces](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-conversation)
- [Harness plugin manager](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/boot/plugin-manager)
