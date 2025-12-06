import * as path from 'path';
import * as fs from 'fs';

import { ipcMain, shell, dialog, BrowserWindow } from 'electron';
import { minimatch } from 'minimatch';
import { dataLogger } from '@common/logger';
import { FileUtils } from '@common/utils/fileUtils';
import { parseCSVLine } from '@common/utils/csvParser';
import { parseDirOptionsFromString, type DirOptions } from '@common/utils/dataConverters';
import { detectItemTypeSync } from '@common/utils/itemTypeDetector';

import {
  RawDataLine,
  SimpleBookmarkItem,
  LauncherItem,
  GroupItem,
  AppItem,
  BrowserInfo,
  BrowserProfile,
} from '../../common/types';
import { BackupService } from '../services/backupService.js';
import { SettingsService } from '../services/settingsService.js';

/**
 * DirOptionsを人間が読める形式の文字列に変換する
 *
 * @param options - DirOptionsオブジェクト
 * @returns 人間が読める形式の文字列（例：「深さ:2, タイプ:file, フィルター:*.pdf」）
 */
function formatDirOptions(options: DirOptions): string {
  const parts: string[] = [];

  // 深さ
  if (options.depth === -1) {
    parts.push('深さ:無制限');
  } else {
    parts.push(`深さ:${options.depth}`);
  }

  // タイプ
  const typeLabels: Record<typeof options.types, string> = {
    file: 'ファイルのみ',
    folder: 'フォルダのみ',
    both: 'ファイルとフォルダ',
  };
  parts.push(`タイプ:${typeLabels[options.types]}`);

  // フィルター
  if (options.filter) {
    parts.push(`フィルター:${options.filter}`);
  }

  // 除外
  if (options.exclude) {
    parts.push(`除外:${options.exclude}`);
  }

  // プレフィックス
  if (options.prefix) {
    parts.push(`接頭辞:${options.prefix}`);
  }

  // サフィックス
  if (options.suffix) {
    parts.push(`接尾辞:${options.suffix}`);
  }

  return parts.join(', ');
}

/**
 * ファイル/フォルダーをLauncherItemに変換する
 *
 * @param itemPath - アイテムのパス
 * @param itemType - アイテムタイプ（'file' | 'folder'）
 * @param sourceFile - ソースファイル名
 * @param lineNumber - 行番号（オプション）
 * @param prefix - 表示名に追加するプレフィックス（オプション）
 * @param suffix - 表示名に追加するサフィックス（オプション）
 * @param expandedFrom - フォルダ取込の元となるディレクトリパス（オプション）
 * @param expandedOptions - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @returns LauncherItemオブジェクト
 */
function processItem(
  itemPath: string,
  itemType: 'file' | 'folder',
  sourceFile: string,
  lineNumber?: number,
  prefix?: string,
  suffix?: string,
  expandedFrom?: string,
  expandedOptions?: string
): LauncherItem {
  let displayName = path.basename(itemPath);

  // プレフィックスが指定されている場合は追加
  if (prefix) {
    displayName = `${prefix}: ${displayName}`;
  }

  // サフィックスが指定されている場合は追加
  if (suffix) {
    displayName = `${displayName} (${suffix})`;
  }

  return {
    name: displayName,
    path: itemPath,
    type: itemType === 'folder' ? 'folder' : detectItemTypeSync(itemPath),
    sourceFile,
    lineNumber,
    isDirExpanded: expandedFrom ? true : false,
    expandedFrom,
    expandedOptions,
    isEdited: false,
  };
}

/**
 * ショートカットファイル（.lnk）を解析してLauncherItemに変換する
 * Electronのネイティブ機能を使用してショートカットの詳細を読み取り、
 * LauncherItemオブジェクトを生成する
 *
 * @param filePath - 解析対象のショートカットファイルのパス
 * @param sourceFile - ソースファイル名
 * @param lineNumber - 行番号（オプション）
 * @param displayName - 表示名（オプション、未指定の場合はファイル名から自動生成）
 * @param prefix - 表示名に追加するプレフィックス（オプション）
 * @param suffix - 表示名に追加するサフィックス（オプション）
 * @param expandedFrom - フォルダ取込の元となるディレクトリパス（オプション）
 * @param expandedOptions - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @returns LauncherItemオブジェクト。解析に失敗した場合はnull
 * @throws Error ショートカットファイルの読み込みに失敗した場合（ログに記録され、nullを返す）
 *
 * @example
 * ```typescript
 * const item = processShortcut('C:\\Users\\Desktop\\MyApp.lnk', 'data.txt', 10, 'マイアプリ', 'デスクトップ');
 * // { name: 'デスクトップ: マイアプリ', path: 'C:\\Program Files\\MyApp\\app.exe', type: 'app', ... }
 * ```
 */
