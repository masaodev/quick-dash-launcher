/**
 * THIRD-PARTY-NOTICES.md を作る。アプリに同梱するサードパーティのソフトウェアについて、
 * 名前・バージョン・ライセンスと、著作権表示を含むライセンス本文をまとめる（MIT・BSD・ISC などが本文の同梱を求めるため）。
 *
 * 載せるもの:
 * - npm のパッケージ（dependencies とその依存。license-checker の --production と同じ範囲）
 * - 同梱のネイティブ DLL（resources/native/。本文は DLL の横の <名前>-LICENSE.txt）
 * - qdl.exe（cli/）に入る Rust のクレート（cargo metadata で調べる。cargo が要る）
 * Electron と Chromium の本文は electron-builder が LICENSE.electron.txt・LICENSES.chromium.html として同梱するので、ここには載せない
 *
 * 使い方: node scripts/generate-third-party-notices.mjs（npm run build の prebuild から呼ばれる）
 * 本文が見つからないパッケージがあると失敗する。そのときは LICENSE_TEXT_FROM に本文を借りる先を足す
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const checker = require('license-checker');

const root = process.cwd();
const outPath = path.join(root, 'THIRD-PARTY-NOTICES.md');
const selfName = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name;

/** ライセンスファイルを含まないパッケージの、本文を借りる先（同じプロジェクトの別パッケージ） */
const LICENSE_TEXT_FROM = {
  '@koromix/koffi-win32-x64': 'koffi',
};

/** 同梱のネイティブ DLL（本文は resources/native/<名前>-LICENSE.txt） */
const NATIVE_LIBRARIES = [
  {
    name: 'VirtualDesktopAccessor.dll',
    license: 'MIT',
    repository: 'https://github.com/Ciantic/VirtualDesktopAccessor',
    licenseFile: 'resources/native/VirtualDesktopAccessor-LICENSE.txt',
  },
];

const LICENSE_FILE_PATTERN = /^(licen[cs]e|copying|unlicense)/i;

function readText(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
}

function fence(text) {
  return ['````text', text, '````'].join('\n');
}

function entry({ name, version, license, repository, text }) {
  const lines = [`### ${version ? `${name}@${version}` : name}`, '', `- License: ${license}`];
  if (repository) lines.push(`- Repository: ${repository}`);
  lines.push('', fence(text), '');
  return lines.join('\n');
}

function splitNameVersion(key) {
  const at = key.lastIndexOf('@');
  return { name: key.slice(0, at), version: key.slice(at + 1) };
}

function collectNpm() {
  return new Promise((resolve, reject) => {
    checker.init({ start: root, production: true }, (err, packages) => {
      if (err) return reject(err);
      const byName = new Map(
        Object.entries(packages).map(([key, info]) => [splitNameVersion(key).name, info])
      );
      const missing = [];
      const entries = Object.entries(packages)
        .map(([key, info]) => ({ ...splitNameVersion(key), info }))
        .filter(({ name }) => name !== selfName)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, version, info }) => {
          let file = info.licenseFile;
          if (!file || !LICENSE_FILE_PATTERN.test(path.basename(file))) {
            const from = LICENSE_TEXT_FROM[name];
            file = from ? byName.get(from)?.licenseFile : undefined;
          }
          if (!file || !LICENSE_FILE_PATTERN.test(path.basename(file))) {
            missing.push(`${name}@${version}`);
            return null;
          }
          const license = Array.isArray(info.licenses) ? info.licenses.join(', ') : info.licenses;
          return entry({
            name,
            version,
            license,
            repository: info.repository,
            text: readText(file),
          });
        });
      if (missing.length > 0) {
        return reject(
          new Error(
            `ライセンスの本文が見つからないパッケージ: ${missing.join(', ')}。scripts/generate-third-party-notices.mjs の LICENSE_TEXT_FROM に本文を借りる先を足してください`
          )
        );
      }
      resolve(entries);
    });
  });
}

function collectNative() {
  return NATIVE_LIBRARIES.map((lib) =>
    entry({ ...lib, text: readText(path.join(root, lib.licenseFile)) })
  );
}

/** 「A OR B」のライセンスは MIT の本文を選ぶ。「AND」で足される本文（Unicode など）は一緒に載せる */
function pickRustLicenseFiles(dir, license) {
  const files = fs.readdirSync(dir).filter((f) => LICENSE_FILE_PATTERN.test(f));
  const mit = files.find((f) => /mit/i.test(f));
  const picked = mit ? [mit] : files.filter((f) => !/apache/i.test(f) || files.length === 1);
  if (/unicode/i.test(license)) {
    const unicode = files.find((f) => /unicode/i.test(f));
    if (unicode && !picked.includes(unicode)) picked.push(unicode);
  }
  return picked.length > 0 ? picked : files;
}

function collectRust() {
  const output = execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], {
    cwd: path.join(root, 'cli'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const metadata = JSON.parse(output);
  const workspace = new Set(metadata.workspace_members);
  return metadata.packages
    .filter((pkg) => !workspace.has(pkg.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((pkg) => {
      const dir = path.dirname(pkg.manifest_path);
      const files = pickRustLicenseFiles(dir, pkg.license ?? '');
      if (files.length === 0) {
        throw new Error(
          `Rust のクレート ${pkg.name}@${pkg.version} にライセンスの本文が見つかりません`
        );
      }
      return entry({
        name: pkg.name,
        version: pkg.version,
        license: pkg.license ?? 'unknown',
        repository: pkg.repository,
        text: files.map((f) => readText(path.join(dir, f))).join('\n\n'),
      });
    });
}

const npmEntries = await collectNpm();
const nativeEntries = collectNative();
const rustEntries = collectRust();

const content = [
  '# Third-party notices',
  '',
  'Quick Dash Launcher includes the following third-party software. Each is listed with its license and copyright notice.',
  'The licenses of Electron and Chromium are in LICENSE.electron.txt and LICENSES.chromium.html in the installation folder.',
  '',
  'Quick Dash Launcher は、次のサードパーティのソフトウェアを含みます。それぞれのライセンスと著作権表示を載せます。',
  'Electron と Chromium のライセンスは、インストール先の LICENSE.electron.txt と LICENSES.chromium.html にあります。',
  '',
  `## npm packages (${npmEntries.length})`,
  '',
  ...npmEntries,
  `## Native libraries (${nativeEntries.length})`,
  '',
  ...nativeEntries,
  `## Rust crates in qdl.exe (${rustEntries.length})`,
  '',
  ...rustEntries,
].join('\n');

fs.writeFileSync(outPath, content, 'utf8');
console.log(
  `THIRD-PARTY-NOTICES.md: npm ${npmEntries.length}・DLL ${nativeEntries.length}・Rust ${rustEntries.length}`
);
