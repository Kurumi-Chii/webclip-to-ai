import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve('extension');
const { DEFAULT_CONFIG, endpointInfo, validateConfig, makeRequest } = await import(pathToFileURL(path.join(root, 'core.js')));
let count = 0;
function check(name, fn) { fn(); count++; console.log('PASS ' + name); }
const cfg = { ...DEFAULT_CONFIG, endpoint: 'http://127.0.0.1:8765/receive', token: 'test-token' };
check('permission pattern excludes ports', () => assert.deepEqual(endpointInfo(cfg.endpoint), { endpoint: cfg.endpoint, origin: 'http://127.0.0.1/*' }));
check('IPv6 loopback pattern', () => assert.equal(endpointInfo('http://[::1]:8765/x').origin, 'http://[::1]/*'));
check('reject non-HTTP, URL credentials and fragments', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'https://u:p@example.com', 'https://example.com/#token']) assert.throws(() => endpointInfo(url));
});
const text = '引号 "双引号"\n换行 \\反斜杠 😀 {{url}} <script>alert(1)</script>';
check('exact selection preserved, no recursive placeholder expansion', () => {
  const req = makeRequest(cfg, { text, title: '测试页', url: 'https://source.example/?q="a"' });
  assert.equal(JSON.parse(req.init.body).text, text);
  assert.equal(JSON.parse(req.init.body).source.url, 'https://source.example/?q="a"');
  assert.equal(req.init.headers.get('Authorization'), 'Bearer test-token');
  assert.equal(req.init.credentials, 'omit');
  assert.equal(req.init.redirect, 'error');
});
check('nested platform-specific payload and API key', () => {
  const req = makeRequest({ ...cfg, token: '', headers: '{"X-API-Key":"abc"}', template: '{"conversation_id":"123","messages":[{"role":"user","content":"摘录：{{text}}"}],"stream":false}' }, { text: '你好' });
  assert.equal(JSON.parse(req.init.body).messages[0].content, '摘录：你好');
  assert.equal(req.init.headers.get('X-API-Key'), 'abc');
  assert.equal(req.init.headers.has('Authorization'), false);
});
check('malformed config cannot be saved', () => {
  for (const patch of [{ headers: '[]' }, { headers: '{"X-Key":1}' }, { headers: '{"Host":"x"}' }, { headers: '{"Content-Type":"text/plain"}' }, { headers: '{"Authorization":"x"}' }, { token: 'a\nb' }, { template: '{}' }, { template: 'not json' }]) assert.throws(() => validateConfig({ ...cfg, ...patch }));
});
check('blank and oversized selections rejected', () => {
  assert.throws(() => makeRequest(cfg, { text: ' \n ' }));
  assert.throws(() => makeRequest(cfg, { text: 'x'.repeat(100001) }));
  assert.equal(JSON.parse(makeRequest(cfg, { text: 'x'.repeat(100000) }).init.body).text.length, 100000);
});

const listeners = {}, local = { config: cfg }, session = {}, badge = {};
let settingsOpened = 0;
const feedback = [];
globalThis.chrome = {
  runtime: { id: 'unit-test', getURL: p => 'chrome-extension://unit-test/' + p, openOptionsPage: async () => { settingsOpened++; }, onInstalled: { addListener: fn => listeners.install = fn }, onMessage: { addListener: fn => listeners.message = fn } },
  contextMenus: { removeAll: fn => fn(), create: () => {}, onClicked: { addListener: fn => listeners.click = fn } },
  storage: { local: { setAccessLevel: async () => {}, get: async () => local }, session: { setAccessLevel: async () => {}, set: async data => Object.assign(session, data) } },
  permissions: { contains: async () => true },
  action: { setBadgeText: async obj => Object.assign(badge, obj), setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
  scripting: { insertCSS: async () => {}, removeCSS: async () => {}, executeScript: async args => { feedback.push(args); return []; } }
};
const { sendPayload, unlockTab } = await import(pathToFileURL(path.join(root, 'background.js')));
const received = [];
const server = http.createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  received.push({ body: JSON.parse(body), auth: req.headers.authorization });
  if (req.url === '/fail') { res.writeHead(401); res.end('DO_NOT_STORE_SECRET'); }
  else if (req.url === '/redirect') { res.writeHead(302, { Location: '/receive' }); res.end(); }
  else if (req.url === '/large') { res.writeHead(200); res.end('好'.repeat(20000)); }
  else if (req.url === '/harness') { res.writeHead(200); res.end('{"inserted":true}'); }
  else if (req.url === '/harness-fail') { res.writeHead(409); res.end('{"message":"请先打开 Harness 会话"}'); }
  else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"received":true}'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
