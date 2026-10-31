# Contributing

Use Node.js 22+ and Python 3.10+. No external packages need to be installed.

```sh
npm run check
npm test
npm run build
```

Keep the browser extension and Harness companion separated. Preserve the invariant that Harness delivery changes a draft only; do not call composer submission or model APIs as part of text insertion.

When changing authentication, storage, delivery ordering, or draft behavior, include a regression test for the observable behavior. Changes limited to documentation or visual labels do not require mirrored tests. Never commit local `connection.json`, model credentials, personal browser state, or installation-specific paths.

For new Harness versions, verify the relevant source contracts and test in the real application before changing `engines.dsh`. For browser support changes, follow the [manual acceptance procedure](docs/TESTING.md).

Describe a pull request with the problem, resulting user-visible behavior, validation, and any unresolved compatibility limits. Keep Chinese and English overview documents consistent. Submissions are made under the project's MIT license.