function processShortcut(
  filePath: string,
  sourceFile: string,
  lineNumber?: number,
  displayName?: string,
  prefix?: string,
  suffix?: string,
  expandedFrom?: string,
  expandedOptions?: string
): LauncherItem | null {
  try {
    // Electron のネイティブ機能を使用してショートカットを読み取り
    const shortcutDetails = shell.readShortcutLink(filePath);

    if (shortcutDetails && shortcutDetails.target) {
      // 表示名が指定されていない場合はファイル名から自動生成
      let name = displayName || path.basename(filePath, '.lnk');

      // プレフィックスが指定されている場合は追加
      if (prefix) {
        name = `${prefix}: ${name}`;
      }

      // サフィックスが指定されている場合は追加
      if (suffix) {
        name = `${name} (${suffix})`;
      }

      // ターゲットパスの存在確認とディレクトリ判定
      let targetType: LauncherItem['type'];
      if (
        FileUtils.exists(shortcutDetails.target) &&
        FileUtils.isDirectory(shortcutDetails.target)
      ) {
        targetType = 'folder';
      } else {
        targetType = detectItemTypeSync(shortcutDetails.target);
      }

      return {
        name: name,
        path: filePath,
        type: targetType,
        args:
          shortcutDetails.args && shortcutDetails.args.trim() ? shortcutDetails.args : undefined,
        originalPath: shortcutDetails.target,
        sourceFile,
        lineNumber,
        isDirExpanded: expandedFrom ? true : false,
        expandedFrom,
        expandedOptions,
        isEdited: false,
      };
    }
  } catch (error) {
    dataLogger.error('ショートカットの読み込みに失敗', { filePath, error });
  }

  return null;
}

/**
 * 指定されたディレクトリを再帰的にスキャンし、指定されたオプションに基づいてファイル/フォルダを抽出する
 * フォルダ取込アイテムで使用される主要な機能で、深度制限、タイプフィルター、パターンマッチングに対応
 *
 * @param dirPath - スキャン対象のディレクトリパス
 * @param options - スキャンオプション（深度、タイプ、フィルター等）
 * @param sourceFile - ソースファイル名
 * @param rootDirPath - フォルダ取込の元となるルートディレクトリパス（オプション）
 * @param optionsText - フォルダ取込オプション情報（人間が読める形式、オプション）
 * @param lineNumber - データファイル内の行番号（オプション）
 * @param currentDepth - 現在の再帰深度（内部使用、初期値は0）
 * @returns LauncherItem配列
 * @throws ディレクトリアクセス権限エラー、ファイルシステムエラー
 *
 * @example
 * const items = await scanDirectory('/home/user/documents', {
 *   depth: 2,
 *   types: 'file',
 *   filter: '*.pdf',
 *   prefix: 'Doc: '
 * }, 'data.txt', '/home/user/documents', '深さ:2, タイプ:ファイルのみ', 15);
 */
