import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { startReceiver } from '../packages/harness-webclip/bridge.js';

const token = randomUUID();
const receiver = await startReceiver({ token, port: 0, timeoutMs: 5000 });
const base = `http://127.0.0.1:${receiver.server.address().port}`;
const clientSource = await fs.readFile('packages/harness-webclip/client.js', 'utf8');
let cleanup;
let draft = '', rev = 0, sessionId = 'test-session', inserts = 0, failAckOnce = false, beforeDelivery;
let selections = { start: 0, end: 0 };
const requests = [];
const actions = {
  captureInsertion: () => ({ ...selections, draftRev: rev }),
  insertText: (text, span) => {
    if (span.draftRev !== rev) return false;
    draft = draft.slice(0, span.start) + text + draft.slice(span.end);
    rev++; inserts++;
    selections = { start: draft.length, end: draft.length };
    return true;
  },
  persistDraft: () => {}
};
const context = {
  uiSession: { current: { getSnapshot: () => ({ key: sessionId, props: { inputActions: actions }, hooks: { input: { getSnapshot: () => ({ phase: 'plain', draft, draftRev: rev }) } } }) } },
  effect: fn => { cleanup = fn(); }
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function post(text, extra = {}) {
  return fetch(base + '/receive', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...extra }, body: JSON.stringify({ text }) });
}
let count = 0;
try {
  assert.equal((await post('x', { Authorization: 'Bearer wrong' })).status, 401); count++;
  assert.equal((await post('x', { Origin: 'https://evil.example' })).status, 403); count++;
  assert.equal((await post('x')).status, 409); count++;
  assert.equal((await post('x'.repeat(100001))).status, 400); count++;
  console.log('PASS authentication, cross-site rejection, missing session and size bounds');

  vm.runInNewContext(clientSource, {
    window: { __ModuleLoader__: { load: row => row.factory().apply(context) } },
    crypto: { randomUUID }, location: { protocol: 'dsh-app:' }, setTimeout, clearTimeout, AbortController,
    fetch: async (url, init) => {
      requests.push(url);
      const data = JSON.parse(init.body);
      if (url.endsWith('/poll')) {
        const item = receiver.poll(data);
        if (item.id && beforeDelivery) { const run = beforeDelivery; beforeDelivery = undefined; run(); }
        return Response.json(item);
      }
      if (failAckOnce) { failAckOnce = false; throw Error('temporary network loss'); }
      return Response.json(receiver.ack(data));
    }
  });
  await sleep(30);
  const text = '选中的原文 "双引号"\n换行 \\ 😀 {{url}}';
  const response = await post(text);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).inserted, true);
  assert.equal(draft, text);
  assert.equal(inserts, 1); count++;
  console.log('PASS real HTTP request → actual client plugin → current draft → insertion acknowledgement');

  draft = '已有草稿'; rev++; selections = { start: 0, end: 2 };
  assert.equal((await post('新选文')).status, 200);
  assert.equal(draft, '已有\n\n新选文草稿'); count++;
  console.log('PASS existing draft and selected draft text preserved');

  draft = '用户草稿'; rev++; selections = { start: draft.length, end: draft.length };
  beforeDelivery = () => { draft += '刚编辑'; rev++; };
  assert.equal((await post('不可覆盖')).status, 409);
  assert.equal(draft, '用户草稿刚编辑'); count++;
  console.log('PASS typing during delivery prevents stale insertion');

  beforeDelivery = () => { sessionId = 'different-session'; };
  assert.equal((await post('不可放错会话')).status, 409);
  assert.equal(draft, '用户草稿刚编辑'); count++;
  console.log('PASS navigation during delivery does not insert into another session');

  await sleep(800);
  const before = inserts;
  selections = { start: draft.length, end: draft.length };
  failAckOnce = true;
  assert.equal((await post('仅插入一次')).status, 200);
  assert.equal(inserts, before + 1); count++;
  console.log('PASS lost acknowledgement retries without duplicate insertion');

  assert.ok(requests.every(p => /^api\/local-webclip\/(poll|ack)$/.test(p)));
  assert.ok(!clientSource.includes('.submit(')); count++;
  console.log('PASS no agent prompt or automatic submit endpoint invoked');
} finally {
  cleanup?.();
  await receiver.close();
}
console.log(`${count} Harness checks passed.`);
