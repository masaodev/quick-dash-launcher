import * as path from 'path';

import { ipcMain, BrowserWindow } from 'electron';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import {
  parseJsonDataFile,
  serializeJsonDataFile,
  generateId,
  createEmptyJsonDataFile,
} from '@common/utils/jsonParser';
import { jsonItemToDisplayText } from '@common/utils/displayTextConverter';
import type { EditableJsonItem, LoadEditableItemsResult } from '@common/types/editableItem';
import { validateEditableItem } from '@common/types/editableItem';
import {
  LauncherItem,
  AppItem,
  isJsonLauncherItem,
  isJsonDirItem,
  isJsonGroupItem,
  isJsonWindowItem,
  isJsonClipboardItem,
} from '@common/types';
import type { JsonItem, JsonDirOptions, JsonWindowItem, JsonClipboardItem } from '@common/types';
import type { RegisterItem } from '@common/types/register';
import { isWindowInfo } from '@common/types/guards';
import { IPC_CHANNELS } from '@common/ipcChannels';

import { BackupService } from '../services/backupService.js';
import { SettingsService } from '../services/settingsService.js';

import { setupBookmarkHandlers } from './bookmarkHandlers.js';
import { processDirectoryItem, processShortcut } from './directoryScanner.js';

/**
 * JSONファイルからAppItem配列を読み込む
 *
 * @param filePath - JSONファイルのパス
 * @param fileName - ファイル名（sourceFile用）
 * @param seenPaths - 重複チェック用のSet
 * @param tabIndex - タブインデックス（ログ用）
 * @returns AppItem配列
 */
async function loadJsonDataFile(
  filePath: string,
  fileName: string,
  seenPaths: Set<string>,
  tabIndex: number
): Promise<AppItem[]> {
  const items: AppItem[] = [];
  const content = FileUtils.safeReadTextFile(filePath);

  if (content === null) {
    dataLogger.warn({ filePath }, 'JSONファイルが読み込めませんでした');
    return items;
  }

  let jsonData;
  try {
    jsonData = parseJsonDataFile(content);
  } catch (error) {
    dataLogger.error({ error, filePath }, 'JSONファイルのパースに失敗しました');
    return items;
  }

  for (let i = 0; i < jsonData.items.length; i++) {
    const jsonItem = jsonData.items[i];

    try {
      const appItems = await convertJsonItemToAppItems(jsonItem, fileName, i, seenPaths, tabIndex);
      items.push(...appItems);
    } catch (error) {
      dataLogger.error(
        { error, fileName, itemIndex: i, itemId: jsonItem.id },
        'JSONアイテムの変換に失敗しました'
      );
    }
  }

  return items;
}

/**
 * JsonItemをAppItem（複数の場合あり）に変換
 */
