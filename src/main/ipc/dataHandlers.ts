import * as path from 'path';

import { ipcMain, BrowserWindow } from 'electron';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { parseCSVLine, escapeCSV } from '@common/utils/csvParser';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';
import { parseWindowConfig, serializeWindowConfig } from '@common/utils/windowConfigUtils';
import { RawDataLine, LauncherItem, GroupItem, WindowOperationItem, AppItem } from '@common/types';
import { isWindowInfo, isWindowOperationItem } from '@common/utils/typeGuards';
import { parseWindowOperationDirective } from '@common/utils/directiveUtils';
import { RegisterItem } from '@common/utils/dataConverters';
import {
  GET_CONFIG_FOLDER,
  GET_DATA_FILES,
  CREATE_DATA_FILE,
  DELETE_DATA_FILE,
  LOAD_DATA_FILES,
  REGISTER_ITEMS,
  IS_DIRECTORY,
  LOAD_RAW_DATA_FILES,
  SAVE_RAW_DATA_FILES,
  EVENT_DATA_CHANGED,
} from '@common/ipcChannels.js';

import { BackupService } from '../services/backupService.js';
import { SettingsService } from '../services/settingsService.js';

import { setupBookmarkHandlers } from './bookmarkHandlers.js';
import { processDirectoryItem, processShortcut } from './directoryScanner.js';

/**
 * CSV行をLauncherItemに変換する
 *
 * @param line - CSV行
 * @param sourceFile - データファイル名
 * @param lineNumber - 行番号（オプション）
 * @returns LauncherItemまたはnull
 */
function parseCSVLineToItem(
  line: string,
  sourceFile: string,
  lineNumber?: number
): LauncherItem | null {
  const parts = parseCSVLine(line);
  if (parts.length < 2) {
    return null;
  }

  const [name, itemPath, argsField, customIconField, windowConfigField] = parts;

  if (!name || !itemPath) {
    return null;
  }

  // 第5フィールドをWindowConfigとしてパース（文字列/JSON両対応）
  const windowConfig =
    windowConfigField && windowConfigField.trim()
      ? parseWindowConfig(windowConfigField)
      : undefined;

  const item: LauncherItem = {
    name,
    path: itemPath,
    type: detectItemTypeSync(itemPath),
    args: argsField && argsField.trim() ? argsField : undefined,
    customIcon: customIconField && customIconField.trim() ? customIconField : undefined,
    windowConfig: windowConfig ?? undefined,
    sourceFile,
    lineNumber: lineNumber,
    isDirExpanded: false,
    isEdited: false,
  };

  return item;
}