async function scanDirectory(
  dirPath: string,
  options: DirOptions,
  sourceFile: string,
  rootDirPath?: string,
  optionsText?: string,
  lineNumber?: number,
  currentDepth = 0
): Promise<LauncherItem[]> {
  const results: LauncherItem[] = [];

  // 深さ制限チェック
  if (options.depth !== -1 && currentDepth > options.depth) {
    return results;
  }

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);

      // エラーハンドリング: アクセスできないファイル/フォルダーをスキップ
      let stat;
      try {
        stat = fs.statSync(itemPath);
      } catch (error) {
        dataLogger.warn('アイテムにアクセスできません', { itemPath, error });
        continue;
      }

      const isDirectory = stat.isDirectory();
      const itemName = path.basename(itemPath);

      // 除外パターンチェック
      if (options.exclude && minimatch(itemName, options.exclude)) {
        continue;
      }

      // フィルターパターンチェック
      if (options.filter && !minimatch(itemName, options.filter)) {
        // サブディレクトリの場合は、中身をスキャンする可能性があるのでスキップしない
        if (!isDirectory) {
          continue;
        }
      }

      // タイプによる処理
      if (isDirectory) {
        // フォルダーを結果に含める
        if (options.types === 'folder' || options.types === 'both') {
          // フィルターがない、またはフィルターにマッチする場合のみ追加
          if (!options.filter || minimatch(itemName, options.filter)) {
            results.push(
              processItem(
                itemPath,
                'folder',
                sourceFile,
                lineNumber,
                options.prefix,
                options.suffix,
                rootDirPath,
                optionsText
              )
            );
          }
        }

        // サブディレクトリをスキャン
        if (currentDepth < options.depth || options.depth === -1) {
          const subResults = await scanDirectory(
            itemPath,
            options,
            sourceFile,
            rootDirPath,
            optionsText,
            lineNumber,
            currentDepth + 1
          );
          results.push(...subResults);
        }
      } else {
        // ファイルを結果に含める
        if (options.types === 'file' || options.types === 'both') {
          // .lnkファイルの場合は特別処理
          if (path.extname(itemPath).toLowerCase() === '.lnk') {
            const processedShortcut = processShortcut(
              itemPath,
              sourceFile,
              lineNumber,
              undefined,
              options.prefix,
              options.suffix,
              rootDirPath,
              optionsText
            );
            if (processedShortcut) {
              results.push(processedShortcut);
            }
          } else {
            results.push(
              processItem(
                itemPath,
                'file',
                sourceFile,
                lineNumber,
                options.prefix,
                options.suffix,
                rootDirPath,
                optionsText
              )
            );
          }
        }
      }
    }
  } catch (error) {
    dataLogger.error('ディレクトリのスキャンに失敗', { dirPath, error });
  }

  return results;
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

  // タブ設定を読み込んで、sourceFile → tabIndex のマップを作成
  let fileToTabMap: Map<string, number>;
  try {
    const settingsService = await SettingsService.getInstance();
    const dataFileTabs = await settingsService.get('dataFileTabs');

    // sourceFile → tabIndex のマップを作成
    fileToTabMap = new Map<string, number>();
    dataFileTabs.forEach((tab, index) => {
      tab.files.forEach((fileName) => {
        fileToTabMap.set(fileName, index);
      });
    });

    dataLogger.info('タブ設定を読み込みました', {
      tabCount: dataFileTabs.length,
      mappedFiles: Array.from(fileToTabMap.keys()),
    });
  } catch (error) {
    dataLogger.warn('タブ設定の読み込みに失敗。全ファイルを独立したタブとして扱います', { error });
    fileToTabMap = new Map<string, number>();
  }

  // タブ別の重複チェック用Set
  const seenPathsByTab = new Map<number, Set<string>>();

  // 動的にデータファイルリストを取得
  const { PathManager } = await import('../config/pathManager.js');
  const dataFiles = PathManager.getDataFiles();

  for (const fileName of dataFiles) {
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
        const parts = trimmedLine
          .substring(4)
          .split(',')
          .map((s) => s.trim());
        const dirPath = parts[0];

        if (FileUtils.exists(dirPath) && FileUtils.isDirectory(dirPath)) {
          try {
            const optionsStr = parts.slice(1).join(',');
            const options = parseDirOptionsFromString(optionsStr);
            const optionsText = formatDirOptions(options);
            const scannedItems = await scanDirectory(
              dirPath,
              options,
              fileName,
              dirPath,
              optionsText,
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
                dataLogger.debug('タブ内で重複するアイテムをスキップ', {
                  tabIndex,
                  fileName,
                  itemName: item.name,
                  uniqueKey,
                });
              }
            }
          } catch (error) {
            dataLogger.error('ディレクトリのスキャンに失敗', { dirPath, error });
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
              dataLogger.debug('タブ内で重複するアイテムをスキップ', {
                tabIndex,
                fileName,
                itemName: item.name,
                uniqueKey,
              });
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
          dataLogger.debug('タブ内で重複するアイテムをスキップ', {
            tabIndex,
            fileName,
            itemName: item.name,
            uniqueKey,
          });
        }
      }
    }
  }

  // Sort items by name
  items.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  // 統計情報をログ出力
  const itemCountByTab = new Map<number, number>();
  items.forEach((item) => {
    const tabIndex = fileToTabMap.get(item.sourceFile || '') ?? -1;
    itemCountByTab.set(tabIndex, (itemCountByTab.get(tabIndex) || 0) + 1);
  });
  dataLogger.info('データ読み込み完了（タブ別統計）', {
    totalItems: items.length,
    itemCountByTab: Object.fromEntries(itemCountByTab),
  });

  return items;
}