async function convertJsonItemToAppItems(
  jsonItem: JsonItem,
  sourceFile: string,
  itemIndex: number,
  seenPaths: Set<string>,
  tabIndex: number
): Promise<AppItem[]> {
  const items: AppItem[] = [];
  const lineNumber = itemIndex + 1;

  /**
   * 重複チェックを行い、重複でなければアイテムを追加する
   */
  function addIfUnique(item: LauncherItem): boolean {
    const uniqueKey = item.args
      ? `${item.displayName}|${item.path}|${item.args}`
      : `${item.displayName}|${item.path}`;

    if (seenPaths.has(uniqueKey)) {
      dataLogger.debug(
        { tabIndex, sourceFile, itemName: item.displayName, uniqueKey },
        'タブ内で重複するアイテムをスキップ'
      );
      return false;
    }

    seenPaths.add(uniqueKey);
    items.push(item);
    return true;
  }

  if (isJsonLauncherItem(jsonItem)) {
    // .lnkファイルの場合は特別処理
    if (jsonItem.path.toLowerCase().endsWith('.lnk') && FileUtils.exists(jsonItem.path)) {
      const lnkItem = processShortcut(jsonItem.path, sourceFile, lineNumber, jsonItem.displayName);
      if (lnkItem) {
        addIfUnique(lnkItem);
        return items;
      }
    }

    const item: LauncherItem = {
      displayName: jsonItem.displayName,
      path: jsonItem.path,
      type: detectItemTypeSync(jsonItem.path),
      args: jsonItem.args,
      customIcon: jsonItem.customIcon,
      windowConfig: jsonItem.windowConfig,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isDirExpanded: false,
      isEdited: false,
      memo: jsonItem.memo,
    };
    addIfUnique(item);
  } else if (isJsonDirItem(jsonItem)) {
    const scannedItems = await processDirectoryItem(
      jsonItem.path,
      jsonItem.options,
      sourceFile,
      lineNumber,
      jsonItem.id
    );

    for (const scannedItem of scannedItems) {
      addIfUnique(scannedItem);
    }
  } else if (isJsonGroupItem(jsonItem)) {
    items.push({
      displayName: jsonItem.displayName,
      type: 'group',
      itemNames: jsonItem.itemNames,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  } else if (isJsonWindowItem(jsonItem)) {
    items.push({
      type: 'window',
      displayName: jsonItem.displayName,
      windowTitle: jsonItem.windowTitle,
      processName: jsonItem.processName,
      x: jsonItem.x,
      y: jsonItem.y,
      width: jsonItem.width,
      height: jsonItem.height,
      moveToActiveMonitorCenter: jsonItem.moveToActiveMonitorCenter,
      virtualDesktopNumber: jsonItem.virtualDesktopNumber,
      activateWindow: jsonItem.activateWindow,
      pinToAllDesktops: jsonItem.pinToAllDesktops,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  } else if (isJsonClipboardItem(jsonItem)) {
    items.push({
      type: 'clipboard',
      displayName: jsonItem.displayName,
      clipboardDataRef: jsonItem.dataFileRef,
      savedAt: jsonItem.savedAt,
      preview: jsonItem.preview,
      formats: jsonItem.formats,
      customIcon: jsonItem.customIcon,
      sourceFile,
      lineNumber,
      id: jsonItem.id,
      isEdited: false,
      memo: jsonItem.memo,
    });
  }

  return items;
}

/**
 * 設定フォルダからデータファイル（data.json等）を読み込み、AppItem配列に変換する
 * フォルダ取込アイテムの展開、.lnkファイルの解析、CSV行のパース、重複チェック、ソートを全て実行する
 *
 * @param configFolder - 設定フォルダのパス
 * @returns AppItem配列（LauncherItemとGroupItemの両方を含む）
 * @throws ファイル読み込みエラー、フォルダ取込アイテム処理エラー
 *
 * @example
 * const items = await loadDataFiles('/path/to/config');
 * // [{ name: 'Google', path: 'https://google.com', type: 'url', ... }, ...]
 */
export async function loadDataFiles(configFolder: string): Promise<AppItem[]> {
  const items: AppItem[] = [];

  // タブ設定を読み込んで、データファイル → tabIndex のマップを作成
  let fileToTabMap: Map<string, number>;
  try {
    const settingsService = await SettingsService.getInstance();
    const dataFileTabs = await settingsService.get('dataFileTabs');

    // データファイル → tabIndex のマップを作成
    fileToTabMap = new Map<string, number>();
    dataFileTabs.forEach((tab, index) => {
      tab.files.forEach((fileName) => {
        fileToTabMap.set(fileName, index);
      });
    });

    dataLogger.info(
      { tabCount: dataFileTabs.length, mappedFiles: Array.from(fileToTabMap.keys()) },
      'タブ設定を読み込みました'
    );
  } catch (error) {
    dataLogger.warn({ error }, 'タブ設定の読み込みに失敗。全ファイルを独立したタブとして扱います');
    fileToTabMap = new Map<string, number>();
  }

  // タブ別の重複チェック用Set
  const seenPathsByTab = new Map<number, Set<string>>();

  // 動的にデータファイルリストを取得
  const { PathManager } = await import('../config/pathManager.js');
  const autoDetectedFiles = PathManager.getDataFiles();

  // dataFileTabsで明示的に指定されたファイルを収集
  const explicitFiles = Array.from(fileToTabMap.keys());

  // 両方を結合して重複を排除
  const allFiles = Array.from(new Set([...explicitFiles, ...autoDetectedFiles]));

  for (const fileName of allFiles) {
    // 現在のファイルが属するタブインデックスを取得
    const tabIndex = fileToTabMap.get(fileName) ?? -1; // タブに属さない場合は-1

    // このタブ用のSetを初期化
    if (!seenPathsByTab.has(tabIndex)) {
      seenPathsByTab.set(tabIndex, new Set<string>());
    }
    const seenPaths = seenPathsByTab.get(tabIndex);
    if (!seenPaths) {
      throw new Error(`Failed to get seenPaths for tab index: ${tabIndex}`);
    }

    const filePath = path.join(configFolder, fileName);

    // JSON形式のデータファイルを読み込み
    const jsonItems = await loadJsonDataFile(filePath, fileName, seenPaths, tabIndex);
    items.push(...jsonItems);
  }

  // displayNameでソート
  items.sort((a, b) => {
    const aName = isWindowInfo(a) ? a.title : a.displayName;
    const bName = isWindowInfo(b) ? b.title : b.displayName;
    return aName.localeCompare(bName, 'ja');
  });

  // 統計情報をログ出力
  const itemCountByTab = new Map<number, number>();
  items.forEach((item) => {
    const sourceFile = isWindowInfo(item) ? undefined : item.sourceFile;
    const tabIndex = fileToTabMap.get(sourceFile || '') ?? -1;
    itemCountByTab.set(tabIndex, (itemCountByTab.get(tabIndex) || 0) + 1);
  });
  dataLogger.info(
    { totalItems: items.length, itemCountByTab: Object.fromEntries(itemCountByTab) },
    'データ読み込み完了（タブ別統計）'
  );

  return items;
}

/**
 * EditableJsonItem配列を読み込む（新しいAPI）
 *
 * @param configFolder - 設定フォルダのパス
 * @returns EditableJsonItem配列
 */
async function loadEditableItems(configFolder: string): Promise<LoadEditableItemsResult> {
  const items: EditableJsonItem[] = [];

  try {
    // 動的にデータファイルリストを取得
    const { PathManager } = await import('../config/pathManager.js');
    const dataFiles = PathManager.getDataFiles();

    for (const fileName of dataFiles) {
      const filePath = path.join(configFolder, fileName);
      const content = FileUtils.safeReadTextFile(filePath);

      if (content === null) {
        dataLogger.warn({ filePath }, 'JSONファイルが読み込めませんでした');
        continue;
      }

      try {
        const jsonData = parseJsonDataFile(content);

        // 各JsonItemをEditableJsonItemに変換
        jsonData.items.forEach((jsonItem, index) => {
          const displayText = jsonItemToDisplayText(jsonItem);
          const validation = validateEditableItem(jsonItem);

          const editableItem: EditableJsonItem = {
            item: jsonItem,
            displayText,
            meta: {
              sourceFile: fileName,
              lineNumber: index,
              isValid: validation.isValid,
              validationError: validation.error,
            },
          };

          items.push(editableItem);
        });
      } catch (error) {
        dataLogger.error({ error, fileName }, 'JSONファイルのパースに失敗しました');
        return {
          items: [],
          error: `JSONファイルのパースに失敗しました: ${fileName}`,
        };
      }
    }

    return { items };
  } catch (error) {
    dataLogger.error({ error }, 'EditableJsonItemの読み込みに失敗しました');
    return {
      items: [],
      error: `読み込みに失敗しました: ${error}`,
    };
  }
}

/**
 * EditableJsonItem配列を保存する（新しいAPI）
 *
 * @param configFolder - 設定フォルダのパス
 * @param editableItems - 保存するEditableJsonItem配列
 */
async function saveEditableItems(
  configFolder: string,
  editableItems: EditableJsonItem[]
): Promise<void> {
  // 管理対象のファイルリストを取得
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  // ファイル別にグループ化
  const fileGroups = new Map<string, EditableJsonItem[]>();
  editableItems.forEach((item) => {
    const sourceFile = item.meta.sourceFile;
    if (!fileGroups.has(sourceFile)) {
      fileGroups.set(sourceFile, []);
    }
    const group = fileGroups.get(sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${sourceFile}`);
    }
    group.push(item);
  });

  // 管理対象のすべてのファイルを保存（空になったファイルも含む）
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const items = fileGroups.get(fileName) || [];

    // バックアップを作成（設定に基づく）
    if (FileUtils.exists(filePath)) {
      const backupService = await BackupService.getInstance();
      await backupService.createBackup(filePath);
    }

    // lineNumberでソート
    const sortedItems = items.sort((a, b) => a.meta.lineNumber - b.meta.lineNumber);

    // JsonItem配列を抽出
    const jsonItems = sortedItems.map((item) => item.item);

    // JSON形式で保存
    const jsonData = { version: '1.0', items: jsonItems };
    const content = serializeJsonDataFile(jsonData);
    FileUtils.safeWriteTextFile(filePath, content);
  }
}

/**
 * IDでアイテムを検索し、バックアップ作成後に更新コールバックを実行する共通処理
 *
 * @param configFolder - 設定フォルダのパス
 * @param id - 更新対象のアイテムID
 * @param createNewItem - 新しいアイテムを生成するコールバック
 * @throws アイテムが見つからない場合、またはファイル操作エラー
 */
async function updateItemByIdWithCallback(
  configFolder: string,
  id: string,
  createNewItem: (id: string) => JsonItem
): Promise<void> {
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const content = FileUtils.safeReadTextFile(filePath);
    if (!content) continue;

    const jsonData = parseJsonDataFile(content);
    const itemIndex = jsonData.items.findIndex((item) => item.id === id);

    if (itemIndex !== -1) {
      const backupService = await BackupService.getInstance();
      await backupService.createBackup(filePath);

      jsonData.items[itemIndex] = createNewItem(id);

      const newContent = serializeJsonDataFile(jsonData);
      FileUtils.safeWriteTextFile(filePath, newContent);
      return;
    }
  }

  throw new Error(`ID ${id} のアイテムが見つかりません`);
}

/**
 * IDでdirアイテムを更新する
 */
async function updateDirItemById(
  configFolder: string,
  id: string,
  dirPath: string,
  options?: JsonDirOptions,
  memo?: string
): Promise<void> {
  await updateItemByIdWithCallback(configFolder, id, (itemId) => ({
    id: itemId,
    type: 'dir',
    path: dirPath,
    options: options && Object.keys(options).length > 0 ? options : undefined,
    memo: memo || undefined,
    updatedAt: Date.now(),
  }));
}

/**
 * IDでgroupアイテムを更新する
 */
async function updateGroupItemById(
  configFolder: string,
  id: string,
  displayName: string,
  itemNames: string[],
  memo?: string
): Promise<void> {
  await updateItemByIdWithCallback(configFolder, id, (itemId) => ({
    id: itemId,
    type: 'group',
    displayName,
    itemNames,
    memo: memo || undefined,
    updatedAt: Date.now(),
  }));
}

/**
 * IDでwindowアイテムを更新する
 */
async function updateWindowItemById(
  configFolder: string,
  id: string,
  config: {
    displayName: string;
    windowTitle: string;
    processName?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    moveToActiveMonitorCenter?: boolean;
    virtualDesktopNumber?: number;
    activateWindow?: boolean;
    pinToAllDesktops?: boolean;
  },
  memo?: string
): Promise<void> {
  await updateItemByIdWithCallback(configFolder, id, (itemId) => {
    const newItem: JsonWindowItem = {
      id: itemId,
      type: 'window',
      displayName: config.displayName,
      windowTitle: config.windowTitle,
      updatedAt: Date.now(),
    };

    if (config.processName !== undefined) newItem.processName = config.processName;
    if (config.x !== undefined) newItem.x = config.x;
    if (config.y !== undefined) newItem.y = config.y;
    if (config.width !== undefined) newItem.width = config.width;
    if (config.height !== undefined) newItem.height = config.height;
    if (config.moveToActiveMonitorCenter !== undefined)
      newItem.moveToActiveMonitorCenter = config.moveToActiveMonitorCenter;
    if (config.virtualDesktopNumber !== undefined)
      newItem.virtualDesktopNumber = config.virtualDesktopNumber;
    if (config.activateWindow !== undefined) newItem.activateWindow = config.activateWindow;
    if (config.pinToAllDesktops !== undefined) newItem.pinToAllDesktops = config.pinToAllDesktops;
    if (memo !== undefined) newItem.memo = memo;

    return newItem;
  });
}

/**
 * 複数のアイテムを設定ファイルに登録する（各タブ対応）
 * 単一アイテム、フォルダ取込アイテム、グループアイテムに対応し、targetTabで指定されたデータファイルに追記する
 *
 * @param configFolder - 設定フォルダのパス
 * @param items - 登録するアイテムの配列
 * @param items[].name - アイテム名
 * @param items[].type - アイテムタイプ（'file', 'app', 'url', 'folder', 'customUri'）
 * @param items[].path - アイテムのパスまたはURL
 * @param items[].targetTab - 保存先データファイル名（例: 'data.json', 'data2.json'）
 * @param items[].args - コマンドライン引数（オプション）
 * @param items[].customIcon - カスタムアイコンファイル名（オプション）
 * @param items[].itemCategory - アイテムカテゴリ（'item' | 'dir' | 'group'）
 * @param items[].dirOptions - フォルダ取込アイテムオプション（フォルダ取込アイテムの場合）
 * @param items[].groupItemNames - グループ内のアイテム名リスト（グループアイテムの場合）
 * @returns 処理完了のPromise
 * @throws ファイル書き込みエラー、フォルダ取込オプション処理エラー
 *
 * @example
 * await registerItems('/path/to/config', [
 *   { name: 'VSCode', type: 'app', path: 'code.exe', targetTab: 'data.json', itemCategory: 'item' },
 *   { name: 'Documents', type: 'folder', path: '/docs', targetTab: 'data2.json', itemCategory: 'dir', dirOptions: {...} },
 *   { name: 'DevTools', type: 'app', path: '', targetTab: 'data.json', itemCategory: 'group', groupItemNames: ['VSCode', 'Chrome'] }
 * ]);
 */
async function registerItems(configFolder: string, items: RegisterItem[]): Promise<void> {
  // targetFile (または targetTab) ごとにアイテムをグループ化
  const itemsByTab = new Map<string, RegisterItem[]>();

  for (const item of items) {
    // targetFileが指定されていればそれを使用、なければtargetTabを使用
    const targetFile = item.targetFile || item.targetTab || 'data.json';
    if (!itemsByTab.has(targetFile)) {
      itemsByTab.set(targetFile, []);
    }
    const group = itemsByTab.get(targetFile);
    if (!group) {
      throw new Error(`Failed to get items group for: ${targetFile}`);
    }
    group.push(item);
  }

  // 各ファイルに書き込み
  for (const [targetFile, targetItems] of itemsByTab) {
    const dataPath = path.join(configFolder, targetFile);

    // JSON形式で保存
    await registerItemsToJsonFile(dataPath, targetItems);
  }
}

/**
 * JSONファイルにアイテムを登録する
 */
async function registerItemsToJsonFile(dataPath: string, items: RegisterItem[]): Promise<void> {
  // 既存のJSONデータを読み込む
  let jsonData = { version: '1.0', items: [] as JsonItem[] };
  const existingContent = FileUtils.safeReadTextFile(dataPath);
  if (existingContent) {
    try {
      jsonData = parseJsonDataFile(existingContent);
    } catch {
      // パースエラーの場合は新規作成
      dataLogger.warn({ dataPath }, 'JSONファイルのパースに失敗、新規作成します');
    }
  }

  // 新しいアイテムをJsonItem形式に変換して追加
  for (const item of items) {
    const jsonItem = convertRegisterItemToJsonItem(item);
    jsonData.items.push(jsonItem);
  }

  // JSONファイルに書き込み
  const content = serializeJsonDataFile(jsonData);
  FileUtils.safeWriteTextFile(dataPath, content);
}

/**
 * RegisterItemをJsonItemに変換する
 */
function convertRegisterItemToJsonItem(item: RegisterItem): JsonItem {
  const id = generateId();
  const now = Date.now();

  if (item.itemCategory === 'dir') {
    const options: JsonDirOptions = {};
    if (item.dirOptions) {
      if (item.dirOptions.depth !== undefined && item.dirOptions.depth !== 0) {
        options.depth = item.dirOptions.depth;
      }
      if (item.dirOptions.types && item.dirOptions.types !== 'both') {
        options.types = item.dirOptions.types;
      }
      if (item.dirOptions.filter) options.filter = item.dirOptions.filter;
      if (item.dirOptions.exclude) options.exclude = item.dirOptions.exclude;
      if (item.dirOptions.prefix) options.prefix = item.dirOptions.prefix;
      if (item.dirOptions.suffix) options.suffix = item.dirOptions.suffix;
    }

    return {
      id,
      type: 'dir',
      path: item.path,
      options: Object.keys(options).length > 0 ? options : undefined,
      updatedAt: now,
    };
  }

  if (item.itemCategory === 'group') {
    const groupItem: JsonItem = {
      id,
      type: 'group',
      displayName: item.displayName,
      itemNames: item.groupItemNames || [],
      updatedAt: now,
    };
    if (item.memo) groupItem.memo = item.memo;
    return groupItem;
  }

  if (item.itemCategory === 'window') {
    const cfg = item.windowOperationConfig;
    if (!cfg) {
      throw new Error('windowOperationConfig is required for window items');
    }

    const windowItem: JsonItem = {
      id,
      type: 'window',
      displayName: item.displayName,
      windowTitle: cfg.windowTitle,
      updatedAt: now,
    };

    if (cfg.processName !== undefined) windowItem.processName = cfg.processName;
    if (cfg.x !== undefined) windowItem.x = cfg.x;
    if (cfg.y !== undefined) windowItem.y = cfg.y;
    if (cfg.width !== undefined) windowItem.width = cfg.width;
    if (cfg.height !== undefined) windowItem.height = cfg.height;
    if (cfg.moveToActiveMonitorCenter !== undefined)
      windowItem.moveToActiveMonitorCenter = cfg.moveToActiveMonitorCenter;
    if (cfg.virtualDesktopNumber !== undefined)
      windowItem.virtualDesktopNumber = cfg.virtualDesktopNumber;
    if (cfg.activateWindow !== undefined) windowItem.activateWindow = cfg.activateWindow;
    if (cfg.pinToAllDesktops !== undefined) windowItem.pinToAllDesktops = cfg.pinToAllDesktops;
    if (item.memo) windowItem.memo = item.memo;

    return windowItem;
  }

  if (item.itemCategory === 'clipboard') {
    if (!item.clipboardDataRef) {
      throw new Error('clipboardDataRef is required for clipboard items');
    }

    const clipboardItem: JsonClipboardItem = {
      id,
      type: 'clipboard',
      displayName: item.displayName,
      dataFileRef: item.clipboardDataRef,
      savedAt: item.clipboardSavedAt || now,
      formats: item.clipboardFormats || [],
      preview: item.clipboardPreview,
      updatedAt: now,
    };

    if (item.customIcon) clipboardItem.customIcon = item.customIcon;
    if (item.memo) clipboardItem.memo = item.memo;

    return clipboardItem;
  }

  // 通常アイテム
  const launcherItem: JsonItem = {
    id,
    type: 'item',
    displayName: item.displayName,
    path: item.path,
    updatedAt: now,
  };

  if (item.args) launcherItem.args = item.args;
  if (item.customIcon) launcherItem.customIcon = item.customIcon;
  if (item.windowConfig) launcherItem.windowConfig = item.windowConfig;
  if (item.memo) launcherItem.memo = item.memo;

  return launcherItem;
}

// データ変更を全ウィンドウに通知する関数
export function notifyDataChanged() {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.EVENT_DATA_CHANGED);
    }
  });
  dataLogger.info({ windowCount: allWindows.length }, 'データ変更通知を送信しました');
}

export function setupDataHandlers(configFolder: string) {
  // ブックマーク関連のハンドラーを登録
  setupBookmarkHandlers();

  ipcMain.handle(IPC_CHANNELS.GET_CONFIG_FOLDER, () => configFolder);

  ipcMain.handle(IPC_CHANNELS.GET_DATA_FILES, async () => {
    const { PathManager } = await import('../config/pathManager.js');
    return PathManager.getDataFiles();
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_DATA_FILE, async (_event, fileName: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const filePath = path.join(configFolder, fileName);

    dataLogger.info(`create-data-file called: ${fileName} at ${filePath}`);

    // ファイルが既に存在する場合はエラー
    try {
      await fs.access(filePath);
      dataLogger.warn(`File already exists: ${filePath}`);
      return { success: false, error: 'ファイルは既に存在します' };
    } catch {
      // ファイルが存在しない場合は作成
      try {
        const emptyData = serializeJsonDataFile(createEmptyJsonDataFile());
        await fs.writeFile(filePath, emptyData, 'utf-8');
        dataLogger.info(`File created successfully: ${filePath}`);
        // notifyDataChanged(); // 設定の再読み込みを防ぐため削除
        return { success: true };
      } catch (error) {
        dataLogger.error({ error, filePath }, 'Failed to create file');
        return { success: false, error: `ファイルの作成に失敗しました: ${error}` };
      }
    }
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_DATA_FILE, async (_event, fileName: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    // data.jsonは削除不可（メインデータファイル）
    if (fileName === 'data.json') {
      return { success: false, error: 'メインデータファイルは削除できません' };
    }

    const filePath = path.join(configFolder, fileName);

    try {
      // 削除前にバックアップを作成（設定に基づく）
      const backupService = await BackupService.getInstance();
      await backupService.createBackup(filePath);

      await fs.unlink(filePath);
      // notifyDataChanged(); // 設定の再読み込みを防ぐため削除
      return { success: true };
    } catch (error) {
      return { success: false, error: `ファイルの削除に失敗しました: ${error}` };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LOAD_DATA_FILES, async () => {
    return await loadDataFiles(configFolder);
  });

  ipcMain.handle(IPC_CHANNELS.REGISTER_ITEMS, async (_event, items: RegisterItem[]) => {
    await registerItems(configFolder, items);
    notifyDataChanged();
    return;
  });

  ipcMain.handle(IPC_CHANNELS.IS_DIRECTORY, async (_event, filePath: string) => {
    return FileUtils.isDirectory(filePath);
  });

  // EditableJsonItem API
  ipcMain.handle(IPC_CHANNELS.LOAD_EDITABLE_ITEMS, async () => {
    return await loadEditableItems(configFolder);
  });

  ipcMain.handle(
    IPC_CHANNELS.SAVE_EDITABLE_ITEMS,
    async (_event, editableItems: EditableJsonItem[]) => {
      await saveEditableItems(configFolder, editableItems);
      notifyDataChanged();
      return;
    }
  );

  // IDベースのアイテム更新
  ipcMain.handle(
    IPC_CHANNELS.UPDATE_DIR_ITEM_BY_ID,
    async (_event, id: string, dirPath: string, options?: JsonDirOptions, memo?: string) => {
      await updateDirItemById(configFolder, id, dirPath, options, memo);
      notifyDataChanged();
      return;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_GROUP_ITEM_BY_ID,
    async (_event, id: string, displayName: string, itemNames: string[], memo?: string) => {
      await updateGroupItemById(configFolder, id, displayName, itemNames, memo);
      notifyDataChanged();
      return;
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.UPDATE_WINDOW_ITEM_BY_ID,
    async (
      _event,
      id: string,
      config: {
        displayName: string;
        windowTitle: string;
        processName?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        moveToActiveMonitorCenter?: boolean;
        virtualDesktopNumber?: number;
        activateWindow?: boolean;
        pinToAllDesktops?: boolean;
      },
      memo?: string
    ) => {
      await updateWindowItemById(configFolder, id, config, memo);
      notifyDataChanged();
      return;
    }
  );
}
