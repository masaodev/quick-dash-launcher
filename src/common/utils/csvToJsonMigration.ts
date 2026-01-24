/**
 * CSV形式からJSON形式へのマイグレーションユーティリティ
 *
 * data.txt (CSV形式) から data.json (JSON形式) への変換を行う
 */

import type {
  JsonDataFile,
  JsonItem,
  JsonLauncherItem,
  JsonDirItem,
  JsonGroupItem,
  JsonWindowItem,
  JsonDirOptions,
} from '@common/types';
import { JSON_DATA_VERSION } from '@common/types';

import { parseCSVLine } from './csvParser';
import { generateId } from './jsonParser';
import { parseWindowConfig } from './windowConfigUtils';

// ============================================================
// CSV行の種別判定
// ============================================================

/**
 * CSV行の種別
 */
export type CsvLineType = 'item' | 'dir' | 'group' | 'window' | 'comment' | 'empty';

/**
 * CSV行の種別を判定する
 *
 * @param line - CSV行
 * @returns 行の種別
 */
export function detectCsvLineType(line: string): CsvLineType {
  const trimmed = line.trim();

  if (!trimmed) {
    return 'empty';
  }

  if (trimmed.startsWith('//')) {
    return 'comment';
  }

  if (trimmed.startsWith('dir,')) {
    return 'dir';
  }

  if (trimmed.startsWith('group,')) {
    return 'group';
  }

  if (trimmed.startsWith('window,')) {
    return 'window';
  }

  return 'item';
}

// ============================================================
// CSV→JSON変換
// ============================================================

/**
 * CSV行をJsonItemに変換する
 *
 * @param line - CSV行
 * @returns 変換されたJsonItem、またはnull（コメント/空行の場合）
 * @throws 変換エラー
 */
export function convertCsvLineToJsonItem(line: string): JsonItem | null {
  const lineType = detectCsvLineType(line);

  switch (lineType) {
    case 'empty':
    case 'comment':
      return null;
    case 'item':
      return convertCsvItemLine(line);
    case 'dir':
      return convertCsvDirLine(line);
    case 'group':
      return convertCsvGroupLine(line);
    case 'window':
      return convertCsvWindowLine(line);
    default:
      throw new Error(`Unknown line type: ${lineType}`);
  }
}

/**
 * 通常のCSVアイテム行をJsonLauncherItemに変換
 *
 * CSVフォーマット: displayName,path,args,customIcon,windowConfig
 */
function convertCsvItemLine(line: string): JsonLauncherItem {
  const parts = parseCSVLine(line);

  if (parts.length < 2) {
    throw new Error(`Invalid item line: requires at least 2 fields (displayName, path)`);
  }

  const [displayName, path, argsField, customIconField, windowConfigField] = parts;

  if (!displayName || !path) {
    throw new Error(`Invalid item line: displayName and path are required`);
  }

  const item: JsonLauncherItem = {
    id: generateId(),
    type: 'item',
    displayName,
    path,
  };

  // オプションフィールド
  if (argsField && argsField.trim()) {
    item.args = argsField;
  }

  if (customIconField && customIconField.trim()) {
    item.customIcon = customIconField;
  }

  if (windowConfigField && windowConfigField.trim()) {
    const windowConfig = parseWindowConfig(windowConfigField);
    if (windowConfig) {
      item.windowConfig = windowConfig;
    }
  }

  return item;
}

/**
 * フォルダ取込CSV行をJsonDirItemに変換
 *
 * CSVフォーマット: dir,path,option1=value1,option2=value2,...
 */
function convertCsvDirLine(line: string): JsonDirItem {
  const parts = parseCSVLine(line);

  if (parts.length < 2) {
    throw new Error(`Invalid dir line: requires at least path`);
  }

  const dirPath = parts[1];
  if (!dirPath) {
    throw new Error(`Invalid dir line: path is required`);
  }

  const item: JsonDirItem = {
    id: generateId(),
    type: 'dir',
    path: dirPath,
  };

  // オプションフィールドのパース
  if (parts.length > 2) {
    const optionsStr = parts.slice(2).join(',').trim();
    if (optionsStr) {
      const options = parseDirOptionsString(optionsStr);
      if (Object.keys(options).length > 0) {
        item.options = options;
      }
    }
  }

  return item;
}

/**
 * dirオプション文字列をJsonDirOptionsに変換
 *
 * @param optionsStr - "depth=1,types=file,filter=*.exe" 形式の文字列
 * @returns JsonDirOptions
 */
function parseDirOptionsString(optionsStr: string): JsonDirOptions {
  const options: JsonDirOptions = {};

  if (!optionsStr) {
    return options;
  }

  // key=value 形式をパース
  const optionParts = optionsStr.split(',');

  for (const part of optionParts) {
    const equalIndex = part.indexOf('=');
    if (equalIndex === -1) continue;

    const key = part.substring(0, equalIndex).trim();
    const value = part.substring(equalIndex + 1).trim();

    switch (key) {
      case 'depth':
        const depth = parseInt(value, 10);
        if (!isNaN(depth)) {
          options.depth = depth;
        }
        break;
      case 'types':
        if (value === 'file' || value === 'folder' || value === 'both') {
          options.types = value;
        }
        break;
      case 'filter':
        options.filter = value;
        break;
      case 'exclude':
        options.exclude = value;
        break;
      case 'prefix':
        options.prefix = value;
        break;
      case 'suffix':
        options.suffix = value;
        break;
    }
  }

  return options;
}

/**
 * グループCSV行をJsonGroupItemに変換
 *
 * CSVフォーマット: group,groupName,itemName1,itemName2,...
 */
