import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const json = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const project = await json('package.json');
const extension = await json('extension/manifest.json');
const companion = await json('packages/harness-webclip/package.json');
assert.equal(extension.version, project.version);
assert.equal(companion.version, project.webclip.harnessVersion);
assert.equal(extension.manifest_version, 3);
assert.equal(companion.engines.dsh, '0.2.1-rc.2');
assert.ok(!extension.host_permissions && !extension.content_scripts);
assert.ok(!companion.dependencies && !companion.scripts);
for (const file of [extension.background.service_worker, extension.action.default_popup, extension.options_page]) {
  assert.ok((await fs.stat(path.join(root, 'extension', file))).isFile(), `Missing extension entry: ${file}`);
}
for (const file of companion.files) assert.ok((await fs.stat(path.join(root, 'packages/harness-webclip', file))).isFile(), `Missing companion file: ${file}`);
const { HARNESS_PRESET } = await import('../extension/harness-preset.js');
assert.equal(HARNESS_PRESET.token, '', 'Public defaults must not contain a token');
assert.ok(!companion.files.includes('pairing.json') && !companion.files.includes('connection.json'));

const folders = ['extension', 'packages', 'scripts', 'tests', 'docs', '.github', 'examples'];
const rootFiles = ['README.md', 'README.en.md', 'LICENSE', 'PRIVACY.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'package.json', '.gitignore', '.gitattributes', '.editorconfig'];
async function collect(folder) {
  const entries = [];
  for (const item of await fs.readdir(path.join(root, folder), { withFileTypes: true })) {
    const file = path.posix.join(folder, item.name);
    assert.ok(!item.isSymbolicLink(), `Source symlinks are not supported: ${file}`);
    if (item.isDirectory()) entries.push(...await collect(file));
    else entries.push(file);
  }
  return entries;
}
const files = [...rootFiles];
for (const folder of folders) files.push(...await collect(folder));
for (const file of files) {
  assert.ok(!['connection.json', 'pairing.json'].includes(path.basename(file)), `Private runtime configuration in source: ${file}`);
  const source = await fs.readFile(path.join(root, file), 'utf8');
  assert.ok(!/C:[\\/]Users[\\/]Admin/i.test(source), `Personal installation path: ${file}`);
  if (file.endsWith('.json')) JSON.parse(source);
  if (file.endsWith('.md')) {
    for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split('#')[0];
      if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      await fs.access(path.resolve(root, path.dirname(file), target));
    }
  }
}
if (process.argv[2] === '--tag') assert.equal(process.argv[3], `v${project.version}`, 'Tag and project version differ');
console.log(`Source checks passed: ${files.length} files; version ${project.version}; no public pairing token.`);
