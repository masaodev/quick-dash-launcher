/**
 * winget-pkgs に出す正式版のマニフェストを作り、提出の前に確かめる（提出はしない）。
 *
 * 1. wingetcreate update で、前の版のマニフェストを元に新しい版のものを --out に作る（提出しない・トークン不要）
 * 2. 各言語のマニフェストの説明文（PackageName・ShortDescription・Description・Tags）を
 *    packaging/winget/locale.<言語>.yaml（正本）の値で置き換え、使っていない Documentations（Wiki）を消す
 * 3. ja-JP の ReleaseNotes に、--release-notes のファイルの要約を入れる（wingetcreate は前の版の ReleaseNotes を引き継がず、
 *    前の版にあった項目が無いと winget-pkgs の自動検証に指摘される＝0.8.0 の #468015）
 * 4. インストーラーの SHA256 が GitHub Release のアセットの digest と同じか、winget validate が通るかを確かめる
 *
 * 使い方: node scripts/winget-manifest.mjs --version 1.0.0 --release-notes <要約のファイル>
 * 前提: wingetcreate と winget が PATH にあること。Release の Actions が終わり、インストーラーが載っていること
 * 提出は中身を本人に見せて OK を取ってから: wingetcreate submit <出力先> --token "$(gh auth token)"
 * 手順の全体＝docs/setup/build-deploy.md の「winget」、.claude/commands/git-workflow/release-version.md
 */
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const PACKAGE_ID = 'masaodev.quick-dash-launcher';
const REPO = 'masaodev/quick-dash-launcher';
/** 正本の値で置き換える項目 */
const OVERRIDE_KEYS = ['PackageName', 'ShortDescription', 'Description', 'Tags'];
/** ReleaseNotes を入れる言語（0.7.39・0.8.0 と同じく ja-JP だけ。en-US はリリースノートの全文が上限を超えるので入れていない） */
const RELEASE_NOTES_LOCALE = 'ja-JP';
/** ReleaseNotes の要約の長さの目安。全文（0.8.0 で 6,179 字）は長すぎたので、数行に収める */
const RELEASE_NOTES_MAX = 1000;

const root = process.cwd();

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new Error(`知らない引数です: ${key}`);
    args[key.slice(2)] = argv[++i];
  }
  return args;
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const version = args.version;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  fail('--version に正式版の番号（例 1.0.0）を渡してください。ベータ版は winget に出しません');
}
if (!args['release-notes'])
  fail('--release-notes に ReleaseNotes（ja-JP）の要約のファイルを渡してください');
const releaseNotes = fs.readFileSync(args['release-notes'], 'utf8').replace(/\r\n/g, '\n').trim();
if (releaseNotes.length === 0) fail('ReleaseNotes の要約が空です');
if (releaseNotes.length > RELEASE_NOTES_MAX) {
  fail(
    `ReleaseNotes の要約が ${releaseNotes.length} 字あります。${RELEASE_NOTES_MAX} 字以内の数行にしてください`
  );
}
const outDir = path.resolve(args.out ?? path.join(root, 'release', 'winget'));

const installerName = `QuickDashLauncher.Setup.${version}.exe`;
const installerUrl = `https://github.com/${REPO}/releases/download/v${version}/${installerName}`;
const releaseUrl = `https://github.com/${REPO}/releases/tag/v${version}`;

