# WebClip to AI

**Send selected webpage text to your own agent—or insert it into a DeepSeek Harness draft.**

[中文](README.md) · [Installation](docs/INSTALL.zh-CN.md) · [Privacy](PRIVACY.md)

Local candidate **v1.3.1** adds shortcut-based local region OCR. 76 automated checks and seven browser OCR/HTTP pipeline checks passed; native installed-extension OCR acceptance and hosted CI for this version remain pending. See [OCR instructions and scope](docs/OCR.zh-CN.md).

Previously published **v1.2.1**: The 38 automated checks and 11 installed Harness Host/HTTP checks passed; the editor in the latter was simulated. Separate user-assisted testing confirmed the real Edge-to-Harness core flow, multiline text, existing-draft preservation, one-step undo, selection assistance, restore and refresh. Chrome, full browser-restart persistence and additional native edge cases remain unverified. See the [acceptance record](docs/ACCEPTANCE_2026-10-31.zh-CN.md). That published companion pinned **dsh 0.2.1-rc.2**. The new companion 1.2.1 explicitly supports **rc.2 and rc.5**, see [rc.5 verification and upgrade](docs/DSH_RC5.zh-CN.md).

## Features

Component versions: browser extension **1.3.1**, Harness companion **1.2.1**. The browser-only patch reads the original clicked-frame selection to preserve newlines that may be flattened in the native context-menu text. Users who upgraded Harness to rc.5 must update the companion to 1.2.1; existing pairing data is preserved.

- Chrome / Edge Manifest V3 extension with a selection context menu.
- On-demand assistance for common CSS and event-based selection restrictions.
- Generic JSON POST targets with Bearer authentication, custom headers, and nested templates.
- Optional Harness companion: insert into the current desktop-session draft, preserve existing text, and leave submission to the user.
- Per-installation local pairing, with no shared secret in source or release archives.
- Visible delivery feedback and bounded, plain-text response previews.
- Alt+Shift+O selects a visible image region for local OCR, with simplified/traditional Chinese, Japanese and English. OCR results can be delivered automatically or reviewed first. Harness still requires manual submission.
- No telemetry, ads or remote scripts. OCR code and models are bundled locally under their upstream licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

## Install

### Generic agent API

Prepare OCR assets using the development commands below before loading from Git; released ZIPs already contain them. Load `extension/` through Chrome / Edge's **Load unpacked** command. Configure a real POST endpoint in the extension options, save its host permission, then select webpage text and use the context menu.

The default JSON shape is `{ "text": "selection", "source": { "title": "title", "url": "url" } }`. An API backend must consume it; a chat webpage URL is not a receiving API.

### DeepSeek Harness draft

1. In Harness, open **Plugins → Add plugin**, install the local `harness-webclip-1.2.1.tgz` Release asset, and enable it.
2. On activation, the plugin creates `webclip-to-ai/connection.json` under `DSH_HOME`, or `~/.dsh` when that variable is unset.
3. In extension options, import that file and save the Harness connection. Grant the loopback host permission.
4. Open an editable ordinary desktop session in Harness. Deliver webpage text through the extension context menu.
5. Review the draft and send it yourself. The companion never calls the model or submits the composer.

The pairing token authenticates the local receiver; it is not a model API key. Do not upload the generated file to your repository. The import is processed locally by the extension.

## Development

Development requires Node.js 22+ and Python 3.10+. Install lock-pinned dev dependencies and prepare checksummed OCR assets; initial preparation downloads language data. End users do not need build tools or an OCR API key.

```sh
npm ci --ignore-scripts
npm run prepare:ocr
npm run check
npm test
npm run build
```

`dist/` receives extension, companion, complete-installation, source, and checksum artifacts. The published v1.2.1 CI passed on Windows and Linux; hosted execution for this local candidate is pending. Tagging `v1.3.1` triggers the provided prerelease workflow after tests and version validation.

## Limits

Protected browser pages and some frames cannot be modified. Region OCR is available in v1.3.1; recognition can be inaccurate and native browser acceptance remains pending. Whole-document scanned-PDF extraction, streaming chat and direct insertion into Kimi/Gemini websites are not implemented. Harness chooses the actual model, so this extension does not manage model providers or their credentials. No automatic retries are made for delivery; check the draft before resubmitting after a timeout.

See [testing](docs/TESTING.md), [architecture](docs/ARCHITECTURE.md), [contributing](CONTRIBUTING.md), and the [MIT license](LICENSE). This is an independent community project, not an official DeepSeek or browser-vendor product.
