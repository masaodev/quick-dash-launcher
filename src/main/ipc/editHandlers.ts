import * as fs from 'fs';
import * as path from 'path';

import { editLogger } from '@common/logger';
import { LauncherItem, JsonItem, JsonLauncherItem, RawDataLine } from '@common/types';
import { escapeCSV } from '@common/utils/csvParser';
import { serializeWindowConfig } from '@common/utils/windowConfigUtils';
import { parseJsonDataFile, serializeJsonDataFile } from '@common/utils/jsonParser';
import { convertRawDataLineToJsonItem } from '@common/utils/jsonToRawDataConverter';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { createSafeIpcHandler } from '../utils/ipcWrapper';
import { BackupService } from '../services/backupService.js';

import { notifyDataChanged } from './dataHandlers.js';

interface UpdateItemRequest {
  sourceFile: string;
  lineNumber: number;
  newItem: LauncherItem;
}

interface DeleteItemRequest {
  sourceFile: string;
  lineNumber: number;
}

async function createBackup(configFolder: string, fileName: string): Promise<void> {
  const filePath = path.join(configFolder, fileName);
  const backupService = await BackupService.getInstance();
  await backupService.createBackup(filePath);
}

/**
 * CSVファイルを行単位で安全に読み書きするヘルパークラス
 *
 * このクラスは、data.txtなどのCSVファイルに対する編集操作を統一的に処理します。
 * ファイルの読み込み、行単位の編集、書き込みという共通パターンを抽象化し、
 * 重複コードを削減して保守性を向上させます。
 *
 * @example
 * // 特定行を更新
 * await CsvFileEditor.editWithBackup(configFolder, 'data.txt', (lines) => {
 *   lines[0] = 'new content';
 *   return lines;
 * });
 *
 * @example
 * // 複数行を削除
 * await CsvFileEditor.editWithBackup(configFolder, 'data.txt', (lines) => {
 *   return lines.filter((_, index) => index !== 5);
 * });
 */
class CsvFileEditor {
  /**
   * ファイルを読み込み、行配列として返す
   *
   * 改行コードはCRLF、LF、CRのいずれにも対応しています。
   * ファイルが存在しない場合はエラーをスローします。
   *
   * @param filePath - 読み込むファイルのパス（絶対パス推奨）
   * @returns 行配列（各行は改行コードを含まない文字列）
   * @throws {Error} ファイルが存在しない場合
   *
   * @example
   * const lines = CsvFileEditor.readLines('/path/to/data.txt');
   * console.log(lines[0]); // 最初の行
   */
  static readLines(filePath: string): string[] {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split(/\r\n|\n|\r/);
  }

  /**
   * 行配列をファイルに書き込む
   *
   * 行と行の間にはCRLF (`\r\n`) が挿入されます。
   * Windows環境との互換性を保つため、常にCRLFを使用します。
   *
   * @param filePath - 書き込むファイルのパス（絶対パス推奨）
   * @param lines - 書き込む行配列（各要素に改行コードを含めないこと）
   *
   * @example
   * const lines = ['line1', 'line2', 'line3'];
   * CsvFileEditor.writeLines('/path/to/data.txt', lines);
   */
  static writeLines(filePath: string, lines: string[]): void {
    fs.writeFileSync(filePath, lines.join('\r\n'), 'utf8');
  }

