import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { normalizeWindowTitleForProcessOnly } from '@common/utils/windowTitle';
import { isValidDataFileName } from '@common/utils/dataFileName';
import { DEFAULT_DATA_FILE } from '@common/types';
import type {
  JsonDataFile,
  JsonItem,
  JsonDirOptions,
  SetItemFields,
  WindowItemConfig,
} from '@common/types';
import type { RegisterItem } from '@common/types/register';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';
import { pickWindowPlacement } from '@common/utils/windowPlacement';

import { PathManager } from '../../config/pathManager.js';
import { mainI18n } from '../mainI18n.js';
import { writeDataFile } from '../dataFileTracker.js';

import { clearDataFileCorrupted, markDataFileCorrupted } from './corruptedDataFiles.js';

/**
 * IDでアイテムを検索し、見つかったファイル上で新しい内容に差し替える
 *
 * @param configFolder - 設定フォルダのパス
 * @param newItem - 差し替え後のアイテム（id で対象を特定する）
 * @throws アイテムが見つからない場合、またはファイル操作エラー
 */
export function replaceItemById(configFolder: string, newItem: JsonItem): void {
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

  throw new Error(mainI18n.t('dataErrors.itemNotFound', { id: newItem.id }));
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
    ...pickWindowPlacement(config),
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/** IDでsetアイテムを更新する */
export function updateSetItemById(
  configFolder: string,
  id: string,
  set: SetItemFields,
  memo?: string
): void {
  replaceItemById(configFolder, {
    id,
    type: 'set',
    displayName: set.displayName,
    entries: set.entries.map((entry) => ({ ...entry })),
    ...(set.launchMode ? { launchMode: set.launchMode } : {}),
    ...(set.customIcon ? { customIcon: set.customIcon } : {}),
    memo: memo || undefined,
    updatedAt: Date.now(),
  });
}

/**
 * 複数のアイテムを設定ファイルに登録する（各タブ対応）
 * 単一アイテム、フォルダ取込アイテム、セットなどに対応し、targetFile（旧 targetTab）で
 * 指定されたデータファイルに追記する
 *
 * @param configFolder - 設定フォルダのパス
 * @param items - 登録するアイテムの配列
 * @throws ファイル書き込みエラー、破損ファイルへの登録、datafiles 直下の .json 以外への登録（何も書かない）
 *
 * @example
 * registerItems('/path/to/config', [
 *   { name: 'VSCode', type: 'app', path: 'code.exe', targetTab: 'datafiles/data.json', itemCategory: 'item' },
 *   { name: 'Documents', type: 'folder', path: '/docs', targetTab: 'datafiles/data2.json', itemCategory: 'dir', dirOptions: {...} },
 *   { name: 'DevTools', type: 'app', path: '', targetTab: 'datafiles/data.json', itemCategory: 'set', setEntries: [{ itemId: 'Ab12Cd34' }] }
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

  // 画面から受け取った名前なので、書き込む前にすべて確かめる（datafiles フォルダの外に書かせない）
  const invalidFiles = [...itemsByFile.keys()].filter((fileName) => !isValidDataFileName(fileName));
  if (invalidFiles.length > 0) {
    throw new Error(mainI18n.t('dataErrors.invalidTargetFile', { files: invalidFiles.join(', ') }));
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
  appendToJsonFile(
    dataPath,
    fileName,
    items.map((item) => convertRegisterItemToJsonItem(item, item.keepId))
  );
}

function appendToJsonFile(dataPath: string, fileName: string, items: JsonItem[]): void {
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
      throw new Error(mainI18n.t('dataErrors.addBlockedCorrupted', { file: fileName }));
    }
  }

  jsonData.items.push(...items);
  writeDataFile(dataPath, serializeJsonDataFile(jsonData));
}

/**
 * アイテムを id を保ったまま別のデータファイルへ移す（CLI の移動。内容も newItem に差し替える）
 *
 * 移す先に書いてから元のファイルから消す。元を消す前に失敗しても、2 つのファイルに残るだけで消えない。
 * id で全ファイルから消す deleteItemsById は使わない（移した先まで消え、クリップボードの実データも消す）
 *
 * @throws ファイル名が正しくない、どちらかのファイルが破損している、元のファイルに無い、書き込みに失敗した場合
 */
export function moveItemToFile(
  configFolder: string,
  newItem: JsonItem,
  sourceFile: string,
  targetFile: string
): void {
  for (const fileName of [sourceFile, targetFile]) {
    if (!isValidDataFileName(fileName)) {
      throw new Error(mainI18n.t('dataErrors.invalidTargetFile', { files: fileName }));
    }
  }
  const sourcePath = path.join(configFolder, sourceFile);
  const targetPath = path.join(configFolder, targetFile);
  // どちらかが壊れていたら何も書かない（先に両方を読む）
  const source = readForMove(sourcePath, sourceFile);
  const target = readForMove(targetPath, targetFile);
  const index = source.items.findIndex((item) => item.id === newItem.id);
  if (index === -1) throw new Error(mainI18n.t('dataErrors.itemNotFound', { id: newItem.id }));

  target.items.push(newItem);
  if (!writeDataFile(targetPath, serializeJsonDataFile(target))) {
    throw new Error(mainI18n.t('dataErrors.writeFailed', { file: targetFile }));
  }
  source.items.splice(index, 1);
  if (!writeDataFile(sourcePath, serializeJsonDataFile(source))) {
    throw new Error(mainI18n.t('dataErrors.writeFailed', { file: sourceFile }));
  }
}

function readForMove(dataPath: string, fileName: string): JsonDataFile {
  const content = FileUtils.safeReadTextFile(dataPath);
  if (!content) return createEmptyJsonDataFile();
  try {
    return parseJsonDataFileLenient(content).data;
  } catch (error) {
    dataLogger.error({ error, dataPath }, 'JSONファイルのパースに失敗したため移動を中止します');
    markDataFileCorrupted(fileName);
    throw new Error(mainI18n.t('dataErrors.moveBlockedCorrupted', { file: fileName }));
  }
}

/**
 * id まで決めた JsonItem をデータファイルの末尾に足す（CLI の追加。足した id を呼び出し側が知っている）
 *
 * @throws データファイル名が正しくない、またはファイルが破損している場合
 */
export function appendJsonItems(configFolder: string, fileName: string, items: JsonItem[]): void {
  if (!isValidDataFileName(fileName)) {
    throw new Error(mainI18n.t('dataErrors.invalidTargetFile', { files: fileName }));
  }
  appendToJsonFile(path.join(configFolder, fileName), fileName, items);
}
