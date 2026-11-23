import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeOcrWorkerHandler, hasOcrDocument, withOcrTimeout } from '../extension/ocr-protocol.js';

function handlerFixture() {
  let active, starts = 0;
  const runtime = { id: 'protocol-unit', getURL: path => `chrome-extension://protocol-unit/${path}`, sendMessage: async () => ({ ok: true }) };
  const handler = makeOcrWorkerHandler({ runtime, currentJob: () => active, recognize: message => { active = message.jobId; starts++; } });
  const invoke = (sender, patch = {}) => {
    let reply;
    handler({ target: 'ocr-offscreen', type: 'ocr-recognize', jobId: 'job-1', image: 'data:image/png;base64,fixture', ...patch }, sender, value => { reply = value; });
    return reply;
  };
  return { runtime, invoke, starts: () => starts };
}
test('offscreen accepts same-extension service workers without MessageSender.url and acknowledges startup', () => {
  const f = handlerFixture();
  assert.deepEqual(f.invoke({ id: f.runtime.id }), { ok: true, jobId: 'job-1' });
  assert.equal(f.starts(), 1);
});
test('offscreen also accepts the explicit background URL and idempotently acknowledges retries', () => {
  const f = handlerFixture(), sender = { id: f.runtime.id, url: f.runtime.getURL('background.js') };
  assert.equal(f.invoke(sender).ok, true); assert.equal(f.invoke(sender).ok, true);
  assert.equal(f.starts(), 1);
});
test('other extensions, content scripts with missing URLs, and other pages cannot start OCR', () => {
  const f = handlerFixture();
  for (const sender of [{ id: 'other' }, { id: f.runtime.id, tab: { id: 1 } }, { id: f.runtime.id, url: 'https://evil.example' }, { id: f.runtime.id, url: f.runtime.getURL('popup.html') }]) assert.equal(f.invoke(sender), undefined);
  assert.equal(f.starts(), 0);
});
test('a second unrelated OCR job and malformed screenshot are explicitly refused', () => {
  const f = handlerFixture(), sender = { id: f.runtime.id };
  assert.equal(f.invoke(sender).ok, true);
  assert.equal(f.invoke(sender, { jobId: 'job-2' }).ok, false);
  assert.equal(f.invoke(sender, { image: 'https://remote.example/image' }).ok, false);
  assert.equal(f.starts(), 1);
});
test('Chromium 116-149 uses getContexts without needing offscreen.hasDocument', async () => {
  let query;
  const api = { runtime: { getURL: p => 'chrome-extension://unit/' + p, getContexts: async value => { query = value; return [{}]; } }, offscreen: {} };
  assert.equal(await hasOcrDocument(api), true);
  assert.deepEqual(query.contextTypes, ['OFFSCREEN_DOCUMENT']);
  assert.deepEqual(query.documentUrls, ['chrome-extension://unit/ocr-offscreen.html']);
  api.runtime.getContexts = async () => [];
  assert.equal(await hasOcrDocument(api), false);
});
test('a silent handoff times out while successful responses remain intact', async () => {
  await assert.rejects(withOcrTimeout(new Promise(() => {}), 5), /未及时确认/);
  assert.deepEqual(await withOcrTimeout(Promise.resolve({ ok: true }), 100), { ok: true });
});