function convertCsvGroupLine(line: string): JsonGroupItem {
  const parts = parseCSVLine(line);

  if (parts.length < 3) {
    throw new Error(`Invalid group line: requires at least group name and one item name`);
  }

  const groupName = parts[1];
  if (!groupName) {
    throw new Error(`Invalid group line: group name is required`);
  }

  const itemNames = parts.slice(2).filter((name) => name && name.trim());
  if (itemNames.length === 0) {
    throw new Error(`Invalid group line: at least one item name is required`);
  }

  return {
    id: generateId(),
    type: 'group',
    displayName: groupName,
    itemNames,
  };
}

/**
 * ウィンドウ操作CSV行をJsonWindowItemに変換
 *
 * CSVフォーマット: window,{JSON形式の設定}
 */
function convertCsvWindowLine(line: string): JsonWindowItem {
  const parts = parseCSVLine(line);

  if (parts.length < 2) {
    throw new Error(`Invalid window line: requires JSON config`);
  }

  const configStr = parts[1];
  if (!configStr || !configStr.trim().startsWith('{')) {
    throw new Error(`Invalid window line: JSON config is required`);
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(configStr);
  } catch (error) {
    throw new Error(
      `Invalid window line: JSON parse error - ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // displayName は config.displayName または config.name から取得
  const displayName = (config.displayName as string) || (config.name as string) || '';
  const windowTitle = (config.windowTitle as string) || '';

  if (!displayName || !windowTitle) {
    throw new Error(`Invalid window line: displayName and windowTitle are required`);
  }

  const item: JsonWindowItem = {
    id: generateId(),
    type: 'window',
    displayName,
    windowTitle,
  };

  // オプションフィールド
  if (typeof config.processName === 'string') {
    item.processName = config.processName;
  }
  if (typeof config.x === 'number') {
    item.x = config.x;
  }
  if (typeof config.y === 'number') {
    item.y = config.y;
  }
  if (typeof config.width === 'number') {
    item.width = config.width;
  }
  if (typeof config.height === 'number') {
    item.height = config.height;
  }
  if (typeof config.moveToActiveMonitorCenter === 'boolean') {
    item.moveToActiveMonitorCenter = config.moveToActiveMonitorCenter;
  }
  if (typeof config.virtualDesktopNumber === 'number') {
    item.virtualDesktopNumber = config.virtualDesktopNumber;
  }
  if (typeof config.activateWindow === 'boolean') {
    item.activateWindow = config.activateWindow;
  }
  if (typeof config.pinToAllDesktops === 'boolean') {
    item.pinToAllDesktops = config.pinToAllDesktops;
  }

  return item;
}

// ============================================================
// ファイル単位の変換
// ============================================================

/**
 * CSVファイルの内容全体をJsonDataFileに変換する
 *
 * @param csvContent - CSVファイルの内容
 * @returns 変換されたJsonDataFile
 */
export function convertCsvToJsonDataFile(csvContent: string): JsonDataFile {
  const lines = csvContent.split(/\r\n|\n|\r/);
  const items: JsonItem[] = [];
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    try {
      const item = convertCsvLineToJsonItem(line);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Line ${lineNumber}: ${errorMessage}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`CSV conversion errors:\n${errors.join('\n')}`);
  }

  return {
    version: JSON_DATA_VERSION,
    items,
  };
}

/**
 * CSVファイルの内容をJsonDataFileに変換する（エラーをスキップ）
 *
 * パースエラーが発生した行はスキップし、成功した行のみを変換する
 *
 * @param csvContent - CSVファイルの内容
 * @returns 変換結果とスキップされた行の情報
 */
export function convertCsvToJsonDataFileWithSkip(csvContent: string): {
  data: JsonDataFile;
  skippedLines: Array<{ lineNumber: number; content: string; error: string }>;
} {
  const lines = csvContent.split(/\r\n|\n|\r/);
  const items: JsonItem[] = [];
  const skippedLines: Array<{ lineNumber: number; content: string; error: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    try {
      const item = convertCsvLineToJsonItem(line);
      if (item) {
        items.push(item);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      skippedLines.push({
        lineNumber,
        content: line,
        error: errorMessage,
      });
    }
  }

  return {
    data: {
      version: JSON_DATA_VERSION,
      items,
    },
    skippedLines,
  };
}

// ============================================================
// ファイル名変換
// ============================================================

/**
 * CSVファイル名をJSONファイル名に変換
 *
 * @param csvFileName - CSVファイル名（例: "data.txt", "data2.txt"）
 * @returns JSONファイル名（例: "data.json", "data2.json"）
 */
export function convertCsvFileNameToJson(csvFileName: string): string {
  if (!csvFileName.endsWith('.txt')) {
    throw new Error(`Invalid CSV file name: ${csvFileName} (must end with .txt)`);
  }
  return csvFileName.replace(/\.txt$/, '.json');
}

/**
 * JSONファイル名をCSVファイル名に変換
 *
 * @param jsonFileName - JSONファイル名（例: "data.json", "data2.json"）
 * @returns CSVファイル名（例: "data.txt", "data2.txt"）
 */
export function convertJsonFileNameToCsv(jsonFileName: string): string {
  if (!jsonFileName.endsWith('.json')) {
    throw new Error(`Invalid JSON file name: ${jsonFileName} (must end with .json)`);
  }
  return jsonFileName.replace(/\.json$/, '.txt');
}

/**
 * ファイル名がCSVデータファイル（data*.txt）かどうかを判定
 */
export function isCsvDataFile(fileName: string): boolean {
  return fileName.startsWith('data') && fileName.endsWith('.txt');
}

/**
 * ファイル名がJSONデータファイル（data*.json）かどうかを判定
 */
export function isJsonDataFile(fileName: string): boolean {
  return fileName.startsWith('data') && fileName.endsWith('.json');
}