/**
 * 設定フォルダからデータファイル（data.txt, data2.txt）を読み込み、AppItem配列に変換する
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
async function loadDataFiles(configFolder: string): Promise<AppItem[]> {
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
    const content = FileUtils.safeReadTextFile(filePath);
    if (content === null) continue;

    const lines = content.split(/\r\n|\n|\r/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('//')) {
        continue;
      }

      // Handle フォルダ取込アイテム
      if (trimmedLine.startsWith('dir,')) {
        const parts = parseCSVLine(trimmedLine);
        const dirPath = parts[1];
        const optionsStr = parts.slice(2).join(',');

        const scannedItems = await processDirectoryItem(
          dirPath,
          optionsStr,
          fileName,
          lineIndex + 1
        );

        // Add scanned items with duplicate check (per tab)
        for (const item of scannedItems) {
          const uniqueKey = item.args
            ? `${item.name}|${item.path}|${item.args}`
            : `${item.name}|${item.path}`;
          if (!seenPaths.has(uniqueKey)) {
            seenPaths.add(uniqueKey);
            items.push(item);
          } else {
            dataLogger.debug(
              { tabIndex, fileName, itemName: item.name, uniqueKey },
              'タブ内で重複するアイテムをスキップ'
            );
          }
        }
        continue;
      }

      // Handle グループアイテム
      if (trimmedLine.startsWith('group,')) {
        const parts = parseCSVLine(trimmedLine.substring(6)); // 'group,'を除去
        if (parts.length >= 2) {
          const groupName = parts[0];
          const itemNames = parts.slice(1).filter((name) => name.trim());

          if (groupName && itemNames.length > 0) {
            const groupItem: GroupItem = {
              name: groupName,
              type: 'group',
              itemNames: itemNames,
              sourceFile: fileName,
              lineNumber: lineIndex + 1,
              isEdited: false,
            };
            items.push(groupItem);
          }
        }
        continue;
      }

      // Handle ウィンドウ操作アイテム
      if (trimmedLine.startsWith('window,')) {
        const windowOp = parseWindowOperationDirective({
          type: 'directive',
          content: trimmedLine,
          lineNumber: lineIndex + 1,
          sourceFile: fileName,
        });

        const windowOperationItem: WindowOperationItem = {
          type: 'windowOperation',
          name: windowOp.name,
          windowTitle: windowOp.windowTitle,
          processName: windowOp.processName,
          x: windowOp.x,
          y: windowOp.y,
          width: windowOp.width,
          height: windowOp.height,
          moveToActiveMonitorCenter: windowOp.moveToActiveMonitorCenter,
          virtualDesktopNumber: windowOp.virtualDesktopNumber,
          activateWindow: windowOp.activateWindow,
          sourceFile: fileName,
          lineNumber: lineIndex + 1,
          isEdited: false,
        };

        // ウィンドウ操作アイテムは重複チェック対象外
        items.push(windowOperationItem);
        continue;
      }

      // Handle .lnk files
      const parts = parseCSVLine(trimmedLine);
      if (parts.length >= 2) {
        const displayName = parts[0];
        const itemPath = parts[1];
        if (itemPath.toLowerCase().endsWith('.lnk') && FileUtils.exists(itemPath)) {
          const item = processShortcut(itemPath, fileName, lineIndex + 1, displayName);
          if (item) {
            const uniqueKey = item.args
              ? `${item.name}|${item.path}|${item.args}`
              : `${item.name}|${item.path}`;
            if (!seenPaths.has(uniqueKey)) {
              seenPaths.add(uniqueKey);
              items.push(item);
            } else {
              dataLogger.debug(
                { tabIndex, fileName, itemName: item.name, uniqueKey },
                'タブ内で重複するアイテムをスキップ'
              );
            }
            continue;
          }
        }
      }

      // Parse normal item
      const item = parseCSVLineToItem(trimmedLine, fileName, lineIndex + 1);
      if (item) {
        const uniqueKey = item.args
          ? `${item.name}|${item.path}|${item.args}`
          : `${item.name}|${item.path}`;
        if (!seenPaths.has(uniqueKey)) {
          seenPaths.add(uniqueKey);
          items.push(item);
        } else {
          dataLogger.debug(
            { tabIndex, fileName, itemName: item.name, uniqueKey },
            'タブ内で重複するアイテムをスキップ'
          );
        }
      }
    }
  }

  // Sort items by name
  items.sort((a, b) => {
    const aName = isWindowInfo(a) ? a.title : isWindowOperationItem(a) ? a.name : a.name;
    const bName = isWindowInfo(b) ? b.title : isWindowOperationItem(b) ? b.name : b.name;
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

// 生データを読み込む（フォルダ取込アイテム展開なし）
async function loadRawDataFiles(configFolder: string): Promise<RawDataLine[]> {
  const rawLines: RawDataLine[] = [];
  // 動的にデータファイルリストを取得
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const content = FileUtils.safeReadTextFile(filePath);
    if (content !== null) {
      // 改行コードを正規化（CRLF、LF、CRのいずれにも対応）
      const lines = content.split(/\r\n|\n|\r/);

      lines.forEach((line, index) => {
        const lineType = detectLineType(line);
        let customIcon: string | undefined = undefined;

        // アイテム行の場合、customIconフィールドを抽出
        // CSVエスケープを正しく処理するためparseCSVLineを使用
        if (lineType === 'item') {
          try {
            const parts = parseCSVLine(line);
            // 4番目のフィールドがcustomIconフィールド
            if (parts.length >= 4 && parts[3]) {
              customIcon = parts[3];
            }
          } catch {
            // エラーが発生した場合はcustomIconをundefinedのまま
          }
        }

        rawLines.push({
          lineNumber: index + 1,
          content: line,
          type: lineType,
          sourceFile: fileName,
          customIcon,
        });
      });
    }
  }

  return rawLines;
}

// 行のタイプを判定
function detectLineType(line: string): RawDataLine['type'] {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return 'empty';
  }

  if (trimmedLine.startsWith('//')) {
    return 'comment';
  }

  if (
    trimmedLine.startsWith('dir,') ||
    trimmedLine.startsWith('group,') ||
    trimmedLine.startsWith('window,')
  ) {
    return 'directive';
  }

  return 'item';
}

// 生データを保存
async function saveRawDataFiles(configFolder: string, rawLines: RawDataLine[]): Promise<void> {
  // 管理対象のファイルリストを取得
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  // ファイル別にグループ化
  const fileGroups = new Map<string, RawDataLine[]>();
  rawLines.forEach((line) => {
    if (!fileGroups.has(line.sourceFile)) {
      fileGroups.set(line.sourceFile, []);
    }
    const group = fileGroups.get(line.sourceFile);
    if (!group) {
      throw new Error(`Failed to get file group for: ${line.sourceFile}`);
    }
    group.push(line);
  });

  // 管理対象のすべてのファイルを保存（空になったファイルも含む）
  for (const fileName of dataFiles) {
    const filePath = path.join(configFolder, fileName);
    const lines = fileGroups.get(fileName) || [];

    // バックアップを作成（設定に基づく）
    if (FileUtils.exists(filePath)) {
      const backupService = await BackupService.getInstance();
      await backupService.createBackup(filePath);
    }

    // 行番号でソートして内容を結合（空の場合は空文字列）
    const sortedLines = lines.sort((a, b) => a.lineNumber - b.lineNumber);
    const content = sortedLines.map((line) => line.content).join('\r\n');

    // ファイルに書き込み
    FileUtils.safeWriteTextFile(filePath, content);
  }
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
 * @param items[].targetTab - 保存先データファイル名（例: 'data.txt', 'data2.txt'）
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
 *   { name: 'VSCode', type: 'app', path: 'code.exe', targetTab: 'data.txt', itemCategory: 'item' },
 *   { name: 'Documents', type: 'folder', path: '/docs', targetTab: 'data2.txt', itemCategory: 'dir', dirOptions: {...} },
 *   { name: 'DevTools', type: 'app', path: '', targetTab: 'data.txt', itemCategory: 'group', groupItemNames: ['VSCode', 'Chrome'] }
 * ]);
 */
