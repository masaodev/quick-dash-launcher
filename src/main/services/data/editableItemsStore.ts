import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { safeJsonItemToDisplayText } from '@common/utils/displayTextConverter';
import type {
  EditableJsonItem,
  LoadEditableItemsResult,
  SaveEditableItemsResult,
} from '@common/types/editableItem';
import { validateEditableItem, EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';
import {
  isJsonClipboardItem,
  isJsonLauncherItem,
  type JsonDataFile,
  type JsonLauncherItem,
} from '@common/types';

import { PathManager } from '../../config/pathManager.js';
import { mainI18n } from '../mainI18n.js';
import {
  prefetchFolderProbes,
  refineItemType,
  withFolderMarker,
} from '../../utils/folderPathProbe.js';
import { releaseClipboardData } from '../clipboardDataUsage.js';
import {
  detectExternalChange,
  hashContent,
  prepareDataFileContent,
  readJsonForCompat,
  rememberDataFileContent,
  writeDataFile,
} from '../dataFileTracker.js';

import {
  clearDataFileCorrupted,
  getCorruptedDataFiles,
  markDataFileCorrupted,
} from './corruptedDataFiles.js';
import { logParseIssues, snapshotExternalChanges } from './dataFileLoader.js';

/**
 * 編集画面用に EditableJsonItem 配列を読み込む
 *
 * @param configFolder - 設定フォルダのパス
 * @returns EditableJsonItem配列と、楽観ロック用のファイル内容ハッシュ
 */
export async function loadEditableItems(configFolder: string): Promise<LoadEditableItemsResult> {
  const items: EditableJsonItem[] = [];
  // 楽観ロック用: 読み込んだ時点の内容ハッシュ。保存時に一致しなければ外部で変更されている
  const fileHashes: Record<string, string> = {};

  try {
    const dataFiles = PathManager.getDataFiles();
    const knownIds = new Set<string>();
    const externallyChanged: Array<{ relativePath: string; content: string }> = [];

    for (const fileName of dataFiles) {
      const filePath = path.join(configFolder, fileName);
      let content = FileUtils.safeReadTextFile(filePath);

      if (content === null) {
        dataLogger.warn({ filePath }, 'JSONファイルが読み込めませんでした');
        continue;
      }

      // 編集画面が先に読んで書き戻すと、メイン画面の読込では外部変更を検知できなくなる。
      // ここでも検知して変更前スナップショットを残す
      const previousContent = detectExternalChange(fileName, content);
      if (previousContent !== null) {
        externallyChanged.push({ relativePath: fileName, content: previousContent });
      }
      rememberDataFileContent(fileName, content);

      try {
        const parsed = parseJsonDataFileLenient(content, {
          reservedIds: knownIds,
          t: mainI18n.t,
        });
        clearDataFileCorrupted(fileName);
        logParseIssues(fileName, parsed.issues);

        // 採番・補正があれば書き戻す（編集画面の保存が id ベースで動くように）
        if (parsed.modified) {
          // 知らない項目を付け直した内容でハッシュを取る（楽観ロックがディスクの内容と合うように）
          content = prepareDataFileContent(filePath, serializeJsonDataFile(parsed.data));
          writeDataFile(filePath, content);
        }
        fileHashes[fileName] = hashContent(content);

        const invalidReasons = new Map<number, string>();
        for (const issue of parsed.issues) {
          if (issue.kind === 'invalid') invalidReasons.set(issue.index, issue.reason);
        }

        // 各JsonItemをEditableJsonItemに変換（不正なアイテムも編集画面で直せるよう含める）
        for (let index = 0; index < parsed.data.items.length; index++) {
          const jsonItem = parsed.data.items[index];
          knownIds.add(jsonItem.id);
          const parseError = invalidReasons.get(index);
          const validation = parseError
            ? { isValid: false, error: parseError }
            : validateEditableItem(jsonItem, mainI18n.t);

          items.push({
            item: jsonItem,
            displayText: safeJsonItemToDisplayText(jsonItem),
            meta: {
              sourceFile: fileName,
              lineNumber: index,
              isValid: validation.isValid,
              validationError: validation.error,
            },
          });
        }
      } catch (error) {
        dataLogger.error({ error, fileName }, 'JSONファイルのパースに失敗しました');
        markDataFileCorrupted(fileName);
        return {
          items: [],
          error: mainI18n.t('dataErrors.jsonParseFailed', { file: fileName }),
        };
      }
    }

    await resolveLauncherTypes(items);
    await snapshotExternalChanges(externallyChanged);

    return { items, fileHashes };
  } catch (error) {
    dataLogger.error({ error }, 'EditableJsonItemの読み込みに失敗しました');
    return {
      items: [],
      error: mainI18n.t('dataErrors.loadFailed', { error: String(error) }),
    };
  }
}

/**
 * 楽観ロック: 読み込み時のハッシュと現在のファイル内容を突き合わせる
 *
 * 編集画面は全ファイルをメモリ内容で全量上書きするため、読み込み後に QDL 外で
 * 変更されたファイルがあると、その変更を黙って消してしまう。ここで拒否する。
 *
 * @throws 不一致があれば EXTERNAL_CHANGE_CONFLICT_MARKER 付きのエラー
 */
function assertNoExternalChange(
  configFolder: string,
  dataFiles: string[],
  expectedHashes: Record<string, string>
): void {
  const changed: string[] = [];

  for (const fileName of dataFiles) {
    const content = FileUtils.safeReadTextFile(path.join(configFolder, fileName));
    const currentHash = content === null ? null : hashContent(content);
    const expected = expectedHashes[fileName];

    // 読み込み後に追加されたファイル、または内容が変わったファイル
    if (expected === undefined || currentHash !== expected) {
      changed.push(fileName);
    }
  }

  // 読み込み後に削除されたファイル
  for (const fileName of Object.keys(expectedHashes)) {
    if (!dataFiles.includes(fileName)) {
      changed.push(fileName);
    }
  }

  if (changed.length > 0) {
    dataLogger.warn({ changed }, '外部変更との競合を検知したため編集画面の保存を拒否しました');
    throw new Error(
      `${EXTERNAL_CHANGE_CONFLICT_MARKER} ${mainI18n.t('dataErrors.externalChange', { files: changed.join(', ') })}`
    );
  }
}

/**
 * 保存前のファイル内容にあった実データのうち、保存後にどこからも使われなくなったものを消す
 *
 * メイン画面の削除（deleteItemsById）と同じ後始末。編集画面は全件を書き戻すので、消したアイテムも
 * 本文を書き換えたアイテムも、保存前に指していた実データをまとめて渡し、使われているかを確かめて消す
 */
function releaseReplacedClipboardData(
  configFolder: string,
  previousContents: Map<string, string>
): void {
  const previousRefs: string[] = [];
  for (const [fileName, content] of previousContents) {
    try {
      const parsed = parseJsonDataFileLenient(content);
      for (const item of parsed.data.items) {
        if (isJsonClipboardItem(item)) previousRefs.push(item.dataFileRef);
      }
    } catch (error) {
      dataLogger.warn(
        { error, fileName },
        'クリップボード実データの後始末で読み取りに失敗しました'
      );
    }
  }
  releaseClipboardData(configFolder, previousRefs);
}

/**
 * 起動種別をメイン画面と同じ判定（ドット入りのフォルダ名はディスクで確かめる）で meta に入れる
 *
 * 画面側はパスの文字列しか見られないため、アイコンやフォルダの絵文字がメイン画面と食い違わないようにする
 */
async function resolveLauncherTypes(items: EditableJsonItem[]): Promise<void> {
  const launcherEntries = items.filter((entry) => isJsonLauncherItem(entry.item));
  const pathOf = (entry: EditableJsonItem) => (entry.item as JsonLauncherItem).path;
  await prefetchFolderProbes(launcherEntries.map(pathOf));
  for (const entry of launcherEntries) {
    entry.meta.launcherType = await refineItemType(pathOf(entry));
  }
}

/**
 * パスが変わった（新規を含む）アイテムのうち、ドット入りのフォルダ名に末尾の区切り文字を付ける
 *
 * 一覧の保存では全件が届くので、保存済みのパスと同じものは確かめない
 */
async function markChangedFolderPaths(
  configFolder: string,
  dataFiles: string[],
  editableItems: EditableJsonItem[]
): Promise<EditableJsonItem[]> {
  const savedPaths = new Map<string, string>();
  for (const fileName of dataFiles) {
    const content = FileUtils.safeReadTextFile(path.join(configFolder, fileName));
    if (!content) continue;
    try {
      for (const item of parseJsonDataFileLenient(content).data.items) {
        if (isJsonLauncherItem(item)) savedPaths.set(item.id, item.path);
      }
    } catch {
      // 読めないファイルは比較できないだけなので、すべて変更として扱う
    }
  }

  return Promise.all(
    editableItems.map(async (editableItem) => {
      const jsonItem = editableItem.item;
      if (!isJsonLauncherItem(jsonItem) || savedPaths.get(jsonItem.id) === jsonItem.path) {
        return editableItem;
      }
      const markedPath = await withFolderMarker(jsonItem.path);
      if (markedPath === jsonItem.path) return editableItem;
      return { ...editableItem, item: { ...jsonItem, path: markedPath } };
    })
  );
}

/**
 * 編集画面の EditableJsonItem 配列を保存する
 *
 * 内容が変わったファイルだけを書き換える。保存後の全ファイルのハッシュを返すので、
 * 呼び出し側は次回の保存の expectedHashes に使える。
 *
 * @param configFolder - 設定フォルダのパス
 * @param editableItems - 保存するEditableJsonItem配列
 * @param expectedHashes - 読み込み時のファイル内容ハッシュ（楽観ロック）。省略時は検証しない
 */
export async function saveEditableItems(
  configFolder: string,
  editableItems: EditableJsonItem[],
  expectedHashes?: Record<string, string>
): Promise<SaveEditableItemsResult> {
  // 破損ファイルがあると読み込めなかったアイテムを空データで上書きしてしまうため保存を拒否する
  const corruptedFiles = getCorruptedDataFiles();
  if (corruptedFiles.length > 0) {
    throw new Error(
      mainI18n.t('dataErrors.saveBlockedCorrupted', { files: corruptedFiles.join(', ') })
    );
  }

  const dataFiles = PathManager.getDataFiles();

  if (expectedHashes) {
    assertNoExternalChange(configFolder, dataFiles, expectedHashes);
  }

  const markedItems = await markChangedFolderPaths(configFolder, dataFiles, editableItems);

  // ファイル別にグループ化
  const fileGroups = new Map<string, EditableJsonItem[]>();
  for (const item of markedItems) {
    const sourceFile = item.meta.sourceFile;
    if (!fileGroups.has(sourceFile)) {
      fileGroups.set(sourceFile, []);
    }
    fileGroups.get(sourceFile)!.push(item);
  }

  const fileHashes: Record<string, string> = {};
  const writtenFiles: string[] = [];
  const previousContents = new Map<string, string>();

  // 知らない項目を付け直す元は、書き始める前に全ファイルから読んでおく
  // （ファイルをまたいで移したアイテムを、移す元から先に書いても項目が消えないように）
  const diskContents = new Map(
    dataFiles.map((fileName) => [fileName, readJsonForCompat(path.join(configFolder, fileName))])
  );

  // 管理対象のすべてのファイルを確認し、内容が変わるものだけ書く（空になったファイルも含む）
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const items = fileGroups.get(fileName) || [];

    // lineNumberでソート
    const sortedItems = [...items].sort((a, b) => a.meta.lineNumber - b.meta.lineNumber);
    const jsonItems = sortedItems.map((item) => item.item);

    const jsonData: JsonDataFile = { ...createEmptyJsonDataFile(), items: jsonItems };
    const unknownKeySources = {
      target: diskContents.get(fileName),
      others: dataFiles.filter((f) => f !== fileName).map((f) => diskContents.get(f)),
    };
    const content = prepareDataFileContent(filePath, serializeJsonDataFile(jsonData), {
      unknownKeySources,
    });
    const currentContent = FileUtils.safeReadTextFile(filePath);

    if (currentContent !== content) {
      if (!writeDataFile(filePath, content, { unknownKeySources })) {
        throw new Error(mainI18n.t('dataErrors.writeFailed', { file: fileName }));
      }
      writtenFiles.push(fileName);
      if (currentContent !== null) {
        previousContents.set(fileName, currentContent);
      }
    }
    fileHashes[fileName] = hashContent(content);
  }

  releaseReplacedClipboardData(configFolder, previousContents);

  dataLogger.info({ writtenFiles }, '編集画面のアイテムを保存しました');
  return { fileHashes, writtenFiles };
}