  /**
   * バックアップを作成してから、行を編集する処理を実行
   *
   * このメソッドは以下の処理を順番に実行します：
   * 1. BackupServiceを使用してファイルのバックアップを作成
   * 2. ファイルを行配列として読み込み
   * 3. 渡された編集関数で行配列を変更
   * 4. 編集後の行配列をファイルに書き戻し
   *
   * エラーが発生した場合でも、バックアップは保持されるため、
   * 手動でのリカバリーが可能です。
   *
   * @param configFolder - 設定フォルダのパス（例: PathManager.getConfigFolder()）
   * @param fileName - ファイル名（例: 'data.txt', 'archive.txt'）
   * @param editFunc - 行配列を受け取り、編集後の行配列を返す関数
   *                   この関数内でlineNumberのバリデーションやフィルタリングを実行
   * @returns Promise<void>
   *
   * @example
   * // 特定行の内容を置き換え
   * await CsvFileEditor.editWithBackup(configFolder, 'data.txt', (lines) => {
   *   if (lineNumber < 1 || lineNumber > lines.length) {
   *     throw new Error('Invalid line number');
   *   }
   *   lines[lineNumber - 1] = newContent;
   *   return lines;
   * });
   *
   * @example
   * // 複数行を一括削除（降順でインデックスを処理）
   * await CsvFileEditor.editWithBackup(configFolder, 'data.txt', (lines) => {
   *   const sortedIndexes = [10, 5, 2]; // 降順にソート済み
   *   sortedIndexes.forEach(index => lines.splice(index, 1));
   *   return lines;
   * });
   */
  static async editWithBackup(
    configFolder: string,
    fileName: string,
    editFunc: (lines: string[]) => string[]
  ): Promise<void> {
    const filePath = path.join(configFolder, fileName);

    // バックアップ作成（失敗時は例外がスローされる）
    await createBackup(configFolder, fileName);

    // 行読み込み（ファイルが存在しない場合は例外）
    const lines = this.readLines(filePath);

    // 編集処理実行（editFunc内で例外が発生する可能性あり）
    const newLines = editFunc(lines);

    // 書き込み
    this.writeLines(filePath, newLines);
  }
}

function formatItemToCSV(item: LauncherItem): string {
  const args = item.args || '';
  const customIcon = item.customIcon || '';
  const windowConfigStr = item.windowConfig ? serializeWindowConfig(item.windowConfig) : '';

  // 基本フィールド：名前,パス
  let csvLine = `${escapeCSV(item.displayName)},${escapeCSV(item.path)}`;

  // 引数フィールド
  csvLine += `,${escapeCSV(args)}`;

  // カスタムアイコンフィールド
  if (customIcon || windowConfigStr) {
    csvLine += `,${escapeCSV(customIcon)}`;
  }

  // ウィンドウ設定フィールド
  if (windowConfigStr) {
    csvLine += `,${escapeCSV(windowConfigStr)}`;
  }

  return csvLine;
}

/**
 * LauncherItemをJsonLauncherItemに変換する
 */
function convertLauncherItemToJsonItem(item: LauncherItem, existingId: string): JsonLauncherItem {
  const jsonItem: JsonLauncherItem = {
    id: existingId,
    type: 'item',
    displayName: item.displayName,
    path: item.path,
  };

  if (item.args) {
    jsonItem.args = item.args;
  }
  if (item.customIcon) {
    jsonItem.customIcon = item.customIcon;
  }
  if (item.windowConfig) {
    jsonItem.windowConfig = item.windowConfig;
  }

  return jsonItem;
}

/**
 * JSONファイルのアイテムを更新する
 */
class JsonFileEditor {
  static readAndParse(filePath: string) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return parseJsonDataFile(content);
  }

  static write(filePath: string, data: ReturnType<typeof parseJsonDataFile>) {
    const content = serializeJsonDataFile(data);
    fs.writeFileSync(filePath, content, 'utf8');
  }

  static async editWithBackup(
    configFolder: string,
    fileName: string,
    editFunc: (items: JsonItem[]) => JsonItem[]
  ): Promise<void> {
    const filePath = path.join(configFolder, fileName);

    // バックアップ作成
    await createBackup(configFolder, fileName);

    // JSONファイル読み込み
    const jsonData = this.readAndParse(filePath);

    // 編集処理実行
    const newItems = editFunc(jsonData.items);

    // 書き込み
    this.write(filePath, { ...jsonData, items: newItems });
  }
}

/**
 * 指定されたアイテムを更新する
 *
 * JSONファイル(.json)とCSVファイル(.txt)で処理を分岐します。
 * JSONファイルの場合はインデックス（lineNumber - 1）でアイテムを特定し更新します。
 * CSVファイルの場合は従来どおり行ベースで更新します。
 */
