import * as fs from 'fs';
import * as path from 'path';

import { unzipSync, strFromU8 } from 'fflate';
import {
  DATA_EXPORT_FORMAT,
  DATA_EXPORT_FORMAT_VERSION,
  JSON_DATA_VERSION,
  SETTINGS_FORMAT_VERSION,
  WORKSPACE_UI_STATE_VERSION,
  type AppDistribution,
  type DataExportManifest,
  type DataImportProblem,
} from '@common/types';
import { JSON_WORKSPACE_VERSION } from '@common/types/json-workspace';
import { LAUNCH_USAGE_VERSION } from '@common/types/launchUsage';
import { isRecord } from '@common/types/guards';
import { isNewerFormatVersion, type FormatVersion } from '@common/utils/formatVersion';

import { collectExportFiles } from './dataExportService.js';
import { SEARCH_HISTORY_VERSION } from './searchHistoryService.js';

/** 中の 1 ファイルの大きさの上限（クリップボードの画像を考えても十分に大きく取る） */
const MAX_FILE_SIZE = 100 * 1024 * 1024;
/** 中のファイルの合計の上限 */
const MAX_TOTAL_SIZE = 1024 * 1024 * 1024;

/** 版を持つ JSON ファイル: どのキーに版を書くかと、この QDL が書く版 */
const VERSIONED_FILES: Array<{
  match: (relPath: string) => boolean;
  key: string;
  version: FormatVersion;
}> = [
  { match: (p) => p === 'settings.json', key: 'settingsVersion', version: SETTINGS_FORMAT_VERSION },
  { match: (p) => p.startsWith('datafiles/'), key: 'version', version: JSON_DATA_VERSION },
  {
    match: (p) => p === 'workspace.json' || p === 'workspace-archive.json',
    key: 'version',
    version: JSON_WORKSPACE_VERSION,
  },
  {
    match: (p) => p === 'workspace-ui-state.json',
    key: 'version',
    version: WORKSPACE_UI_STATE_VERSION,
  },
  { match: (p) => p === 'item-usage.json', key: 'version', version: LAUNCH_USAGE_VERSION },
  { match: (p) => p === 'search-history.json', key: 'version', version: SEARCH_HISTORY_VERSION },
];

const ROOT_FILES = new Set([
  'settings.json',
  'workspace.json',
  'workspace-archive.json',
  'workspace-ui-state.json',
  'item-usage.json',
  'search-history.json',
]);

/**
 * zip の中で読み込んでよい名前か（書き出しで入れるものと同じ規則）。
 * 決まった名前以外・`..`・絶対パス・区切りの `\` は拒む（設定フォルダの外へ書かせない）
 */
export function isImportablePath(name: string): boolean {
  if (ROOT_FILES.has(name)) return true;
  const match = /^(datafiles|clipboard-data|icon-cache\/custom)\/([^/\\]+)$/.exec(name);
  if (!match) return false;
  const [, folder, fileName] = match;
  if (fileName === '.' || fileName === '..' || fileName.includes('.broken-')) return false;
  if (folder === 'datafiles') return fileName.startsWith('data') && fileName.endsWith('.json');
  if (folder === 'clipboard-data') return /^[A-Za-z0-9_-]+\.json$/.test(fileName);
  // 自分で設定したアイコン: Windows のファイル名に使えない文字は拒む
  return ![...fileName].some((c) => c.charCodeAt(0) < 0x20 || '<>:"|?*'.includes(c));
}

/** 書き出したファイルを読んで確かめた中身 */
export interface DataImportContent {
  manifest: DataExportManifest;
  /** 設定フォルダからの相対パス → 中身 */
  files: Map<string, Uint8Array>;
}

/**
 * 書き出した zip を読み、書き込む前にすべて確かめる。1 つでも読めなければ何も返さない
 */
