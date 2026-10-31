import * as fs from 'fs';
import * as path from 'path';

import { zipSync, strToU8, type Zippable } from 'fflate';
import type { AppDistribution, DataExportManifest } from '@common/types';
import { DATA_EXPORT_FORMAT, DATA_EXPORT_FORMAT_VERSION } from '@common/types';

/** 設定フォルダ直下の 1 ファイルで書き出すもの */
const ROOT_FILES = [
  'settings.json',
  'workspace.json',
  'workspace-archive.json',
  'workspace-ui-state.json',
  'item-usage.json',
  'search-history.json',
] as const;

/** クリップボードアイテムの実データ（clipboardService の dataFileRef と同じ規則） */
const CLIPBOARD_FILE_PATTERN = /^[A-Za-z0-9_-]+\.json$/;

/**
 * 書き出すファイルを、設定フォルダからの相対パス（区切りは `/`）で集める。
 *
 * 入れる: settings・datafiles/data*.json・workspace の 3 ファイル・clipboard-data・icon-cache/custom・
 * item-usage・search-history。
 * 入れない: 取り直せるアイコン（apps・favicons・extensions）・backup・logs・その PC だけのメモ
 * （path-type-cache.json など）・壊れて退避したファイル（`*.broken-*`）
 */
export function collectExportFiles(configFolder: string): string[] {
  const files: string[] = [];

  for (const name of ROOT_FILES) {
    if (isFile(path.join(configFolder, name))) files.push(name);
  }

  const listFolder = (relFolder: string, accept: (name: string) => boolean): void => {
    const folder = path.join(configFolder, ...relFolder.split('/'));
    let names: string[];
    try {
      names = fs.readdirSync(folder);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      if (!accept(name) || name.includes('.broken-')) continue;
      if (isFile(path.join(folder, name))) files.push(`${relFolder}/${name}`);
    }
  };

  listFolder('datafiles', (name) => name.startsWith('data') && name.endsWith('.json'));
  listFolder('clipboard-data', (name) => CLIPBOARD_FILE_PATTERN.test(name));
  listFolder('icon-cache/custom', () => true);

  return files;
}

/**
 * 設定フォルダの中身を zip 1 つにまとめる。中は設定フォルダと同じ並びで、先頭に manifest.json を置く
 */
export function buildDataExport(
  configFolder: string,
  info: { appVersion: string; distribution: AppDistribution; exportedAt: Date }
): { zip: Uint8Array; manifest: DataExportManifest } {
  const files = collectExportFiles(configFolder);
  const manifest: DataExportManifest = {
    format: DATA_EXPORT_FORMAT,
    formatVersion: DATA_EXPORT_FORMAT_VERSION,
    appVersion: info.appVersion,
    distribution: info.distribution,
    exportedAt: info.exportedAt.toISOString(),
    files,
  };

  const entries: Zippable = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
  };
  for (const relPath of files) {
    entries[relPath] = fs.readFileSync(path.join(configFolder, ...relPath.split('/')));
  }

  // 日時は書き出した時刻（zip の既定は今の時刻だが、テストで固定できるように渡す）
  return { zip: zipSync(entries, { mtime: info.exportedAt }), manifest };
}

/** 書き出すファイルの既定の名前（ローカル時刻の日付）: QuickDashLauncher-export-2026-10-31.zip */
export function defaultExportFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `QuickDashLauncher-export-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.zip`;
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}
