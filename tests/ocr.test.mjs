import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cropBounds, ocrLanguage, recognizedText } from '../extension/ocr-core.js';
import { createOcrController } from '../extension/ocr.js';

test('OCR crop follows actual screenshot/viewport ratios at zoom and HiDPI', () => {
  assert.deepEqual(cropBounds({ x: 10, y: 20, width: 100, height: 50, viewportWidth: 800, viewportHeight: 600 }, 1600, 1200), { x: 20, y: 40, width: 200, height: 100 });
  assert.deepEqual(cropBounds({ x: 10.5, y: 20.5, width: 100.5, height: 50.5, viewportWidth: 800, viewportHeight: 600 }, 1000, 750), { x: 13, y: 25, width: 126, height: 64 });
});
test('invalid, empty, unbounded and excessive OCR regions are rejected', () => {
  const valid = { x: 0, y: 0, width: 100, height: 50, viewportWidth: 800, viewportHeight: 600 };
  for (const patch of [{ width: 0 }, { x: -1 }, { width: Infinity }, { height: NaN }, { x: 790 }, { viewportWidth: 0 }]) assert.throws(() => cropBounds({ ...valid, ...patch }, 800, 600));
  assert.throws(() => cropBounds({ ...valid, width: 800, height: 600 }, 8000, 6000));
});
test('OCR language identifiers cannot supply arbitrary language URLs', () => {
  assert.equal(ocrLanguage('jpn+eng'), 'jpn+eng');
  assert.equal(ocrLanguage('https://evil.example/model'), 'chi_sim+eng');
  assert.equal(ocrLanguage('__proto__'), 'chi_sim+eng');
});
test('recognition preserves Unicode, quotes, slash and paragraph breaks; blank/huge results fail', () => {
  assert.equal(recognizedText(' 你好 "世界"\\\r\n日本語 😀\n\n第二段 \n'), '你好 "世界"\\\n日本語 😀\n\n第二段');
  assert.throws(() => recognizedText(' \n '));
  assert.throws(() => recognizedText('a'.repeat(100001)));
});