export function readDataImport(
  zip: Uint8Array
): { ok: true; content: DataImportContent } | { ok: false; problem: DataImportProblem } {
  let problem: DataImportProblem | null = null;
  let total = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(zip, {
      // 展開する前に名前と大きさを見る（大きすぎるものを展開しない）
      filter: (file) => {
        if (problem || file.name.endsWith('/')) return false;
        if (file.name !== 'manifest.json' && !isImportablePath(file.name)) {
          problem = { kind: 'invalidFile', file: file.name };
          return false;
        }
        total += file.originalSize;
        if (file.originalSize > MAX_FILE_SIZE || total > MAX_TOTAL_SIZE) {
          problem = { kind: 'invalidFile', file: file.name };
          return false;
        }
        return true;
      },
    });
  } catch {
    return { ok: false, problem: { kind: 'notExport' } };
  }
  if (problem) return { ok: false, problem };

  const manifestBytes = entries['manifest.json'];
  if (!manifestBytes) return { ok: false, problem: { kind: 'notExport' } };
  const manifest = parseJson(manifestBytes);
  if (!isRecord(manifest) || manifest.format !== DATA_EXPORT_FORMAT) {
    return { ok: false, problem: { kind: 'notExport' } };
  }
  if (typeof manifest.formatVersion !== 'number' || !Number.isInteger(manifest.formatVersion)) {
    return { ok: false, problem: { kind: 'notExport' } };
  }
  if (manifest.formatVersion > DATA_EXPORT_FORMAT_VERSION) {
    return { ok: false, problem: { kind: 'newerVersion' } };
  }

  const files = new Map<string, Uint8Array>();
  for (const [name, bytes] of Object.entries(entries)) {
    if (name === 'manifest.json' || name.endsWith('/')) continue;
    if (name.endsWith('.json')) {
      const raw = parseJson(bytes);
      if (raw === undefined) return { ok: false, problem: { kind: 'invalidFile', file: name } };
      const versioned = VERSIONED_FILES.find((v) => v.match(name));
      if (
        versioned &&
        isRecord(raw) &&
        isNewerFormatVersion(raw[versioned.key], versioned.version)
      ) {
        return { ok: false, problem: { kind: 'newerVersion' } };
      }
    }
    files.set(name, bytes);
  }

  return {
    ok: true,
    content: {
      manifest: {
        format: DATA_EXPORT_FORMAT,
        formatVersion: manifest.formatVersion,
        appVersion: typeof manifest.appVersion === 'string' ? manifest.appVersion : '',
        distribution: toDistribution(manifest.distribution),
        exportedAt: typeof manifest.exportedAt === 'string' ? manifest.exportedAt : '',
        files: [...files.keys()],
      },
      files,
    },
  };
}

/** アイテム（データファイルの items）とワークスペースのアイテムの数 */
export function countItems(read: (relPath: string) => unknown, relPaths: string[]) {
  const length = (raw: unknown) =>
    isRecord(raw) && Array.isArray(raw.items) ? raw.items.length : 0;
  return {
    items: relPaths
      .filter((p) => p.startsWith('datafiles/'))
      .reduce((sum, p) => sum + length(read(p)), 0),
    workspaceItems: relPaths.includes('workspace.json') ? length(read('workspace.json')) : 0,
  };
}

/** 今の設定フォルダのアイテムとワークスペースのアイテムの数 */
export function countCurrentItems(configFolder: string) {
  return countItems((relPath) => {
    try {
      return parseJson(fs.readFileSync(path.join(configFolder, ...relPath.split('/'))));
    } catch {
      return undefined;
    }
  }, collectExportFiles(configFolder));
}

/** 読み込むファイルのアイテムとワークスペースのアイテムの数 */
export function countImportItems(content: DataImportContent) {
  return countItems((relPath) => {
    const bytes = content.files.get(relPath);
    return bytes ? parseJson(bytes) : undefined;
  }, content.manifest.files);
}

/**
 * 設定フォルダの中身を、読み込むファイルでまるごと置き換える。
 * 書き出しの対象のうち、読み込むファイルに無いもの（例 data3.json）は消す。
 * 呼ぶ前に、今のファイルをスナップショットに残しておくこと。
 *
 * 書いている間にほかの処理が割り込まないよう、すべて同期で行う
 */
export function applyDataImport(configFolder: string, content: DataImportContent): void {
  const toPath = (relPath: string) => path.join(configFolder, ...relPath.split('/'));
  for (const relPath of collectExportFiles(configFolder)) {
    if (!content.files.has(relPath)) fs.rmSync(toPath(relPath), { force: true });
  }
  for (const [relPath, bytes] of content.files) {
    const filePath = toPath(relPath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, bytes);
  }
}

function parseJson(bytes: Uint8Array): unknown {
  try {
    // 手で直して BOM 付きで保存したファイルも読めるようにする
    const text = strFromU8(bytes);
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return undefined;
  }
}

function toDistribution(value: unknown): AppDistribution {
  return value === 'store' || value === 'portable' || value === 'installer' ? value : 'dev';
}