async function registerItems(configFolder: string, items: RegisterItem[]): Promise<void> {
  // targetFile (または targetTab) ごとにアイテムをグループ化
  const itemsByTab = new Map<string, RegisterItem[]>();

  for (const item of items) {
    // targetFileが指定されていればそれを使用、なければtargetTabを使用
    const targetFile = item.targetFile || item.targetTab || 'data.txt';
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
    const existingContent = FileUtils.safeReadTextFile(dataPath) || '';

    const newLines = targetItems.map((item) => {
      if (item.itemCategory === 'dir') {
        let dirLine = `dir,${item.path}`;

        // フォルダ取込アイテムオプションを追加
        if (item.dirOptions) {
          const options: string[] = [];

          // depth
          if (item.dirOptions.depth !== 0) {
            options.push(`depth=${item.dirOptions.depth}`);
          }

          // types
          if (item.dirOptions.types !== 'both') {
            options.push(`types=${item.dirOptions.types}`);
          }

          // filter
          if (item.dirOptions.filter) {
            options.push(`filter=${item.dirOptions.filter}`);
          }

          // exclude
          if (item.dirOptions.exclude) {
            options.push(`exclude=${item.dirOptions.exclude}`);
          }

          // prefix
          if (item.dirOptions.prefix) {
            options.push(`prefix=${item.dirOptions.prefix}`);
          }

          // suffix
          if (item.dirOptions.suffix) {
            options.push(`suffix=${item.dirOptions.suffix}`);
          }

          if (options.length > 0) {
            dirLine += ',' + options.join(',');
          }
        }

        return dirLine;
      } else if (item.itemCategory === 'group') {
        // グループアイテムの場合
        let groupLine = `group,${item.name}`;
        if (item.groupItemNames && item.groupItemNames.length > 0) {
          groupLine += ',' + item.groupItemNames.join(',');
        }
        return groupLine;
      } else if (item.itemCategory === 'window') {
        // ウィンドウ操作アイテムの場合：window,{JSON形式の設定}
        const cfg = item.windowOperationConfig;
        if (!cfg) {
          throw new Error('windowOperationConfig is required for window items');
        }

        // JSON形式で設定を保存
        const config: Record<string, string | number | boolean> = {
          name: item.name,
          windowTitle: cfg.windowTitle,
        };

        // オプションフィールドは値がある場合のみ追加
        if (cfg.x !== undefined) config.x = cfg.x;
        if (cfg.y !== undefined) config.y = cfg.y;
        if (cfg.width !== undefined) config.width = cfg.width;
        if (cfg.height !== undefined) config.height = cfg.height;
        if (cfg.virtualDesktopNumber !== undefined)
          config.virtualDesktopNumber = cfg.virtualDesktopNumber;
        if (cfg.activateWindow !== undefined) config.activateWindow = cfg.activateWindow;

        return `window,${escapeCSV(JSON.stringify(config))}`;
      } else {
        let line = `${escapeCSV(item.name)},${escapeCSV(item.path)}`;

        // 引数フィールドを追加
        if (item.args) {
          line += `,${escapeCSV(item.args)}`;
        } else {
          line += ',';
        }

        // カスタムアイコンフィールドを追加
        if (item.customIcon) {
          line += `,${escapeCSV(item.customIcon)}`;
        } else {
          line += ',';
        }

        // ウィンドウ設定フィールドを追加
        const windowConfigStr = serializeWindowConfig(item.windowConfig);
        if (windowConfigStr) {
          line += `,${escapeCSV(windowConfigStr)}`;
        }

        return line;
      }
    });

    const updatedContent = existingContent
      ? existingContent.trim() + '\r\n' + newLines.join('\r\n')
      : newLines.join('\r\n');
    FileUtils.safeWriteTextFile(dataPath, updatedContent.trim());
  }
}