/**
 * CSV行をLauncherItemに変換する
 *
 * @param line - CSV行
 * @param sourceFile - ソースファイル名
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

  const [name, itemPath, argsField, customIconField] = parts;

  if (!name || !itemPath) {
    return null;
  }

  const item: LauncherItem = {
    name,
    path: itemPath,
    type: detectItemTypeSync(itemPath),
    args: argsField && argsField.trim() ? argsField : undefined,
    customIcon: customIconField && customIconField.trim() ? customIconField : undefined,
    sourceFile,
    lineNumber: lineNumber,
    isDirExpanded: false,
    isEdited: false,
  };

  return item;
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
        if (lineType === 'item') {
          try {
            const parts = line.split(',');
            // 4番目のフィールドがcustomIconフィールド
            if (parts.length >= 4 && parts[3].trim()) {
              customIcon = parts[3].trim();
              // ダブルクォートで囲まれている場合は除去
              if (customIcon.startsWith('"') && customIcon.endsWith('"')) {
                customIcon = customIcon.slice(1, -1);
                // エスケープされたダブルクォートを元に戻す
                customIcon = customIcon.replace(/""/g, '"');
              }
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

  if (trimmedLine.startsWith('dir,') || trimmedLine.startsWith('group,')) {
    return 'directive';
  }

  return 'item';
}

/**
 * プロファイルフォルダからプロファイル名を取得する
 * @param profilePath - プロファイルフォルダのパス
 * @returns プロファイル名
 */
async function getProfileName(profilePath: string): Promise<string> {
  const prefsPath = path.join(profilePath, 'Preferences');
  try {
    const content = await fs.promises.readFile(prefsPath, 'utf-8');
    const prefs = JSON.parse(content);
    return prefs.profile?.name || path.basename(profilePath);
  } catch {
    return path.basename(profilePath);
  }
}

/**
 * ブラウザのユーザーデータフォルダからプロファイルを検出する
 * @param userDataPath - ユーザーデータフォルダのパス
 * @returns プロファイル情報の配列
 */
async function detectProfiles(userDataPath: string): Promise<BrowserProfile[]> {
  const profiles: BrowserProfile[] = [];

  try {
    const entries = await fs.promises.readdir(userDataPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Default または Profile N のフォルダを検出
      const isProfileFolder = entry.name === 'Default' || /^Profile \d+$/.test(entry.name);

      if (!isProfileFolder) continue;

      const profilePath = path.join(userDataPath, entry.name);
      const bookmarkPath = path.join(profilePath, 'Bookmarks');

      // Bookmarksファイルが存在するか確認
      if (!fs.existsSync(bookmarkPath)) continue;

      const profileName = await getProfileName(profilePath);

      profiles.push({
        id: entry.name,
        name: profileName,
        bookmarkPath: bookmarkPath,
      });
    }
  } catch (error) {
    dataLogger.warn('プロファイルの検出に失敗', { userDataPath, error });
  }

  return profiles;
}

/**
 * インストール済みのブラウザ（Chrome/Edge）を検出する
 * @returns ブラウザ情報の配列
 */
async function detectInstalledBrowsers(): Promise<BrowserInfo[]> {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    dataLogger.warn('LOCALAPPDATA環境変数が設定されていません');
    return [];
  }

  const browsers: BrowserInfo[] = [];

  // Chrome検出
  const chromeUserData = path.join(localAppData, 'Google', 'Chrome', 'User Data');
  if (fs.existsSync(chromeUserData)) {
    const profiles = await detectProfiles(chromeUserData);
    browsers.push({
      id: 'chrome',
      name: 'Google Chrome',
      installed: profiles.length > 0,
      profiles: profiles,
    });
  } else {
    browsers.push({
      id: 'chrome',
      name: 'Google Chrome',
      installed: false,
      profiles: [],
    });
  }

  // Edge検出
  const edgeUserData = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
  if (fs.existsSync(edgeUserData)) {
    const profiles = await detectProfiles(edgeUserData);
    browsers.push({
      id: 'edge',
      name: 'Microsoft Edge',
      installed: profiles.length > 0,
      profiles: profiles,
    });
  } else {
    browsers.push({
      id: 'edge',
      name: 'Microsoft Edge',
      installed: false,
      profiles: [],
    });
  }

  dataLogger.info('ブラウザを検出しました', {
    browsers: browsers.map((b) => ({
      id: b.id,
      installed: b.installed,
      profileCount: b.profiles.length,
    })),
  });

  return browsers;
}

