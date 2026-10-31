# Security

## Supported preview

The current maintained version is **1.2.1**. Harness support is pinned to runtime **0.2.1-rc.2**, because the draft integration uses runtime-specific client interfaces. Do not bypass a runtime-version refusal; adapt and test the companion for the new runtime instead.

## Reporting

Do not attach pairing files, API tokens, browser profiles, or unredacted network captures to public Issues. If the repository owner enables GitHub private vulnerability reporting, use **Security → Report a vulnerability**. Otherwise contact the owner privately through contact details they publish on their GitHub profile. This repository template intentionally invents no contact address.

## Trust boundaries

- The public extension preset contains only non-secret defaults. Each Harness installation generates its own local token with 32 random bytes.
- The receiver binds only literal IPv4 loopback, validates Host and Origin, requires JSON plus Bearer authentication, and exposes no CORS opt-in.
- Internal poll/ack routes use Harness's existing authenticated Connection carrier. They are available to authenticated clients of that Harness host; this preview is intended for a single-user local desktop deployment, not a multi-tenant or publicly shared Harness server.
- A paired extension can request insertion into the currently eligible draft. It cannot use the receiver to run shell commands, select a model, or submit the composer.
- Draft insertion captures the session and revision. A changed draft or session causes rejection. Acknowledgement loss is deduplicated for the lifetime of the client plugin.
- A timeout is not a proof that nothing was inserted. The user must inspect the draft before repeating a delivery.
- Public archives exclude `.git`, local configuration, pairing files, credentials, and generated build output from source bundles.

## Rotating local pairing

Disable the companion in Harness. Back up or remove only its `webclip-to-ai/connection.json`, re-enable it, and import the newly generated file into the browser extension. This changes no model credentials or session history. Filesystem permissions follow the host operating system; POSIX files are created with restrictive modes, while Windows relies on the user's directory ACLs.