export async function updateItem(configFolder: string, request: UpdateItemRequest): Promise<void> {
  const { sourceFile, lineNumber, newItem } = request;

  // JSONファイルの場合
  if (sourceFile.endsWith('.json')) {
    await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
      const itemIndex = lineNumber - 1; // 1-indexed → 0-indexed
      if (itemIndex < 0 || itemIndex >= items.length) {
        throw new Error(`Invalid item index: ${itemIndex}`);
      }

      // 既存アイテムのIDを保持して更新
      const existingItem = items[itemIndex];
      const updatedItem = convertLauncherItemToJsonItem(newItem, existingItem.id);

      // アイテムを置き換え
      const newItems = [...items];
      newItems[itemIndex] = updatedItem;
      return newItems;
    });
    return;
  }

  // CSVファイル（.txt）の場合は従来のロジック
  await CsvFileEditor.editWithBackup(configFolder, sourceFile, (lines) => {
    // 行番号のバリデーション（1-indexed）
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }
    // 指定行をCSV形式に変換して置き換え
    lines[lineNumber - 1] = formatItemToCSV(newItem);
    return lines;
  });
}

/**
 * 指定された行を生のテキストで更新する
 *
 * formatItemToCSVを通さず、渡されたテキストをそのまま書き込みます。
 * コメント行やディレクティブ行の編集に使用されます。
 *
 * JSONファイル(.json)の場合はCSV形式のコンテンツをJsonItemに変換して保存します。
 */
