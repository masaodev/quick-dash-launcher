import * as path from 'path';
import * as fs from 'fs';

import { app } from 'electron';

// パス定数
export const HOTKEY = 'Ctrl+Alt+W';
export const CONFIG_FOLDER = path.join(app.getPath('userData'), 'config');
export const ICONS_FOLDER = path.join(CONFIG_FOLDER, 'icons');
export const FAVICONS_FOLDER = path.join(CONFIG_FOLDER, 'favicons');
export const SCHEMES_FOLDER = path.join(ICONS_FOLDER, 'schemes');
export const EXTENSIONS_FOLDER = path.join(ICONS_FOLDER, 'extensions');
export const BACKUP_FOLDER = path.join(CONFIG_FOLDER, 'backup');

export function ensureDirectories(): void {
  const dirs = [
    CONFIG_FOLDER,
    ICONS_FOLDER,
    FAVICONS_FOLDER,
    SCHEMES_FOLDER,
    EXTENSIONS_FOLDER,
    BACKUP_FOLDER,
  ];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

export function createDefaultDataFile(): void {
  const dataPath = path.join(CONFIG_FOLDER, 'data.txt');
  if (!fs.existsSync(dataPath)) {
    const defaultContent = `// Webサイト
GitHub,https://github.com/
Google マップ,https://www.google.co.jp/maps

// ローカルフォルダ
デスクトップ,shell:Desktop
ダウンロード,shell:Downloads

// アプリケーション
メモ帳,notepad.exe
`;
    fs.writeFileSync(dataPath, defaultContent, 'utf8');
  }
}

export function backupDataFiles(): void {
  const timestamp = new Date().toISOString().replace(/:/g, '-').substring(0, 19);
  const files = ['data.txt', 'data2.txt', 'tempdata.txt'];

  files.forEach((file) => {
    const sourcePath = path.join(CONFIG_FOLDER, file);
    if (fs.existsSync(sourcePath)) {
      const backupPath = path.join(BACKUP_FOLDER, `${file}.${timestamp}`);
      fs.copyFileSync(sourcePath, backupPath);
    }
  });
}