/**
 * ブックマークファイルのパスが許可されたパスかどうかを検証する
 * @param filePath - 検証するファイルパス
 * @returns 許可されたパスならtrue
 */
function isValidBookmarkPath(filePath: string): boolean {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return false;

  const normalizedPath = path.normalize(filePath);
  const allowedPaths = [
    path.join(localAppData, 'Google', 'Chrome', 'User Data'),
    path.join(localAppData, 'Microsoft', 'Edge', 'User Data'),
  ];

  return allowedPaths.some((allowed) => normalizedPath.startsWith(allowed));
}

/**
 * ブラウザのブックマークJSONファイルをパースしてSimpleBookmarkItemの配列に変換する
 * @param filePath - ブックマークファイルのパス
 * @returns SimpleBookmarkItemの配列
 */
async function parseBrowserBookmarks(filePath: string): Promise<SimpleBookmarkItem[]> {
  // セキュリティチェック：許可されたパス内かどうか確認
  if (!isValidBookmarkPath(filePath)) {
    throw new Error('許可されていないファイルパスです');
  }

  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');

    // ファイルサイズチェック（50MB上限）
    if (content.length > 50 * 1024 * 1024) {
      throw new Error('ファイルサイズが大きすぎます');
    }

    const data = JSON.parse(content);

    // 構造の検証
    if (!data.roots || typeof data.roots !== 'object') {
      throw new Error('無効なブックマークファイル形式です');
    }

    const bookmarks: SimpleBookmarkItem[] = [];
    let index = 0;

    // 再帰的にブックマークを抽出
    function traverse(node: Record<string, unknown>) {
      if (node.type === 'url' && typeof node.url === 'string' && typeof node.name === 'string') {
        const url = node.url;
        // http/https のみ許可
        if (url.startsWith('http://') || url.startsWith('https://')) {
          bookmarks.push({
            id: `browser-bookmark-${index++}`,
            name: (node.name as string).trim() || url,
            url: url,
            checked: false,
          });
        }
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child as Record<string, unknown>);
        }
      }
    }

    // roots内の各ノードを探索
    for (const key of ['bookmark_bar', 'other', 'synced']) {
      if (data.roots[key]) {
        traverse(data.roots[key] as Record<string, unknown>);
      }
    }

    dataLogger.info('ブラウザブックマークをパースしました', {
      filePath,
      bookmarkCount: bookmarks.length,
    });

    return bookmarks;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('EBUSY') || error.message.includes('EACCES'))
    ) {
      throw new Error('ブラウザが起動中です。ブラウザを閉じてから再試行してください。');
    }
    dataLogger.error('ブラウザブックマークのパースに失敗', { filePath, error });
    throw error;
  }
}

// 生データを保存
async function saveRawDataFiles(configFolder: string, rawLines: RawDataLine[]): Promise<void> {
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

  // 各ファイルを保存
  for (const [fileName, lines] of fileGroups) {
    const filePath = path.join(configFolder, fileName);

    // バックアップを作成（設定に基づく）
    if (FileUtils.exists(filePath)) {
      const backupService = await BackupService.getInstance();
      await backupService.createBackup(filePath);
    }

    // 行番号でソートして内容を結合
    const sortedLines = lines.sort((a, b) => a.lineNumber - b.lineNumber);
    const content = sortedLines.map((line) => line.content).join('\r\n');

    // ファイルに書き込み
    FileUtils.safeWriteTextFile(filePath, content);
  }
}

