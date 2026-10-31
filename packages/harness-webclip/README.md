# Harness WebClip companion

This is the optional Harness-side package of [WebClip to AI](../../README.md).

Install its `.tgz` archive from the Harness **Plugins → Add plugin** dialog, then enable it. Supported runtime: **dsh 0.2.1-rc.2**. No model API key or third-party Node.js dependency is required.

On activation, the plugin creates `$DSH_HOME/webclip-to-ai/connection.json`, defaulting to `~/.dsh/webclip-to-ai/connection.json`. Import that file in the companion browser extension's settings and grant the loopback host permission. Keep it local: the file contains your installation's pairing token.

The listener binds `127.0.0.1:18766`. Authenticated JSON POST requests to `/receive` are delivered through Harness's existing Connection carrier to its desktop client. The client inserts into the current eligible session draft and acknowledges the edit. It never sends the draft or invokes the model.

Text is inserted at the captured caret. An existing draft selection is collapsed to its end so that selected draft text is preserved. Session or revision changes reject stale writes. Active pending delivery is bounded, and a delayed or lost acknowledgement does not automatically repeat an insertion in the same client process.

The receiver returns success only after an insertion acknowledgement. Timeout is ambiguous: inspect the current draft before retrying. Deactivation closes the listener and cancels pending deliveries. This preview assumes a single-user local desktop; the internal poll/ack routes are reachable by authenticated clients of that Harness host.

Runtime pairing is generated on the user's machine and is excluded from this package and public releases. To rotate it, disable the plugin, remove or back up only the generated connection file, then re-enable and re-import it. Model credentials and session logs remain under Harness's own control.

The integration has automated and simulated-editor tests. Actual CLI installation, Host startup, browser-resource delivery, authenticated routes, and 11 Host/transport integration checks passed on dsh 0.2.1-rc.2. Separate user-assisted native tests confirmed Edge-to-Harness draft delivery, multiline text, existing-text preservation, one-step undo and no automatic submission. Additional native race and selection edge cases remain unverified. The package's `private` flag prevents accidental npm publication; local tarball installation remains supported.
