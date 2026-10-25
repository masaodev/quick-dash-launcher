import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { isValidDataFileName } from '@common/utils/dataFileName';
import { DEFAULT_DATA_FILE, isJsonClipboardItem } from '@common/types';
import type { JsonDataFile, JsonItem, JsonDirOptions, SetItemFields } from '@common/types';
import type { RegisterItem } from '@common/types/register';
import { convertRegisterItemToJsonItem } from '@common/utils/dataConverters';
import { findSetNamesUsingItems } from '@common/utils/setUsage';

import { PathManager } from '../../config/pathManager.js';
import { ClipboardService } from '../clipboardService.js';
import { mainI18n } from '../mainI18n.js';
import { writeDataFile } from '../dataFileTracker.js';

import { clearDataFileCorrupted, markDataFileCorrupted } from './corruptedDataFiles.js';

interface DataFileEntry {
  fileName: string;
  filePath: string;
  jsonData: JsonDataFile;
}

/**
 * ID でアイテムを探すために、すべてのデータファイルを読む
 *
 * 破損ファイルは印を付けて飛ばし、他のファイルは読み続ける（1 つ壊れているだけで全体を止めない）。
 * 飛ばしたファイル名は corrupted に返す
 */
function readDataFilesForSearch(configFolder: string): {
  files: DataFileEntry[];
  corrupted: string[];
} {
  const files: DataFileEntry[] = [];
  const corrupted: string[] = [];
  for (const fileName of PathManager.getDataFiles()) {
    const filePath = path.join(configFolder, fileName);
    const content = FileUtils.safeReadTextFile(filePath);
    if (!content) continue;
    try {
      // 寛容パース: 他の不正アイテムはファイル上に残したまま、対象だけ書き換える
      files.push({ fileName, filePath, jsonData: parseJsonDataFileLenient(content).data });
    } catch (error) {
      // 破損ファイルは上書きしない（喪失を防ぐ）
      dataLogger.error({ error, filePath }, 'JSONファイルのパースに失敗したためスキップします');
      markDataFileCorrupted(fileName);
      corrupted.push(fileName);
    }
  }
  return { files, corrupted };
}

function writeOrThrow(entry: DataFileEntry): void {
  if (!writeDataFile(entry.filePath, serializeJsonDataFile(entry.jsonData))) {
    throw new Error(mainI18n.t('dataErrors.writeFailed', { file: entry.fileName }));
  }
}

/**
 * IDでアイテムを検索し、見つかったファイル上で新しい内容に差し替える
 *
 * @param configFolder - 設定フォルダのパス
 * @param newItem - 差し替え後のアイテム（id で対象を特定する）
 * @throws アイテムが見つからない場合（破損ファイルにあるかもしれないときはその旨）、または書き込みに失敗した場合
 */
export function replaceItemById(configFolder: string, newItem: JsonItem): void {
  const { files, corrupted } = readDataFilesForSearch(configFolder);

  for (const entry of files) {
    const itemIndex = entry.jsonData.items.findIndex((item) => item.id === newItem.id);
    if (itemIndex !== -1) {
      entry.jsonData.items[itemIndex] = newItem;
      writeOrThrow(entry);
      return;
    }
  }

  if (corrupted.length > 0) {
    throw new Error(mainI18n.t('dataErrors.saveBlockedCorrupted', { files: corrupted.join(', ') }));
  }
  throw new Error(mainI18n.t('dataErrors.itemNotFound', { id: newItem.id }));
}

/**
 * ID で全データファイルからアイテムを消す（クリップボードアイテムは実データのファイルも消す）
 *
 * 見つからない ID は無視する。ただし見つからない ID が破損ファイルにあるかもしれないときは、何も書かずに止める
 * （保存先を変える編集は「消してから同じ id で登録し直す」ので、消せていないと id が重複する）
 *
 * @param options.keepClipboardDataRefs - 消さずに残す実データの参照（保存先を変える編集で、登録し直すアイテムが
 *   同じ実データを使い続けるとき。渡さないと、登録し直したアイテムの実データが無くなる）
 * @throws 破損ファイルのせいで消せたか分からない場合、または書き込みに失敗した場合
 */
export async function deleteItemsById(
  configFolder: string,
  ids: string[],
  options: { keepClipboardDataRefs?: readonly string[] } = {}
): Promise<void> {
  const keepDataRefs = new Set(options.keepClipboardDataRefs ?? []);
  const idsToDelete = new Set(ids);
  const { files, corrupted } = readDataFilesForSearch(configFolder);
  const targets = files.filter((entry) =>
    entry.jsonData.items.some((item) => idsToDelete.has(item.id))
  );

  if (corrupted.length > 0) {
    const found = new Set(targets.flatMap((entry) => entry.jsonData.items.map((item) => item.id)));
    if (ids.some((id) => !found.has(id))) {
      throw new Error(
        mainI18n.t('dataErrors.deleteBlockedCorrupted', { files: corrupted.join(', ') })
      );
    }
  }

  const clipboardService = ClipboardService.getInstance();
  for (const entry of targets) {
    for (const item of entry.jsonData.items) {
      if (
        idsToDelete.has(item.id) &&
        isJsonClipboardItem(item) &&
        !keepDataRefs.has(item.dataFileRef)
      ) {
        await clipboardService.deleteClipboardData(item.dataFileRef);
      }
    }
    entry.jsonData = {
      ...entry.jsonData,
      items: entry.jsonData.items.filter((item) => !idsToDelete.has(item.id)),
    };
    writeOrThrow(entry);
  }
}

/**
 * 指定のアイテムを行で指しているセットの名前（すべてのデータファイルから。消す前に知らせるため。A3-79 #6）
 */
export function findSetNamesUsingItemIds(configFolder: string, ids: string[]): string[] {
  const { files } = readDataFilesForSearch(configFolder);
  return findSetNamesUsingItems(
    files.flatMap((entry) => entry.jsonData.items),
    ids
  );
}

/**
 * ID でアイテムのメモだけを書き換える（ワークスペースのコピーを参照に変えるとき、コピーのメモを移す）
 *
 * @param options.onlyIfEmpty 今のメモが空のときだけ書く（ファイルの今の内容で決める）
 * @returns 書いたら true
 * @throws アイテムが見つからない場合、または書き込みに失敗した場合
 */
export function updateItemMemoById(
  configFolder: string,
  id: string,
  memo: string,
  options: { onlyIfEmpty?: boolean } = {}
): boolean {
  const { files, corrupted } = readDataFilesForSearch(configFolder);
  for (const entry of files) {
    const item = entry.jsonData.items.find((i) => i.id === id);
    if (item) {
      if (options.onlyIfEmpty && item.memo?.trim()) return false;
      item.memo = memo || undefined;
      item.updatedAt = Date.now();
      writeOrThrow(entry);
      return true;
    }
  }
  if (corrupted.length > 0) {
    throw new Error(mainI18n.t('dataErrors.saveBlockedCorrupted', { files: corrupted.join(', ') }));
  }
  throw new Error(mainI18n.t('dataErrors.itemNotFound', { id }));
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
