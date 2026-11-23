# Third-party notices

WebClip to AI's own source is MIT licensed. The optional local OCR feature bundles separately licensed upstream software and models; their licenses remain applicable.

| Component | Version / revision | Source | License |
| --- | --- | --- | --- |
| Tesseract.js | 6.0.1 | https://github.com/naptha/tesseract.js | Apache-2.0 |
| Tesseract.js-core | 6.1.2 (locked by package-lock.json) | https://github.com/naptha/tesseract.js-core | Apache-2.0 |
| English, simplified / traditional Chinese, Japanese fast language models | 87416418657359cb625c412a48b6e1d6d41c29bd | https://github.com/tesseract-ocr/tessdata_fast | Apache-2.0 |

Upstream browser bundles also contain supporting code, including regenerator-runtime, zlib.js, bmp-js, buffer, ieee754, idb-keyval and wasm-feature-detect. Original notices distributed with the minified bundles are retained. Full available licenses are copied into `extension/vendor/licenses/`; OCR engine and language licenses are stored alongside those assets.

The reproducible preparation script copies npm-lock-pinned code and verifies language data against SHA-256 hashes in `scripts/ocr-languages.json`. `extension/vendor/assets.json` records all packaged asset hashes. The generated vendor folder is excluded from Git but included in installation and source archives, so a downloaded release can recognize images without contacting a CDN. Building from a Git checkout requires `npm ci --ignore-scripts` followed by `npm run prepare:ocr`.

No OCR upstream affiliation or endorsement is implied.
