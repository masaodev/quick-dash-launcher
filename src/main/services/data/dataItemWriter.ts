import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';
import { DEFAULT_DATA_FILE } from '@common/types';
import type {
  JsonDataFile,
  JsonItem,
  JsonDirOptions,
  LayoutWindowEntry,
  WindowItemConfig,
} from '@common/types';
import type { RegisterItem } from '@common/types/register';
import {
  stripIconFromLayoutEntries,
  convertRegisterItemToJsonItem,
} from '@common/utils/dataConverters';

import { PathManager } from '../../config/pathManager.js';
import { writeDataFile } from '../dataFileTracker.js';

import { clearDataFileCorrupted, markDataFileCorrupted } from './corruptedDataFiles.js';

/**
 * IDでアイテムを検索し、見つかったファイル上で新しい内容に差し替える
 *
 * @param configFolder - 設定フォルダのパス
 * @param newItem - 差し替え後のアイテム（id で対象を特定する）
 * @throws アイテムが見つからない場合、またはファイル操作エラー
 */
function replaceItemById(configFolder: string, newItem: JsonItem): void {
  const dataFiles = PathManager.getDataFiles();

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const content = FileUtils.safeReadTextFile(filePath);
    if (!content) continue;

    let jsonData;
    try {
      // 寛容パース: 他の不正アイテムはファイル上に残したまま、対象だけ差し替える
      jsonData = parseJsonDataFileLenient(content).data;
    } catch (error) {
      // 破損ファイルはスキップして他ファイルの検索を続行（上書きによる喪失を防ぐ）
      dataLogger.error({ error, filePath }, 'JSONファイルのパースに失敗したためスキップします');
      markDataFileCorrupted(fileName);
      continue;
    }
    const itemIndex = jsonData.items.findIndex((item) => item.id === newItem.id);

    if (itemIndex !== -1) {
      jsonData.items[itemIndex] = newItem;
      writeDataFile(filePath, serializeJsonDataFile(jsonData));
      return;
    }
  }

  throw new Error(`ID ${newItem.id} のアイテムが見つかりません`);
}

/** IDでdirアイテムを更新する */
export function updateDirItemById(
  configFolder: string,
  id: string,
  dirPath: string,
  options?: JsonDirOptions,
  memo?: string
): void {
  replaceItemById(configFolder, {
    id,
    type: 'dir',
    path: dirPath,
    options: options && Object.keys(options).length > 0 ? options : undefined,
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/** IDでgroupアイテムを更新する */
export function updateGroupItemById(
  configFolder: string,
  id: string,
  displayName: string,
  itemNames: string[],
  memo?: string
): void {
  replaceItemById(configFolder, {
    id,
    type: 'group',
    displayName,
    itemNames,
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/** IDでwindowアイテムを更新する */
export function updateWindowItemById(
  configFolder: string,
  id: string,
  config: WindowItemConfig,
  memo?: string
): void {
  replaceItemById(configFolder, {
    id,
    type: 'window',
    displayName: config.displayName,
    windowTitle:
      normalizeWindowTitleForProcessOnly(config.windowTitle, config.processName) ??
      config.windowTitle,
    processName: config.processName,
    x: config.x,
    y: config.y,
    width: config.width,
    height: config.height,
    moveToActiveMonitorCenter: config.moveToActiveMonitorCenter,
    virtualDesktopNumber: config.virtualDesktopNumber,
    activateWindow: config.activateWindow,
    pinToAllDesktops: config.pinToAllDesktops,
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/** IDでlayoutアイテムを更新する */
export function updateLayoutItemById(
  configFolder: string,
  id: string,
  displayName: string,
  entries: LayoutWindowEntry[],
  memo?: string
): void {
  replaceItemById(configFolder, {
    id,
    type: 'layout',
    displayName,
    entries: stripIconFromLayoutEntries(entries),
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/**
 * 複数のアイテムを設定ファイルに登録する（各タブ対応）
 * 単一アイテム、フォルダ取込アイテム、グループアイテムに対応し、targetFile（旧 targetTab）で
 * 指定されたデータファイルに追記する
 *
 * @param configFolder - 設定フォルダのパス
 * @param items - 登録するアイテムの配列
 * @throws ファイル書き込みエラー、破損ファイルへの登録
 *
 * @example
 * registerItems('/path/to/config', [
 *   { name: 'VSCode', type: 'app', path: 'code.exe', targetTab: 'data.json', itemCategory: 'item' },
 *   { name: 'Documents', type: 'folder', path: '/docs', targetTab: 'data2.json', itemCategory: 'dir', dirOptions: {...} },
 *   { name: 'DevTools', type: 'app', path: '', targetTab: 'data.json', itemCategory: 'group', groupItemNames: ['VSCode', 'Chrome'] }
 * ]);
 */
export function registerItems(configFolder: string, items: RegisterItem[]): void {
  // targetFile (または targetTab) ごとにアイテムをグループ化
  const itemsByFile = new Map<string, RegisterItem[]>();

  for (const item of items) {
    const targetFile = item.targetFile || item.targetTab || DEFAULT_DATA_FILE;
    if (!itemsByFile.has(targetFile)) {
      itemsByFile.set(targetFile, []);
    }
    itemsByFile.get(targetFile)!.push(item);
  }

  for (const [targetFile, targetItems] of itemsByFile) {
    registerItemsToJsonFile(path.join(configFolder, targetFile), targetFile, targetItems);
  }
}

/**
 * JSONファイルにアイテムを登録する
 *
 * @param dataPath - データファイルの絶対パス
 * @param fileName - 破損ファイル管理のキーに使うファイル名（PathManager.getDataFiles()と同じ形式）
 * @param items - 登録するアイテム
 */
function registerItemsToJsonFile(dataPath: string, fileName: string, items: RegisterItem[]): void {
  // 既存のJSONデータを読み込む
  let jsonData: JsonDataFile = createEmptyJsonDataFile();
  const existingContent = FileUtils.safeReadTextFile(dataPath);
  if (existingContent) {
    try {
      jsonData = parseJsonDataFileLenient(existingContent).data;
      clearDataFileCorrupted(fileName);
    } catch (error) {
      // 破損ファイルを新規データで上書きすると既存アイテムが復旧不能になるため中止する
      dataLogger.error({ error, dataPath }, 'JSONファイルのパースに失敗したため登録を中止します');
      markDataFileCorrupted(fileName);
      throw new Error(
        `データファイルが破損している可能性があるため登録を中止しました: ${fileName}。` +
          'ファイルを修復（または削除）してから再試行してください'
      );
    }
  }

  for (const item of items) {
    jsonData.items.push(convertRegisterItemToJsonItem(item));
  }

  writeDataFile(dataPath, serializeJsonDataFile(jsonData));
}
