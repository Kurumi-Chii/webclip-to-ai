"""Build a fully local OCR bundle from npm-lock-pinned code and hash-pinned data."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import shutil
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'extension/vendor'
LANGUAGES = json.loads((ROOT / 'scripts/ocr-languages.json').read_text(encoding='utf-8'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def verify():
    manifest = json.loads((VENDOR / 'assets.json').read_text(encoding='utf-8'))
    expected = {item['path']: item['sha256'] for item in manifest['files']}
    actual = {p.relative_to(VENDOR).as_posix() for p in VENDOR.rglob('*') if p.is_file() and p.name != 'assets.json'}
    if actual != set(expected):
        raise RuntimeError('OCR vendor files differ; run npm run prepare:ocr')
    for name, checksum in expected.items():
        if digest(VENDOR / name) != checksum:
            raise RuntimeError('OCR asset checksum mismatch: ' + name)
    for item in LANGUAGES['files']:
        if expected.get('lang/' + item['name']) != item['sha256']:
            raise RuntimeError('Language data differs from pinned manifest')
    packages = manifest['packages']
    lock = json.loads((ROOT / 'package-lock.json').read_text(encoding='utf-8'))['packages']
    for name in ['tesseract.js', 'tesseract.js-core']:
        if packages[name] != lock['node_modules/' + name]['version']:
            raise RuntimeError('OCR engine differs from package-lock.json')
    return manifest

def prepare():
    VENDOR.mkdir(exist_ok=True)
    sources = {
        'tesseract.min.js': 'tesseract.js/dist/tesseract.min.js',
        'worker.min.js': 'tesseract.js/dist/worker.min.js',
        'tesseract.min.js.LICENSE.txt': 'tesseract.js/dist/tesseract.min.js.LICENSE.txt',
        'worker.min.js.LICENSE.txt': 'tesseract.js/dist/worker.min.js.LICENSE.txt',
        'LICENSE.tesseract.js': 'tesseract.js/LICENSE.md',
        'LICENSE.tesseract-core': 'tesseract.js-core/LICENSE',
        'licenses/regenerator-runtime.txt': 'regenerator-runtime/LICENSE',
        'licenses/zlibjs.txt': 'zlibjs/LICENSE',
        'licenses/bmp-js.txt': 'bmp-js/LICENSE',
    }
    for name in ['tesseract-core', 'tesseract-core-simd', 'tesseract-core-lstm', 'tesseract-core-simd-lstm']:
        sources['core/' + name + '.wasm.js'] = 'tesseract.js-core/' + name + '.wasm.js'
    for name, source in sources.items():
        destination = VENDOR / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / 'node_modules' / source, destination)
    for source in (ROOT / 'scripts/licenses').glob('*.txt'):
        destination = VENDOR / 'licenses' / source.name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, destination)
    for name in ['idb-keyval', 'wasm-feature-detect']:
        for license_name in ['LICENSE', 'LICENSE.md', 'LICENSE.txt']:
            source = ROOT / 'node_modules' / name / license_name
            if source.exists():
                shutil.copyfile(source, VENDOR / 'licenses' / (name + '.txt'))
                break
    def language(item):
        path = VENDOR / 'lang' / item['name']
        path.parent.mkdir(exist_ok=True)
        if path.exists() and digest(path) == item['sha256']:
            return
        url = f"https://raw.githubusercontent.com/{LANGUAGES['repository']}/{LANGUAGES['revision']}/{item['name']}"
        data = urllib.request.urlopen(url, timeout=120).read()
        if hashlib.sha256(data).hexdigest() != item['sha256']:
            raise RuntimeError('Downloaded language checksum mismatch')
        path.write_bytes(data)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(language, LANGUAGES['files']))
    packages = {name: json.loads((ROOT / 'node_modules' / name / 'package.json').read_text())['version'] for name in ['tesseract.js', 'tesseract.js-core']}
    files = [{'path': p.relative_to(VENDOR).as_posix(), 'sha256': digest(p)} for p in sorted(VENDOR.rglob('*')) if p.is_file() and p.name != 'assets.json']
    (VENDOR / 'assets.json').write_text(json.dumps({'packages': packages, 'files': files}, indent=2) + '\n', encoding='utf-8')
    verify()
    print(f'Prepared and verified {len(files)} local OCR assets; recognition requires no remote downloads.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    if args.verify:
        verify()
        print('OCR asset hashes and pinned versions verified.')
    else:
        prepare()