export async function updateRawLine(
  configFolder: string,
  request: { sourceFile: string; lineNumber: number; newContent: string }
): Promise<void> {
  const { sourceFile, lineNumber, newContent } = request;

  // JSONファイルの場合
  if (sourceFile.endsWith('.json')) {
    await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
      const itemIndex = lineNumber - 1; // 1-indexed → 0-indexed
      if (itemIndex < 0 || itemIndex >= items.length) {
        throw new Error(`Invalid item index: ${itemIndex}`);
      }

      // 既存アイテムのIDを保持
      const existingId = items[itemIndex].id;

      // CSVコンテンツからRawDataLineを作成し、JsonItemに変換
      const trimmedContent = newContent.trim();
      let lineType: RawDataLine['type'] = 'item';
      if (
        trimmedContent.startsWith('dir,') ||
        trimmedContent.startsWith('group,') ||
        trimmedContent.startsWith('window,')
      ) {
        lineType = 'directive';
      }

      const rawLine: RawDataLine = {
        lineNumber,
        content: newContent,
        type: lineType,
        sourceFile,
        jsonItemId: existingId, // 既存IDを保持
      };

      const updatedItem = convertRawDataLineToJsonItem(rawLine);

      // アイテムを置き換え
      const newItems = [...items];
      newItems[itemIndex] = updatedItem;
      return newItems;
    });
    return;
  }

  // CSVファイル（.txt）の場合は従来のロジック
  await CsvFileEditor.editWithBackup(configFolder, sourceFile, (lines) => {
    // 行番号のバリデーション（1-indexed）
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Invalid line number: ${lineNumber}`);
    }
    // 生のコンテンツをそのまま設定
    lines[lineNumber - 1] = newContent;
    return lines;
  });
}

/**
 * 複数のアイテムを削除する
 *
 * 複数ファイルにまたがる削除リクエストを効率的に処理します。
 * ファイルごとにグループ化し、各ファイルに対して1回のバックアップと書き込みで完了します。
 *
 * 重要: 削除時はインデックスがシフトするため、降順でソートしてから削除します。
 */
export async function deleteItems(
  configFolder: string,
  requests: DeleteItemRequest[]
): Promise<void> {
  // リクエストをファイルごとにグループ化
  const fileGroups = new Map<string, DeleteItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
  });

  // 各ファイルを個別に処理
  for (const [sourceFile, fileRequests] of fileGroups) {
    try {
      // JSONファイルの場合
      if (sourceFile.endsWith('.json')) {
        await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
          // インデックスシフトを避けるため、行番号を降順にソート
          const sortedRequests = fileRequests.sort((a, b) => b.lineNumber - a.lineNumber);

          const newItems = [...items];
          // アイテムを削除（後ろから削除することで、前のインデックスに影響しない）
          for (const request of sortedRequests) {
            const itemIndex = request.lineNumber - 1;
            if (itemIndex >= 0 && itemIndex < newItems.length) {
              newItems.splice(itemIndex, 1);
            }
          }
          return newItems;
        });
        continue;
      }

      // CSVファイル（.txt）の場合
      await CsvFileEditor.editWithBackup(configFolder, sourceFile, (lines) => {
        // インデックスシフトを避けるため、行番号を降順にソート
        const sortedRequests = fileRequests.sort((a, b) => b.lineNumber - a.lineNumber);

        // 行を削除（後ろから削除することで、前の行のインデックスに影響しない）
        for (const request of sortedRequests) {
          if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
            lines.splice(request.lineNumber - 1, 1);
          }
        }
        return lines;
      });
    } catch (error) {
      // ファイルが存在しない場合はスキップして続行
      editLogger.warn({ sourceFile, error }, 'ファイルが存在しません、スキップします');
    }
  }
}

/**
 * 複数のアイテムを一括更新する
 *
 * ドラッグ&ドロップによる並び替えなど、複数アイテムを同時に更新する際に使用します。
 * ファイルごとにグループ化し、各ファイルに対して1回のバックアップと書き込みで完了します。
 *
 * パフォーマンス: 100個のアイテムを更新する場合でも、同じファイル内であれば
 * 1回のファイル読み書きで完了するため、効率的です。
 */
export async function batchUpdateItems(
  configFolder: string,
  requests: UpdateItemRequest[]
): Promise<void> {
  // リクエストをファイルごとにグループ化
  const fileGroups = new Map<string, UpdateItemRequest[]>();
  requests.forEach((request) => {
    if (!fileGroups.has(request.sourceFile)) {
      fileGroups.set(request.sourceFile, []);
    }
    const group = fileGroups.get(request.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${request.sourceFile}`);
    }
    group.push(request);
  });

  // 各ファイルを個別に処理
  for (const [sourceFile, fileRequests] of fileGroups) {
    try {
      // JSONファイルの場合
      if (sourceFile.endsWith('.json')) {
        await JsonFileEditor.editWithBackup(configFolder, sourceFile, (items) => {
          const newItems = [...items];
          // ファイル内のすべての更新を適用
          for (const request of fileRequests) {
            const itemIndex = request.lineNumber - 1;
            if (itemIndex >= 0 && itemIndex < newItems.length) {
              const existingItem = newItems[itemIndex];
              newItems[itemIndex] = convertLauncherItemToJsonItem(request.newItem, existingItem.id);
            }
          }
          return newItems;
        });
        continue;
      }

      // CSVファイル（.txt）の場合
      await CsvFileEditor.editWithBackup(configFolder, sourceFile, (lines) => {
        // ファイル内のすべての更新を適用
        for (const request of fileRequests) {
          if (request.lineNumber >= 1 && request.lineNumber <= lines.length) {
            lines[request.lineNumber - 1] = formatItemToCSV(request.newItem);
          }
        }
        return lines;
      });
    } catch (error) {
      // ファイルが存在しない場合はスキップして続行
      editLogger.warn({ sourceFile, error }, 'ファイルが存在しません、スキップします');
    }
  }
}

// Register IPC handlers
export function registerEditHandlers(configFolder: string): void {
  createSafeIpcHandler(
    IPC_CHANNELS.UPDATE_ITEM,
    async (request: UpdateItemRequest) => {
      await updateItem(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの更新'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.UPDATE_RAW_LINE,
    async (request: { sourceFile: string; lineNumber: number; newContent: string }) => {
      await updateRawLine(configFolder, request);
      notifyDataChanged();
      return { success: true };
    },
    '生データ行の更新'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.DELETE_ITEMS,
    async (requests: DeleteItemRequest[]) => {
      await deleteItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの削除'
  );

  createSafeIpcHandler(
    IPC_CHANNELS.BATCH_UPDATE_ITEMS,
    async (requests: UpdateItemRequest[]) => {
      await batchUpdateItems(configFolder, requests);
      notifyDataChanged();
      return { success: true };
    },
    'アイテムの一括更新'
  );
}