function fixture(options = {}) {
  const tab = { id: 7, windowId: 3, url: 'https://fixture.example/image', title: '图片', status: 'complete' };
  const session = {}, results = [], delivered = [], workerMessages = [], pageMessages = [];
  let captureCount = 0, offscreen = false;
  const local = { config: { endpoint: 'http://127.0.0.1:18766/receive', token: 'unit-only', target: 'harness' }, ocr: { autoSend: true, language: 'eng' }, ...options };
  globalThis.chrome = {
    runtime: { id: 'ocr-unit', getURL: file => `chrome-extension://ocr-unit/${file}`, getContexts: async () => offscreen ? [{ contextType: 'OFFSCREEN_DOCUMENT' }] : [], openOptionsPage: async () => {}, sendMessage: async msg => { workerMessages.push(msg); return { ok: true, jobId: msg.jobId }; } },
    storage: { local: { get: async () => structuredClone(local) }, session: { get: async () => structuredClone(session), set: async data => Object.assign(session, structuredClone(data)) } },
    tabs: { get: async () => ({ ...tab }), query: async () => [{ ...tab }], captureVisibleTab: async () => { captureCount++; return 'data:image/png;base64,fixture'; } },
    windows: { get: async () => ({ focused: true }) },
    offscreen: { closeDocument: async () => { offscreen = false; }, createDocument: async () => { offscreen = true; } },
    scripting: { executeScript: async ({ func }) => [{ documentId: 'document-1', result: func.name === 'selectOcrRegion' ? { viewportWidth: 800, viewportHeight: 600 } : { width: 800, height: 600, x: 0, y: 0 } }] }
  };
  const controller = createOcrController({ setResult: async result => results.push(result), enqueueSend: async payload => { delivered.push(payload); return { ok: true, message: '已填入草稿，请手动发送。' }; }, pageFeedback: async (...args) => pageMessages.push(args) });
  const pageSender = { id: 'ocr-unit', url: tab.url, tab: { id: tab.id }, frameId: 0, documentId: 'document-1' };
  const workerSender = { id: 'ocr-unit', url: chrome.runtime.getURL('ocr-offscreen.html') };
  const page = (type, patch = {}, sender = pageSender) => controller.onMessage({ type, jobId: session.ocrJob?.id, region: { x: 10, y: 20, width: 100, height: 50, viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 0 }, ...patch }, sender);
  const worker = (type, patch = {}, sender = workerSender) => controller.onMessage({ type, target: 'ocr-background', jobId: session.ocrJob?.id, ...patch }, sender);
  return { controller, local, tab, session, results, delivered, workerMessages, pageMessages, pageSender, workerSender, page, worker, captures: () => captureCount, offscreen: () => offscreen };
}
test('one gesture-bound OCR job captures once and hands only its screenshot to the local worker', async () => {
  const f = fixture();
  assert.equal((await f.controller.start(f.tab)).ok, true);
  assert.equal((await f.controller.start(f.tab)).ok, false);
  assert.equal((await f.page('ocr-capture')).ok, true);
  assert.equal(f.captures(), 1);
  assert.equal(f.workerMessages[0].target, 'ocr-offscreen');
  assert.ok(!JSON.stringify(f.session).includes('base64'));
});
test('wrong nonce, frame, document and source tab cannot capture screenshots', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  assert.equal((await f.page('ocr-capture', { jobId: 'forged' })).ok, false);
  for (const patch of [{ frameId: 2 }, { documentId: 'new-document' }, { url: 'https://evil.example/' }, { tab: { id: 8 } }]) {
    assert.equal((await f.page('ocr-capture', {}, { ...f.pageSender, ...patch })).ok, false);
  }
  assert.equal(f.captures(), 0);
});
test('Escape cancels the job without a screenshot or a delivery', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-cancel');
  assert.equal((await f.page('ocr-capture')).ok, false);
  assert.equal(f.session.ocrJob.phase, 'cancelled'); assert.equal(f.captures(), 0); assert.equal(f.delivered.length, 0);
});
test('resized or scrolled page fails before any screenshot', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  assert.equal((await f.page('ocr-capture', { region: { x: 10, y: 10, width: 100, height: 50, viewportWidth: 800, viewportHeight: 600, scrollX: 0, scrollY: 5 } })).ok, false);
  assert.equal(f.captures(), 0);
});
test('duplicate worker completions cannot deliver text twice', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  const results = await Promise.all([f.worker('ocr-complete', { text: '第一行\n第二行' }), f.worker('ocr-complete', { text: '重复' })]);
  assert.equal(results[0].ok, true); assert.equal(results[1].ok, false);
  assert.equal(f.delivered.length, 1); assert.equal(f.delivered[0].text, '第一行\n第二行');
});
test('preview mode retains text locally without an HTTP delivery', async () => {
  const f = fixture({ ocr: { autoSend: false, language: 'jpn+eng' } });
  await f.controller.start(f.tab); await f.page('ocr-capture'); await f.worker('ocr-complete', { text: '日本語' });
  assert.equal(f.delivered.length, 0); assert.equal(f.results.at(-1).text, '日本語'); assert.equal(f.results.at(-1).ocr, true);
});
test('changing tab during OCR retains recognized text and prevents automatic delivery', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  chrome.tabs.query = async () => [{ id: 8 }];
  assert.equal((await f.worker('ocr-complete', { text: '可恢复的文字' })).ok, false);
  assert.equal(f.results.at(-1).text, '可恢复的文字'); assert.equal(f.delivered.length, 0);
});
test('refresh during OCR cannot write its result into a later document', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  chrome.scripting.executeScript = async () => [{ documentId: 'document-2', result: true }];
  assert.equal((await f.worker('ocr-complete', { text: '保存结果' })).ok, false);
  assert.equal(f.results.at(-1).text, '保存结果'); assert.equal(f.delivered.length, 0);
});
test('page messages cannot impersonate the offscreen OCR worker', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  assert.equal(f.worker('ocr-complete', { text: 'forged' }, f.pageSender), undefined); assert.equal(f.delivered.length, 0);
});
test('blank results and worker errors never cause a delivery', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  assert.equal((await f.worker('ocr-complete', { text: ' \n ' })).ok, false);
  assert.equal(f.delivered.length, 0);
});
test('protected pages and missing receiver stop before capture', async () => {
  const f = fixture(); assert.equal((await f.controller.start({ ...f.tab, url: 'edge://extensions' })).ok, false);
  const missing = fixture({ config: {} }); assert.equal((await missing.controller.start(missing.tab)).ok, false); assert.equal(missing.captures(), 0);
});
test('connection changes during OCR preserve text without sending to a new destination', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  f.local.config.endpoint = 'https://different.example/receive';
  assert.equal((await f.worker('ocr-complete', { text: '不要误投' })).ok, false);
  assert.equal(f.delivered.length, 0); assert.equal(f.results.at(-1).text, '不要误投');
});
test('worker failure closes its offscreen document and releases the next job', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  assert.equal(f.offscreen(), true);
  await f.worker('ocr-failed'); assert.equal(f.offscreen(), false);
  assert.equal((await f.controller.start(f.tab)).ok, true);
});
test('expired completion cannot deliver old text', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  f.session.ocrJob.time -= 180001;
  assert.equal((await f.worker('ocr-complete', { text: 'too late' })).ok, false);
  assert.equal(f.delivered.length, 0);
});
test('popup may own focus while preparing; capture waits for real foreground interaction', async () => {
  const f = fixture();
  chrome.windows.get = async () => ({ focused: false });
  assert.equal((await f.controller.start(f.tab)).ok, true);
  assert.equal(f.captures(), 0);
  assert.equal((await f.page('ocr-capture')).ok, false);
  assert.equal(f.captures(), 0);
});
test('returning from popup to the webpage allows capture despite background resource loading', async () => {
  const f = fixture(); f.tab.status = 'loading';
  chrome.windows.get = async () => ({ focused: false });
  assert.equal((await f.controller.start(f.tab)).ok, true);
  chrome.windows.get = async () => ({ focused: true });
  assert.equal((await f.page('ocr-capture')).ok, true);
  assert.equal(f.captures(), 1);
});
test('a different active tab still cannot begin a region job', async () => {
  const f = fixture(); chrome.tabs.query = async () => [{ id: 9 }];
  const result = await f.controller.start(f.tab);
  assert.equal(result.ok, false); assert.match(result.message, /标签页已切换/);
  assert.equal(f.captures(), 0);
});
test('actual pending navigation remains blocked before any screenshot', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  f.tab.pendingUrl = f.tab.url;
  assert.equal((await f.page('ocr-capture')).ok, false);
  assert.equal(f.captures(), 0);
});
test('a new document during capture discards pixels before creating an OCR worker', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  chrome.tabs.captureVisibleTab = async () => {
    chrome.scripting.executeScript = async () => [{ documentId: 'changed-during-capture', result: { width: 800, height: 600, x: 0, y: 0 } }];
    return 'data:image/png;base64,discard';
  };
  assert.equal((await f.page('ocr-capture')).ok, false);
  assert.equal(f.workerMessages.length, 0); assert.equal(f.offscreen(), false);
});
test('foreground focus is still required before auto-delivery', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  chrome.windows.get = async () => ({ focused: false });
  assert.equal((await f.worker('ocr-complete', { text: '保留在面板' })).ok, false);
  assert.equal(f.results.at(-1).text, '保留在面板'); assert.equal(f.delivered.length, 0);
});
test('missing worker acceptance immediately releases the busy lock and exposes the failure', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  chrome.runtime.sendMessage = async () => undefined;
  assert.equal((await f.page('ocr-capture')).ok, false);
  assert.equal(f.session.ocrJob.phase, 'error'); assert.equal(f.offscreen(), false);
  assert.match(f.results.at(-1).message, /没有确认/);
  assert.equal((await f.controller.start(f.tab)).ok, true);
});
test('worker acceptance must match the current job ID', async () => {
  const f = fixture(); await f.controller.start(f.tab);
  chrome.runtime.sendMessage = async () => ({ ok: true, jobId: 'wrong' });
  assert.equal((await f.page('ocr-capture')).ok, false); assert.equal(f.offscreen(), false);
});
test('cancel closes a hung OCR worker and late completions cannot deliver', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  const oldId = f.session.ocrJob.id;
  assert.equal((await f.controller.cancel()).ok, true);
  assert.equal(f.offscreen(), false); assert.equal(f.session.ocrJob.phase, 'cancelled');
  assert.equal((await f.worker('ocr-complete', { text: 'late' })).ok, false);
  assert.equal(f.delivered.length, 0);
  assert.equal((await f.controller.start(f.tab)).ok, true);
  assert.notEqual(f.session.ocrJob.id, oldId);
});
test('progress is visible beside OCR controls rather than only at the bottom of the popup', async () => {
  const f = fixture(); await f.controller.start(f.tab); await f.page('ocr-capture');
  await f.worker('ocr-progress', { progress: 0.42 });
  assert.equal(f.results.at(-1).ocr, true); assert.match(f.results.at(-1).message, /42%/);
});
