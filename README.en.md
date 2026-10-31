# WebClip to AI

**Send selected webpage text to your own agent—or insert it into a DeepSeek Harness draft.**

[中文](README.md) · [Installation](docs/INSTALL.zh-CN.md) · [Privacy](PRIVACY.md)

Preview **v1.2.1**. The 38 automated checks and 11 installed Harness Host/HTTP checks passed; the editor in the latter was simulated. Separate user-assisted testing confirmed the real Edge-to-Harness core flow, multiline text, existing-draft preservation, one-step undo, selection assistance, restore and refresh. Chrome, full browser-restart persistence and additional native edge cases remain unverified. See the [acceptance record](docs/ACCEPTANCE_2026-10-31.zh-CN.md). The companion pins runtime compatibility to **dsh 0.2.1-rc.2**.

## Features

Component versions: browser extension **1.2.1**, Harness companion **1.2.0**. The browser-only patch reads the original clicked-frame selection to preserve newlines that may be flattened in the native context-menu text. Existing compatible companions do not need reinstalling.

- Chrome / Edge Manifest V3 extension with a selection context menu.
- On-demand assistance for common CSS and event-based selection restrictions.
- Generic JSON POST targets with Bearer authentication, custom headers, and nested templates.
- Optional Harness companion: insert into the current desktop-session draft, preserve existing text, and leave submission to the user.
- Per-installation local pairing, with no shared secret in source or release archives.
- Visible delivery feedback and bounded, plain-text response previews.
- No telemetry, ads, remote scripts, or third-party runtime dependencies.

## Install

### Generic agent API

Load `extension/` from the repository—or the extracted extension Release ZIP—through Chrome / Edge's **Load unpacked** command. Configure a real POST endpoint in the extension options, save its host permission, then select webpage text and use the context menu.

The default JSON shape is `{ "text": "selection", "source": { "title": "title", "url": "url" } }`. An API backend must consume it; a chat webpage URL is not a receiving API.

### DeepSeek Harness draft

1. In Harness, open **Plugins → Add plugin**, install the local `harness-webclip-1.2.0.tgz` Release asset, and enable it.
2. On activation, the plugin creates `webclip-to-ai/connection.json` under `DSH_HOME`, or `~/.dsh` when that variable is unset.
3. In extension options, import that file and save the Harness connection. Grant the loopback host permission.
4. Open an editable ordinary desktop session in Harness. Deliver webpage text through the extension context menu.
5. Review the draft and send it yourself. The companion never calls the model or submits the composer.

The pairing token authenticates the local receiver; it is not a model API key. Do not upload the generated file to your repository. The import is processed locally by the extension.

## Development

Requires Node.js 22+ and Python 3.10+. No third-party packages are required.

```sh
npm run check
npm test
npm run build
```

`dist/` receives extension, companion, complete-installation, source, and checksum artifacts. The CI workflow targets Windows and Linux; hosted execution is pending publication of a repository. Tagging `v1.2.1` triggers the provided prerelease workflow after tests and version validation.

## Limits

Protected browser pages and some frames cannot be modified. Image/canvas OCR, streaming chat, and direct insertion into Kimi/Gemini websites are not implemented. Harness chooses the actual model, so this extension does not manage model providers or their credentials. No automatic retries are made for delivery; check the draft before resubmitting after a timeout.

See [testing](docs/TESTING.md), [architecture](docs/ARCHITECTURE.md), [contributing](CONTRIBUTING.md), and the [MIT license](LICENSE). This is an independent community project, not an official DeepSeek or browser-vendor product.
