/**
 * ポータブル版の ZIP を作る。electron-builder が作った release/win-unpacked（展開済みのアプリのフォルダ）に、
 * ポータブル版の印（portable.txt）と空のデータフォルダ（QuickDashLauncher-data）を添えて 1 つの ZIP にまとめる。
 * 展開した人は、そのフォルダの QuickDashLauncher.exe を起動するだけで、データをフォルダの中に置いて使える
 * （判定は src/main/utils/portableMode.ts）
 *
 * 使い方: node scripts/make-portable-zip.mjs（npm run dist から electron-builder の後に呼ばれる）
 * ZIP は Windows 標準の tar.exe（bsdtar）で作る。空のフォルダも ZIP に入る
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const releaseDir = path.join(root, 'release');
const unpackedDir = path.join(releaseDir, 'win-unpacked');
const folderName = `QuickDashLauncher-${version}`;
const stageRoot = path.join(releaseDir, 'portable-stage');
const stageDir = path.join(stageRoot, folderName);
const zipPath = path.join(releaseDir, `QuickDashLauncher-${version}-portable.zip`);

// 名前は src/main/utils/portableMode.ts の PORTABLE_MARKER_FILE・PORTABLE_DATA_DIR と合わせる
const MARKER_FILE = 'portable.txt';
const DATA_DIR = 'QuickDashLauncher-data';
const MARKER_TEXT = [
  'QuickDashLauncher portable edition',
  '',
  `Settings and data are saved in the ${DATA_DIR} folder next to QuickDashLauncher.exe.`,
  `To update, extract the new ZIP to another folder and move ${DATA_DIR} into it.`,
  `If you delete ${DATA_DIR}, data is saved in %APPDATA%\\quick-dash-launcher instead.`,
  '',
  'QuickDashLauncher ポータブル版',
  '',
  `設定とデータは、QuickDashLauncher.exe の横の ${DATA_DIR} フォルダに保存されます。`,
  `新しい版にするときは、新しい ZIP を別のフォルダに展開し、${DATA_DIR} をそちらへ移してください。`,
  `${DATA_DIR} を消すと、%APPDATA%\\quick-dash-launcher に保存します。`,
  '',
].join('\r\n');

if (!fs.existsSync(path.join(unpackedDir, 'QuickDashLauncher.exe'))) {
  console.error(
    `展開済みのアプリが見つかりません: ${unpackedDir}（先に electron-builder を実行してください）`
  );
  process.exit(1);
}

fs.rmSync(stageRoot, { recursive: true, force: true });
fs.rmSync(zipPath, { force: true });
fs.cpSync(unpackedDir, stageDir, { recursive: true });
fs.writeFileSync(path.join(stageDir, MARKER_FILE), MARKER_TEXT, 'utf8');
fs.mkdirSync(path.join(stageDir, DATA_DIR));

// Git Bash などで GNU tar が先に見つかると ZIP を作れないので、Windows 標準の tar.exe を名指しする
const tarExe = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tarExe, ['-a', '-c', '-f', zipPath, '-C', stageRoot, folderName], {
  stdio: 'inherit',
});
fs.rmSync(stageRoot, { recursive: true, force: true });

const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`ポータブル版の ZIP を作りました: ${path.relative(root, zipPath)}（${sizeMb}MB）`);