function isDirectory(filePath: string): boolean {
  return FileUtils.isDirectory(filePath);
}

// データ変更を全ウィンドウに通知する関数
export function notifyDataChanged() {
  const allWindows = BrowserWindow.getAllWindows();
  allWindows.forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(EVENT_DATA_CHANGED);
    }
  });
  dataLogger.info({ windowCount: allWindows.length }, 'データ変更通知を送信しました');
}

export function setupDataHandlers(configFolder: string) {
  // ブックマーク関連のハンドラーを登録
  setupBookmarkHandlers();

  ipcMain.handle(GET_CONFIG_FOLDER, () => configFolder);

  ipcMain.handle(GET_DATA_FILES, async () => {
    const { PathManager } = await import('../config/pathManager.js');
    return PathManager.getDataFiles();
  });

  ipcMain.handle(CREATE_DATA_FILE, async (_event, fileName: string) => {
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
        await fs.writeFile(filePath, `// ${fileName}\r\n`, 'utf-8');
        dataLogger.info(`File created successfully: ${filePath}`);
        // notifyDataChanged(); // 設定の再読み込みを防ぐため削除
        return { success: true };
      } catch (error) {
        dataLogger.error({ error, filePath }, 'Failed to create file');
        return { success: false, error: `ファイルの作成に失敗しました: ${error}` };
      }
    }
  });

  ipcMain.handle(DELETE_DATA_FILE, async (_event, fileName: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    // data.txtは削除不可
    if (fileName === 'data.txt') {
      return { success: false, error: 'data.txtは削除できません' };
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

  ipcMain.handle(LOAD_DATA_FILES, async () => {
    return await loadDataFiles(configFolder);
  });

  ipcMain.handle(REGISTER_ITEMS, async (_event, items: RegisterItem[]) => {
    await registerItems(configFolder, items);
    notifyDataChanged();
    return;
  });

  ipcMain.handle(IS_DIRECTORY, async (_event, filePath: string) => {
    return isDirectory(filePath);
  });

  ipcMain.handle(LOAD_RAW_DATA_FILES, async () => {
    return await loadRawDataFiles(configFolder);
  });

  ipcMain.handle(SAVE_RAW_DATA_FILES, async (_event, rawLines: RawDataLine[]) => {
    await saveRawDataFiles(configFolder, rawLines);
    notifyDataChanged();
    return;
  });
}