interface RegisterItem {
  name: string;
  path: string;
  type: 'url' | 'file' | 'folder' | 'app' | 'customUri';
  args?: string;
  targetTab: string; // データファイル名（例: 'data.txt', 'data2.txt'）※複数ファイルタブの場合はfiles[0]を指定
  targetFile?: string; // 実際の保存先ファイル（タブに複数ファイルがある場合に使用）
  folderProcessing?: 'folder' | 'expand';
  icon?: string;
  customIcon?: string;
  itemCategory: 'item' | 'dir' | 'group';
  // フォルダ取込アイテムオプション
  dirOptions?: {
    depth: number;
    types: 'file' | 'folder' | 'both';
    filter?: string;
    exclude?: string;
    prefix?: string;
    suffix?: string;
  };
  // グループアイテムオプション
  groupItemNames?: string[];
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
      } else {
        let line = `${item.name},${item.path}`;

        // 引数フィールドを追加
        if (item.args) {
          line += `,${item.args}`;
        } else {
          line += ',';
        }

        // カスタムアイコンフィールドを追加
        if (item.customIcon) {
          line += `,${item.customIcon}`;
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
      window.webContents.send('data-changed');
    }
  });
  dataLogger.info('データ変更通知を送信しました', { windowCount: allWindows.length });
}

export function setupDataHandlers(configFolder: string) {
  ipcMain.handle('get-config-folder', () => configFolder);

  ipcMain.handle('get-data-files', async () => {
    const { PathManager } = await import('../config/pathManager.js');
    return PathManager.getDataFiles();
  });

  ipcMain.handle('create-data-file', async (_event, fileName: string) => {
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
        dataLogger.error(`Failed to create file: ${filePath}`, error);
        return { success: false, error: `ファイルの作成に失敗しました: ${error}` };
      }
    }
  });

  ipcMain.handle('delete-data-file', async (_event, fileName: string) => {
    const fs = await import('fs/promises');
    const path = await import('path');

    // data.txtは削除不可
    if (fileName === 'data.txt') {
      return { success: false, error: 'data.txtは削除できません' };
    }

    const filePath = path.join(configFolder, fileName);

    try {
      await fs.unlink(filePath);
      // notifyDataChanged(); // 設定の再読み込みを防ぐため削除
      return { success: true };
    } catch (error) {
      return { success: false, error: `ファイルの削除に失敗しました: ${error}` };
    }
  });

  ipcMain.handle('load-data-files', async () => {
    return await loadDataFiles(configFolder);
  });

  ipcMain.handle('register-items', async (_event, items: RegisterItem[]) => {
    await registerItems(configFolder, items);
    notifyDataChanged();
    return;
  });

  ipcMain.handle('is-directory', async (_event, filePath: string) => {
    return isDirectory(filePath);
  });

  ipcMain.handle('load-raw-data-files', async () => {
    return await loadRawDataFiles(configFolder);
  });

  ipcMain.handle('save-raw-data-files', async (_event, rawLines: RawDataLine[]) => {
    await saveRawDataFiles(configFolder, rawLines);
    notifyDataChanged();
    return;
  });

  ipcMain.handle('select-bookmark-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'ブックマークファイルを選択',
      filters: [
        { name: 'HTML Files', extensions: ['html', 'htm'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('parse-bookmark-file', async (_event, filePath: string) => {
    try {
      const htmlContent = FileUtils.safeReadTextFile(filePath);
      if (!htmlContent) {
        throw new Error('ファイルの読み込みに失敗しました');
      }

      // 簡易的なHTMLパーサーでブックマークを抽出
      const bookmarks: SimpleBookmarkItem[] = [];

      // <A>タグを正規表現で抽出
      const linkRegex = /<A\s+[^>]*HREF="([^"]*)"[^>]*>([^<]*)<\/A>/gi;
      let match;
      let index = 0;

      while ((match = linkRegex.exec(htmlContent)) !== null) {
        const url = match[1];
        const name = match[2].trim();

        // URLが有効な場合のみ追加
        if (url && name && (url.startsWith('http://') || url.startsWith('https://'))) {
          bookmarks.push({
            id: `bookmark-${index}`,
            name: name,
            url: url,
            checked: false,
          });
          index++;
        }
      }

      return bookmarks;
    } catch (error) {
      dataLogger.error('ブックマークファイルのパースに失敗', { error });
      throw error;
    }
  });

  // ブラウザブックマーク直接インポートAPI
  ipcMain.handle('detect-installed-browsers', async () => {
    return await detectInstalledBrowsers();
  });

  ipcMain.handle('parse-browser-bookmarks', async (_event, filePath: string) => {
    return await parseBrowserBookmarks(filePath);
  });
}
