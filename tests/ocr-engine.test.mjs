import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
// Execute the actual packaged WebAssembly core in-process. No worker/process mocks.
// The project uses ESM, while the upstream browser/Node universal core uses CommonJS.
const filename = fileURLToPath(new URL('../extension/vendor/core/tesseract-core-simd-lstm.wasm.js', import.meta.url));
const upstreamModule = { exports: {} };
const factory = runInThisContext(`(function(exports, require, module, __filename, __dirname){\n${await fs.readFile(filename, 'utf8')}\n})`, { filename: filename + '.cjs' });
factory(upstreamModule.exports, require, upstreamModule, filename, path.dirname(filename));
const createCore = upstreamModule.exports;
const core = await createCore({ print: () => {}, printErr: () => {} });
for (const lang of ['eng', 'chi_sim', 'chi_tra', 'jpn']) {
  core.FS.writeFile(`/${lang}.traineddata`, await fs.readFile(new URL(`../extension/vendor/lang/${lang}.traineddata`, import.meta.url)));
}
for (const [lang, expected] of [
  ['eng', ['WebClip OCR 2026', 'Second line stays here']],
  ['chi_sim', ['图片文字识别测试', '第二行保留换行']],
  ['chi_tra', ['圖片文字識別測試', '第二行保留換行']],
  ['jpn', ['画像の文字を認識します', '日本語のテストです']]
]) {
  const api = new core.TessBaseAPI();
  try {
    assert.equal(api.Init(null, lang === 'eng' ? lang : `${lang}+eng`, 1, undefined), 0);
    api.SetVariable('preserve_interword_spaces', '1');
    core.FS.writeFile('/input', await fs.readFile(new URL(`fixtures/${lang}.png`, import.meta.url)));
    assert.equal(api.SetImageFile(1, 0), 0);
    api.Recognize(null);
    const text = api.GetUTF8Text().trim();
    console.log(`Actual OCR ${lang}: ${JSON.stringify(text)}`);
    for (const line of expected) assert.ok(text.replace(/\s/g, '').includes(line.replace(/\s/g, '')), `Missing ${lang} fixture text`);
    assert.ok(text.includes('\n'), 'Two-line fixture should retain a line break');
  } finally { api.End(); core.destroy?.(api); }
}
console.log('4 actual packaged-WASM recognition checks passed (synthetic, clear printed text only).');