try {
  local.config = { ...cfg, endpoint: base + '/receive' };
  assert.equal((await sendPayload({ text, title: '标题', url: 'https://example.com' })).ok, true);
  assert.equal(received.at(-1).body.text, text);
  assert.equal(received.at(-1).auth, 'Bearer test-token');
  assert.equal(session.lastResult.status, 'success');
  assert.equal(badge.text, '✓'); count++; console.log('PASS real HTTP POST, auth, Unicode, result and badge');

  local.config.endpoint = base + '/fail';
  assert.equal((await sendPayload({ text: 'retry me' })).ok, false);
  assert.match(session.lastResult.message, /401/);
  assert.equal(session.lastResult.text, 'retry me');
  assert.ok(!JSON.stringify(session).includes('DO_NOT_STORE_SECRET')); count++; console.log('PASS HTTP failure preserves text without leaking error body');

  local.config.endpoint = base + '/redirect';
  assert.equal((await sendPayload({ text: 'no redirect' })).ok, false); count++; console.log('PASS redirects rejected');

  local.config.endpoint = base + '/large';
  assert.equal((await sendPayload({ text: 'large response' })).ok, true);
  assert.ok(session.lastResult.reply.length < 8100); count++; console.log('PASS response preview bounded');

  local.config = {};
  assert.equal((await sendPayload({ text: 'keep pending' })).ok, false);
  assert.equal(session.lastResult.text, 'keep pending'); count++; console.log('PASS unconfigured endpoint retains selection');

  const clickResult = await listeners.click({ menuItemId: 'send-selection-to-agent', selectionText: '右键选文', pageUrl: 'https://source.example' }, { id: 1, title: '来源' });
  assert.equal(clickResult.needsSetup, true);
  assert.equal(settingsOpened, 1);
  assert.equal(session.lastResult.text, '右键选文');
  assert.equal(feedback.at(-1).args[1], 'error');
  assert.match(feedback.at(-1).args[0], /还没有连接/); count++; console.log('PASS actual context-menu handler opens setup and shows visible feedback');

  local.config = { ...cfg, target: 'harness', endpoint: base + '/harness' };
  assert.equal((await sendPayload({ text: '填入草稿' })).ok, true);
  assert.match(session.lastResult.message, /输入框.*手动/); count++; console.log('PASS Harness success requires insertion receipt');

  local.config.endpoint = base + '/receive';
  assert.equal((await sendPayload({ text: 'wrong receiver' })).ok, false); count++; console.log('PASS generic 2xx cannot pretend Harness input was filled');

  local.config.endpoint = base + '/harness-fail';
  assert.equal((await sendPayload({ text: 'not open' })).ok, false);
  assert.match(session.lastResult.message, /请先打开 Harness/); count++; console.log('PASS Harness actionable error surfaced');

  local.config = { ...cfg, endpoint: base + '/receive' };
  const originalExecuteScript = chrome.scripting.executeScript;
  const multiline = '第一行："你好"。\n第二行：反斜杠 \\ 和表情 😀。';
  let selectedFrame;
  chrome.scripting.executeScript = async args => {
    if (args.func.name === 'readPageSelection') { selectedFrame = args.target; return [{ result: multiline }]; }
    return originalExecuteScript(args);
  };
  const multilineResult = await listeners.click({ menuItemId: 'send-selection-to-agent', selectionText: multiline.replace(/\s+/gu, ' '), frameId: 7, pageUrl: 'https://source.example' }, { id: 42, title: 'Multiline fixture' });
  assert.equal(multilineResult.ok, true);
  assert.equal(received.at(-1).body.text, multiline);
  assert.deepEqual(selectedFrame, { tabId: 42, frameIds: [7] });
  count++; console.log('PASS context-menu delivery restores original newlines from the clicked frame');

  chrome.scripting.executeScript = async args => args.func.name === 'readPageSelection' ? [{ result: 'different selected words' }] : originalExecuteScript(args);
  await listeners.click({ menuItemId: 'send-selection-to-agent', selectionText: 'original words', pageUrl: 'https://source.example' }, { id: 42 });
  assert.equal(received.at(-1).body.text, 'original words');
  count++; console.log('PASS changed page selection cannot replace the words selected for the native menu');

  chrome.scripting.executeScript = async args => {
    if (args.func.name === 'readPageSelection') throw new Error('restricted frame');
    return originalExecuteScript(args);
  };
  await listeners.click({ menuItemId: 'send-selection-to-agent', selectionText: 'native fallback', pageUrl: 'https://source.example' }, { id: 42 });
  assert.equal(received.at(-1).body.text, 'native fallback');
  count++; console.log('PASS unavailable frame capture falls back without losing the selected text');
  chrome.scripting.executeScript = originalExecuteScript;

  chrome.permissions.contains = async () => false;
  const before = received.length;
  assert.equal((await sendPayload({ text: 'no permission' })).ok, false);
  assert.equal(received.length, before); count++; console.log('PASS no network without explicit permission');

  assert.equal(listeners.message({ type: 'send' }, { id: 'other', url: 'https://evil.test/' }, () => {}), false);
  assert.equal(listeners.message({ type: 'send' }, { id: 'unit-test', url: 'https://evil.test/', tab: { id: 1 } }, () => {}), false); count++; console.log('PASS only extension UI can submit messages');

  await assert.rejects(() => unlockTab(undefined));
  chrome.scripting.insertCSS = async () => { throw Error('blocked'); };
  await assert.rejects(() => unlockTab(1), /此页无法操作/); count++; console.log('PASS protected page failure explained');

  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json')));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(!manifest.host_permissions);
  assert.ok(!manifest.content_scripts); count++; console.log('PASS no automatic all-site injection');
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(`\n${count} checks passed.`);
