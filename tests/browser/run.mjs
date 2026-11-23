import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { chromium } from '@playwright/test';

// This isolated test browser never opens the user's profile or contacts their Harness.
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'webclip-ocr-test-'));
const extension = path.join(profile, 'fixture-extension');
await fs.cp(path.resolve('extension'), extension, { recursive: true });
const manifest = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8'));
// Test-only loopback grants replace native user gestures that headless browsers cannot issue.
// They are never written to or packaged with the production extension.
manifest.host_permissions = ['http://127.0.0.1/*'];
await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));
const deliveries = [];
const server = http.createServer(async (req, res) => {
  if (req.url === '/receive') {
    let body = ''; for await (const chunk of req) body += chunk;
    deliveries.push(JSON.parse(body));
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"inserted":true}'); return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>OCR synthetic fixture</title><style>body{margin:0;background:#fff}canvas{margin:80px 40px;width:760px;height:180px}</style></head><body><canvas id="fixture" width="1520" height="360"></canvas><script>const c=document.getElementById('fixture'),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';g.font='56px Arial';g.fillText('WebClip OCR 2026',40,100);g.fillText('Second line stays here',40,200);</script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
let context;
const errors = [], external = [];
async function check(name, task) { await task(); console.log('PASS browser: ' + name); }
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', executablePath: process.env.WEBCLIP_TEST_BROWSER || undefined,
    headless: true, viewport: { width: 1000, height: 800 }, deviceScaleFactor: 1.5,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  context.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(base + '/')) external.push(req.url()); });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const page = await context.newPage(); await page.goto(base + '/');
  const control = await context.newPage(); await control.goto(`chrome-extension://${id}/popup.html`);
  await worker.evaluate(async endpoint => {
    await chrome.storage.local.set({ config: { target: 'harness', endpoint, token: 'isolated-test-only' }, ocr: { language: 'eng', autoSend: false } });
  }, base + '/receive');
  await page.bringToFront();
  async function begin() {
    const reply = await control.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.runtime.sendMessage({ type: 'ocr-start', tabId: tab.id });
    });
    assert.equal(reply.ok, true, reply.message);
  }
  async function drag() {
    await page.mouse.move(45, 85); await page.mouse.down(); await page.mouse.move(790, 250, { steps: 10 }); await page.mouse.up();
  }
  async function result() {
    for (let i = 0; i < 150; i++) {
      const state = await worker.evaluate(() => chrome.storage.session.get(['ocrJob', 'lastResult']));
      if (['done', 'error'].includes(state.ocrJob?.phase)) return state;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('OCR did not finish within 150 seconds');
  }
  await check('popup loads and language preferences persist', async () => {
    await control.reload(); await control.locator('#ocrLanguage').selectOption('jpn+eng');
    assert.equal((await worker.evaluate(() => chrome.storage.local.get('ocr'))).ocr.language, 'jpn+eng');
    await control.locator('#ocrLanguage').selectOption('eng');
  });
  await page.bringToFront();
  await check('Escape removes the region selector without OCR or delivery', async () => {
    await begin(); await page.keyboard.press('Escape');
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal((await worker.evaluate(() => chrome.storage.session.get('ocrJob'))).ocrJob.phase, 'cancelled');
    assert.equal(deliveries.length, 0);
  });
  await check('real capture, offscreen worker, packaged WASM and English OCR at 150% DPI', async () => {
    await begin(); await drag();
    const state = await result();
    assert.equal(state.ocrJob.phase, 'done', JSON.stringify(state));
    assert.match(state.lastResult.text, /WebClip OCR 2026/);
    assert.match(state.lastResult.text, /\n.*Second line stays here/);
    assert.equal(deliveries.length, 0);
    console.log('OCR sample:', JSON.stringify(state.lastResult.text));
  });
  await check('recognition makes no external network requests', async () => assert.deepEqual(external, []));
  assert.deepEqual(errors, [], 'Unexpected extension/page errors');
  console.log('All isolated browser checks passed. Native Edge/Chrome shortcut assignment and actual Harness UI remain manual acceptance items.');
} finally {
  await context?.close();
  await new Promise(resolve => server.close(resolve));
  // The test profile lives only in the OS temporary directory.
  assert.equal(path.dirname(path.resolve(profile)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(profile).startsWith('webclip-ocr-test-'));
  await fs.rm(profile, { recursive: true, force: true });
}
