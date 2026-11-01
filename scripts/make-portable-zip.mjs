/**
 * ZIP 版を作る。electron-builder が作った release/win-unpacked（展開済みのアプリのフォルダ）に、
 * ZIP 版の印（portable.txt）を添えて 1 つの ZIP にまとめる。
 * データフォルダ（QuickDashLauncher-data）は入れない。既定ではインストーラー版と同じ %APPDATA% にデータを置くので、
 * 新しいバージョンの ZIP を別のフォルダに展開しても、前のデータをそのまま読む。
 * exe の横にデータフォルダを作るとポータブルモードになる（判定は src/main/utils/portableMode.ts）
 *
 * 使い方: node scripts/make-portable-zip.mjs（npm run dist から electron-builder の後に呼ばれる）
 * ZIP は Windows 標準の tar.exe（bsdtar）で作る
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
  'Quick Dash Launcher (ZIP)',
  '',
  'Settings and data are saved in %APPDATA%\\quick-dash-launcher, the same place as the installer.',
  'To update, extract the new ZIP to another folder. It uses the same data.',
  '',
  `Portable mode: create a folder named ${DATA_DIR} next to QuickDashLauncher.exe`,
  'to save settings and data in that folder instead (for example, to carry QDL on a USB drive).',
  'You can also turn it on the first time you start QDL (the setup screen).',
  `To update in portable mode, move ${DATA_DIR} into the new folder.`,
  'To move existing data, export it in the settings window and import it after switching.',
  '',
  'Quick Dash Launcher（ZIP 版）',
  '',
  '設定とデータは、インストーラー版と同じ %APPDATA%\\quick-dash-launcher に保存されます。',
  '新しいバージョンにするときは、新しい ZIP を別のフォルダに展開してください。同じデータを使います。',
  '',
  `ポータブルモード：QuickDashLauncher.exe の横に ${DATA_DIR} というフォルダを作ると、`,
  '設定とデータをそのフォルダに保存します（USB メモリに入れて持ち歩くときなど）。',
  '初めて起動したときの初回設定画面でも選べます。',
  `ポータブルモードで新しいバージョンにするときは、${DATA_DIR} を新しいフォルダへ移してください。`,
  '今のデータを移すときは、管理ウィンドウでエクスポートし、切り替えた後でインポートしてください。',
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

// Git Bash などで GNU tar が先に見つかると ZIP を作れないので、Windows 標準の tar.exe を名指しする
const tarExe = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
execFileSync(tarExe, ['-a', '-c', '-f', zipPath, '-C', stageRoot, folderName], {
  stdio: 'inherit',
});
fs.rmSync(stageRoot, { recursive: true, force: true });

const sizeMb = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
console.log(`ZIP 版を作りました: ${path.relative(root, zipPath)}（${sizeMb}MB）`);
