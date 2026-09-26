import * as path from 'path';

import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import {
  parseJsonDataFileLenient,
  serializeJsonDataFile,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import type {
  EditableJsonItem,
  LoadEditableItemsResult,
  SaveEditableItemsResult,
} from '@common/types/editableItem';
import { validateEditableItem, EXTERNAL_CHANGE_CONFLICT_MARKER } from '@common/types/editableItem';
import { isJsonClipboardItem, type JsonDataFile, type JsonItem } from '@common/types';

import { PathManager } from '../../config/pathManager.js';
import { ClipboardService } from '../clipboardService.js';
import {
  detectExternalChange,
  hashContent,
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
        const parsed = parseJsonDataFileLenient(content, { reservedIds: knownIds });
        clearDataFileCorrupted(fileName);
        logParseIssues(fileName, parsed.issues);

        // 採番・補正があれば書き戻す（編集画面の保存が id ベースで動くように）
        if (parsed.modified) {
          content = serializeJsonDataFile(parsed.data);
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
            : validateEditableItem(jsonItem);

          items.push({
            item: jsonItem,
            displayText: safeDisplayText(jsonItem),
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
          error: `JSONファイルのパースに失敗しました: ${fileName}`,
        };
      }
    }

    await snapshotExternalChanges(externallyChanged);

    return { items, fileHashes };
  } catch (error) {
    dataLogger.error({ error }, 'EditableJsonItemの読み込みに失敗しました');
    return {
      items: [],
      error: `読み込みに失敗しました: ${error}`,
    };
  }
}

/**
 * 表示テキストへの変換。不正なアイテム（type 不明など）でも落ちないようにする
 */
function safeDisplayText(jsonItem: JsonItem): string {
  try {
    return jsonItemToDisplayText(jsonItem);
  } catch {
    return JSON.stringify(jsonItem);
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
      `${EXTERNAL_CHANGE_CONFLICT_MARKER} データファイルが QDL の外で変更されています: ${changed.join(', ')}。` +
        '編集内容は保存していません。再読込してからやり直してください'
    );
  }
}

/**
 * 保存前のファイル内容から、保存後に残らないクリップボードアイテムの実データを消す
 *
 * メイン画面の削除（deleteItemsById）と同じ後始末。編集画面は全件を書き戻すので、ここで差分を取る。
 */
async function deleteOrphanedClipboardData(
  previousContents: Map<string, string>,
  remainingIds: Set<string>
): Promise<void> {
  const clipboardService = ClipboardService.getInstance();
  for (const [fileName, content] of previousContents) {
    try {
      const parsed = parseJsonDataFileLenient(content);
      for (const item of parsed.data.items) {
        if (isJsonClipboardItem(item) && !remainingIds.has(item.id)) {
          await clipboardService.deleteClipboardData(item.dataFileRef);
        }
      }
    } catch (error) {
      dataLogger.warn(
        { error, fileName },
        'クリップボード実データの後始末で読み取りに失敗しました'
      );
    }
  }
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
      `データファイルが破損している可能性があるため保存を中止しました: ${corruptedFiles.join(', ')}。` +
        'ファイルを修復（または削除）してから再試行してください'
    );
  }

  const dataFiles = PathManager.getDataFiles();

  if (expectedHashes) {
    assertNoExternalChange(configFolder, dataFiles, expectedHashes);
  }

  // ファイル別にグループ化
  const fileGroups = new Map<string, EditableJsonItem[]>();
  for (const item of editableItems) {
    const sourceFile = item.meta.sourceFile;
    if (!fileGroups.has(sourceFile)) {
      fileGroups.set(sourceFile, []);
    }
    fileGroups.get(sourceFile)!.push(item);
  }

  const fileHashes: Record<string, string> = {};
  const writtenFiles: string[] = [];
  const previousContents = new Map<string, string>();

  // 管理対象のすべてのファイルを確認し、内容が変わるものだけ書く（空になったファイルも含む）
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const items = fileGroups.get(fileName) || [];

    // lineNumberでソート
    const sortedItems = [...items].sort((a, b) => a.meta.lineNumber - b.meta.lineNumber);
    const jsonItems = sortedItems.map((item) => item.item);

    const jsonData: JsonDataFile = { ...createEmptyJsonDataFile(), items: jsonItems };
    const content = serializeJsonDataFile(jsonData);
    const currentContent = FileUtils.safeReadTextFile(filePath);

    if (currentContent !== content) {
      if (!writeDataFile(filePath, content)) {
        throw new Error(`データファイルの書き込みに失敗しました: ${fileName}`);
      }
      writtenFiles.push(fileName);
      if (currentContent !== null) {
        previousContents.set(fileName, currentContent);
      }
    }
    fileHashes[fileName] = hashContent(content);
  }

  if (previousContents.size > 0) {
    const remainingIds = new Set(editableItems.map((item) => item.item.id));
    await deleteOrphanedClipboardData(previousContents, remainingIds);
  }

  dataLogger.info({ writtenFiles }, '編集画面のアイテムを保存しました');
  return { fileHashes, writtenFiles };
}
