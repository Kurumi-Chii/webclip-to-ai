import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadConnection } from '../packages/harness-webclip/pairing.js';
import { parsePairingFile } from '../extension/pairing.js';
import { validateConfig, DEFAULT_CONFIG } from '../extension/core.js';

async function scratch(fn) {
  const base = path.resolve(os.tmpdir());
  const directory = await fs.mkdtemp(path.join(base, 'webclip-to-ai-test-'));
  try { await fn(directory); }
  finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), base);
    assert.ok(path.basename(resolved).startsWith('webclip-to-ai-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

test('a local installation creates one private token and reuses it', async () => scratch(async home => {
  const first = await loadConnection({ home });
  const second = await loadConnection({ home });
  assert.equal(first.token, second.token);
  assert.equal(first.port, 18766);
  assert.equal(first.token.length, 43);
  const imported = parsePairingFile(await fs.readFile(first.file, 'utf8'));
  assert.equal(imported.token, first.token);
  assert.equal(imported.endpoint, 'http://127.0.0.1:18766/receive');
  if (process.platform !== 'win32') assert.equal((await fs.stat(first.file)).mode & 0o777, 0o600);
}));

test('different installations do not share a credential', async () => scratch(async directory => {
  const a = await loadConnection({ home: path.join(directory, 'a') });
  const b = await loadConnection({ home: path.join(directory, 'b') });
  assert.notEqual(a.token, b.token);
}));

test('invalid saved credentials are not silently overwritten', async () => scratch(async home => {
  const file = path.join(home, 'webclip-to-ai', 'connection.json');
  await fs.mkdir(path.dirname(file));
  const original = '{"app":"wrong","token":"invalid"}';
  await fs.writeFile(file, original);
  await assert.rejects(loadConnection({ home }));
  assert.equal(await fs.readFile(file, 'utf8'), original);
}));

test('import accepts endpoint and token only, rejecting remote or malformed files', () => {
  const valid = { app: 'webclip-to-ai', version: 1, endpoint: 'http://127.0.0.1:18766/receive', token: 'a'.repeat(43) };
  assert.deepEqual(Object.keys(parsePairingFile(JSON.stringify({ ...valid, template: 'untrusted' }))).sort(), ['endpoint', 'token']);
  for (const patch of [
    { app: 'other' }, { version: 2 }, { token: '' }, { token: 'a\nb' },
    { endpoint: 'https://remote.example/receive' }, { endpoint: 'http://localhost:18766/receive' },
    { endpoint: 'http://127.0.0.1:18766/admin' }, { endpoint: 'http://127.0.0.1:18766/receive?send=all' },
    { endpoint: 'http://u:p@127.0.0.1:18766/receive' }
  ]) assert.throws(() => parsePairingFile(JSON.stringify({ ...valid, ...patch })));
  assert.throws(() => parsePairingFile('not-json'));
});

test('Harness settings cannot be saved without a pairing token', () => {
  assert.throws(() => validateConfig({ ...DEFAULT_CONFIG, endpoint: 'http://127.0.0.1:18766/receive', target: 'harness' }), /配对/);
});
