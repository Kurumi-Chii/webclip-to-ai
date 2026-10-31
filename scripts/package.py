"""Dependency-free release packaging; never include local pairing state."""
import hashlib
import io
import json
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
SOURCE_DIRS = ['extension', 'packages', 'scripts', 'tests', 'docs', '.github', 'examples']
SOURCE_FILES = ['package.json', 'package-lock.json', 'README.md', 'README.en.md', 'LICENSE', 'PRIVACY.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', '.gitignore', '.gitattributes', '.editorconfig']

def public_files():
    files = [ROOT / name for name in SOURCE_FILES]
    for folder in SOURCE_DIRS:
        files.extend(p for p in (ROOT / folder).rglob('*') if p.is_file())
    for p in files:
        if p.is_symlink() or not p.resolve().is_relative_to(ROOT):
            raise RuntimeError('Unexpected source link or path')
        if p.name in ('connection.json', 'pairing.json') or '__pycache__' in p.parts or p.suffix in ('.pyc', '.pem', '.key'):
            raise RuntimeError('Private or generated file found in source')
    return sorted(files)

def write_zip(destination, entries):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for source, name in entries:
            archive.write(source, name)
    with zipfile.ZipFile(destination) as archive:
        assert archive.testzip() is None
        assert not any(Path(n).name in ('connection.json', 'pairing.json') for n in archive.namelist())

def build():
    DIST.mkdir(exist_ok=True)
    files = public_files()
    preset = (ROOT / 'extension/harness-preset.js').read_text(encoding='utf-8')
    assert 'token: ""' in preset, 'Public preset contains unexpected pairing state'
    companion = ROOT / 'packages/harness-webclip'
    manifest = json.loads((companion / 'package.json').read_text(encoding='utf-8'))
    assert manifest['version'] == json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['webclip']['harnessVersion']
    tgz = DIST / f'harness-webclip-{manifest["version"]}.tgz'
    with tarfile.open(tgz, 'w:gz') as archive:
        for name in ['package.json'] + manifest['files']:
            source = companion / name
            metadata = archive.gettarinfo(str(source), arcname='package/' + name)
            metadata.uid = metadata.gid = 0
            metadata.uname = metadata.gname = ''
            metadata.mode = 0o644
            archive.addfile(metadata, io.BytesIO(source.read_bytes()))
    with tarfile.open(tgz) as archive:
        assert not any(Path(n).name in ('connection.json', 'pairing.json') for n in archive.getnames())
    extension = DIST / f'webclip-to-ai-extension-v{VERSION}.zip'
    write_zip(extension, [(p, p.relative_to(ROOT / 'extension').as_posix()) for p in files if p.is_relative_to(ROOT / 'extension')])
    source = DIST / f'webclip-to-ai-source-v{VERSION}.zip'
    write_zip(source, [(p, 'webclip-to-ai/' + p.relative_to(ROOT).as_posix()) for p in files])
    complete = DIST / f'webclip-to-ai-v{VERSION}.zip'
    install_files = [(p, p.relative_to(ROOT).as_posix()) for p in files if p.is_relative_to(ROOT / 'extension') or p.is_relative_to(ROOT / 'docs') or p.name in ('README.md', 'README.en.md', 'LICENSE', 'PRIVACY.md', 'SECURITY.md') and p.parent == ROOT]
    install_files.append((tgz, tgz.name))
    write_zip(complete, install_files)
    artifacts = [extension, tgz, complete, source]
    checksums = '\n'.join(f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}' for p in artifacts) + '\n'
    (DIST / 'SHA256SUMS.txt').write_text(checksums, encoding='utf-8')
    print(f'Built and verified {len(artifacts)} public archives plus checksums. No runtime pairing files included.')

if __name__ == '__main__':
    build()