// GitHub Release のアセットの digest（sha256）を取る
const releaseRes = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/v${version}`, {
  headers: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'quick-dash-launcher-winget-manifest',
  },
});
if (!releaseRes.ok) fail(`Release v${version} を読めませんでした（HTTP ${releaseRes.status}）`);
const release = await releaseRes.json();
if (release.prerelease) fail(`v${version} はプレリリースです。winget には正式版だけを出します`);
const asset = release.assets.find((a) => a.name === installerName);
if (!asset)
  fail(
    `Release v${version} に ${installerName} がありません。Actions が終わってからやり直してください`
  );
let digest = asset.digest?.replace(/^sha256:/, '').toUpperCase();
if (!digest) {
  // digest が無い古い API の応答では、ダウンロードして数える
  const bin = Buffer.from(await (await fetch(installerUrl)).arrayBuffer());
  digest = crypto.createHash('sha256').update(bin).digest('hex').toUpperCase();
}

// 1. wingetcreate で作る（提出しない）
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
execFileSync(
  'wingetcreate',
  [
    'update',
    PACKAGE_ID,
    '--version',
    version,
    '--urls',
    `${installerUrl}|x64`,
    '--release-notes-url',
    releaseUrl,
    '--out',
    outDir,
  ],
  { stdio: 'inherit' }
);
const manifestDir = path.join(outDir, 'manifests', 'm', 'masaodev', 'quick-dash-launcher', version);
if (!fs.existsSync(manifestDir)) fail(`wingetcreate の出力が見つかりません: ${manifestDir}`);

/** 先頭のコメント（wingetcreate の印と schema の指定）を残して YAML を書き直す */
function rewriteYaml(file, change) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const header = text.match(/^(?:#.*\n)*/)[0];
  const data = yaml.load(text);
  change(data);
  // 足した ReleaseNotes は ReleaseNotesUrl の前に、ManifestType・ManifestVersion は末尾に置く（前の版と同じ並び）
  const ordered = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'ReleaseNotes' || key === 'ManifestType' || key === 'ManifestVersion') continue;
    if (key === 'ReleaseNotesUrl' && data.ReleaseNotes !== undefined)
      ordered.ReleaseNotes = data.ReleaseNotes;
    ordered[key] = value;
  }
  ordered.ManifestType = data.ManifestType;
  ordered.ManifestVersion = data.ManifestVersion;
  fs.writeFileSync(
    file,
    header + '\n' + yaml.dump(ordered, { lineWidth: -1, noRefs: true }),
    'utf8'
  );
  return ordered;
}

// 2・3. 説明文と ReleaseNotes を入れる
const summary = [];
const localeFiles = fs.readdirSync(manifestDir).filter((f) => /\.locale\.[^.]+\.yaml$/.test(f));
for (const file of localeFiles) {
  const locale = file.match(/\.locale\.([^.]+)\.yaml$/)[1];
  const sourcePath = path.join(root, 'packaging', 'winget', `locale.${locale}.yaml`);
  if (!fs.existsSync(sourcePath)) fail(`${locale} の説明文の正本がありません: ${sourcePath}`);
  const source = yaml.load(fs.readFileSync(sourcePath, 'utf8'));
  rewriteYaml(path.join(manifestDir, file), (data) => {
    for (const key of OVERRIDE_KEYS) {
      if (source[key] === undefined) fail(`${sourcePath} に ${key} がありません`);
      data[key] = source[key];
    }
    delete data.Documentations;
    delete data.ReleaseNotes;
    if (locale === RELEASE_NOTES_LOCALE) data.ReleaseNotes = releaseNotes;
    data.ReleaseNotesUrl = releaseUrl;
  });
  summary.push(
    `${locale}: 説明文を正本で置き換え${locale === RELEASE_NOTES_LOCALE ? `・ReleaseNotes ${releaseNotes.length} 字` : ''}`
  );
}
for (const locale of [RELEASE_NOTES_LOCALE, 'en-US']) {
  if (!localeFiles.some((f) => f.includes(`.locale.${locale}.`)))
    fail(`${locale} のマニフェストがありません`);
}

// 4. インストーラーとハッシュ、winget validate
const installer = yaml.load(
  fs.readFileSync(path.join(manifestDir, `${PACKAGE_ID}.installer.yaml`), 'utf8')
);
const entries = installer.Installers ?? [];
if (entries.length !== 1) fail(`インストーラーが ${entries.length} 件あります（1 件のはず）`);
if (entries[0].InstallerUrl !== installerUrl)
  fail(`InstallerUrl が違います: ${entries[0].InstallerUrl}`);
if (entries[0].InstallerSha256.toUpperCase() !== digest) {
  fail(
    `InstallerSha256（${entries[0].InstallerSha256}）が Release の digest（${digest}）と違います`
  );
}
execFileSync('winget', ['validate', '--manifest', manifestDir], { stdio: 'inherit' });

console.log('');
console.log(`✅ winget のマニフェストを作りました（未提出）: ${manifestDir}`);
for (const line of summary) console.log(`   ${line}`);
console.log(`   インストーラーの SHA256 は Release の digest と一致: ${digest}`);
console.log('');
console.log('中身を本人に見せて OK を取ってから、次で提出する:');
console.log(`  wingetcreate submit "${manifestDir}" --token "$(gh auth token)"`);
