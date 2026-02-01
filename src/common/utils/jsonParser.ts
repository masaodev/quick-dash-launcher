/**
 * JSONデータファイルのパーサーユーティリティ
 *
 * data.json形式のファイルの読み込み・書き込み・ID生成を行う
 */

import type {
  JsonDataFile,
  JsonItem,
  JsonLauncherItem,
  JsonDirItem,
  JsonGroupItem,
  JsonWindowItem,
} from '@common/types';
import { JSON_DATA_VERSION, JSON_ID_LENGTH } from '@common/types';

// ============================================================
// ID生成
// ============================================================

/** ID生成に使用する文字セット（英数字） */
const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 一意のIDを生成する（8文字の英数字）
 *
 * @returns 8文字の一意ID
 *
 * @example
 * ```typescript
 * const id = generateId();
 * // => 'a1B2c3D4'
 * ```
 */
export function generateId(): string {
  let result = '';
  const alphabetLength = ID_ALPHABET.length;

  for (let i = 0; i < JSON_ID_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * alphabetLength);
    result += ID_ALPHABET[randomIndex];
  }

  return result;
}

/**
 * ID文字列が有効かどうかを検証
 *
 * @param id - 検証するID文字列
 * @returns 有効な場合はtrue
 */
export function isValidId(id: unknown): id is string {
  if (typeof id !== 'string') {
    return false;
  }
  if (id.length !== JSON_ID_LENGTH) {
    return false;
  }
  // 全ての文字がID_ALPHABETに含まれているか
  for (const char of id) {
    if (!ID_ALPHABET.includes(char)) {
      return false;
    }
  }
  return true;
}

// ============================================================
// JSONファイル読み込み・書き込み
// ============================================================

/**
 * JSONデータファイルの内容をパースする
 *
 * @param content - JSONファイルの内容（文字列）
 * @returns パースされたJsonDataFile
 * @throws パースエラー、バリデーションエラー
 *
 * @example
 * ```typescript
 * const data = parseJsonDataFile('{"version":"1.0","items":[]}');
 * // => { version: '1.0', items: [] }
 * ```
 */
export function parseJsonDataFile(content: string): JsonDataFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  // 基本構造の検証
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid JSON structure: root must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  // version フィールドの検証
  if (typeof obj.version !== 'string') {
    throw new Error('Invalid JSON structure: version must be a string');
  }

  // items フィールドの検証
  if (!Array.isArray(obj.items)) {
    throw new Error('Invalid JSON structure: items must be an array');
  }

  // 各アイテムの検証
  const items: JsonItem[] = [];
  for (let i = 0; i < obj.items.length; i++) {
    const item = obj.items[i];
    try {
      const validatedItem = validateJsonItem(item, i);
      items.push(validatedItem);
    } catch (error) {
      throw new Error(
        `Invalid item at index ${i}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    version: obj.version,
    items,
  };
}

/**
 * JsonDataFileを文字列にシリアライズする
 *
 * @param data - シリアライズするJsonDataFile
 * @param pretty - 整形出力するかどうか（デフォルト: true）
 * @returns JSON文字列
 *
 * @example
 * ```typescript
 * const json = serializeJsonDataFile({ version: '1.0', items: [] });
 * // => '{\n  "version": "1.0",\n  "items": []\n}'
 * ```
 */
export function serializeJsonDataFile(data: JsonDataFile, pretty: boolean = true): string {
  if (pretty) {
    return JSON.stringify(data, null, 2);
  }
  return JSON.stringify(data);
}

/**
 * 空のJsonDataFileを作成する
 *
 * @returns 空のJsonDataFile
 */
export function createEmptyJsonDataFile(): JsonDataFile {
  return {
    version: JSON_DATA_VERSION,
    items: [],
  };
}

// ============================================================
// アイテムバリデーション
// ============================================================

/**
 * JSONアイテムを検証し、型付きオブジェクトとして返す
 *
 * @param item - 検証するアイテム（unknown型）
 * @param index - アイテムのインデックス（エラーメッセージ用）
 * @returns 検証済みのJsonItem
 * @throws バリデーションエラー
 */
function validateJsonItem(item: unknown, index: number): JsonItem {
  if (!item || typeof item !== 'object') {
    throw new Error('Item must be an object');
  }

  const obj = item as Record<string, unknown>;

  // id の検証
  if (!isValidId(obj.id)) {
    throw new Error(`Invalid or missing id at index ${index}`);
  }

  // type の検証
  if (typeof obj.type !== 'string') {
    throw new Error('type must be a string');
  }

  switch (obj.type) {
    case 'item':
      return validateJsonLauncherItem(obj);
    case 'dir':
      return validateJsonDirItem(obj);
    case 'group':
      return validateJsonGroupItem(obj);
    case 'window':
      return validateJsonWindowItem(obj);
    default:
      throw new Error(`Unknown item type: ${obj.type}`);
  }
}

/**
 * JsonLauncherItemを検証
 */
function validateJsonLauncherItem(obj: Record<string, unknown>): JsonLauncherItem {
  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error('displayName is required and must be a non-empty string');
  }
  if (typeof obj.path !== 'string' || !obj.path) {
    throw new Error('path is required and must be a non-empty string');
  }

  const item: JsonLauncherItem = {
    id: obj.id as string,
    type: 'item',
    displayName: obj.displayName,
    path: obj.path,
  };

  // オプションフィールド
  if (obj.args !== undefined) {
    if (typeof obj.args !== 'string') {
      throw new Error('args must be a string');
    }
    item.args = obj.args;
  }

  if (obj.customIcon !== undefined) {
    if (typeof obj.customIcon !== 'string') {
      throw new Error('customIcon must be a string');
    }
    item.customIcon = obj.customIcon;
  }

  if (obj.windowConfig !== undefined) {
    item.windowConfig = validateWindowConfig(obj.windowConfig);
  }

  if (obj.memo !== undefined) {
    if (typeof obj.memo !== 'string') {
      throw new Error('memo must be a string');
    }
    item.memo = obj.memo;
  }

  return item;
}

/**
 * JsonDirItemを検証
 */
function validateJsonDirItem(obj: Record<string, unknown>): JsonDirItem {
  if (typeof obj.path !== 'string' || !obj.path) {
    throw new Error('path is required and must be a non-empty string');
  }

  const item: JsonDirItem = {
    id: obj.id as string,
    type: 'dir',
    path: obj.path,
  };

  // オプションフィールド
  if (obj.options !== undefined) {
    if (typeof obj.options !== 'object' || obj.options === null) {
      throw new Error('options must be an object');
    }

    const opts = obj.options as Record<string, unknown>;
    item.options = {};

    if (opts.depth !== undefined) {
      if (typeof opts.depth !== 'number') {
        throw new Error('options.depth must be a number');
      }
      item.options.depth = opts.depth;
    }

    if (opts.types !== undefined) {
      if (opts.types !== 'file' && opts.types !== 'folder' && opts.types !== 'both') {
        throw new Error('options.types must be "file", "folder", or "both"');
      }
      item.options.types = opts.types;
    }

    if (opts.filter !== undefined) {
      if (typeof opts.filter !== 'string') {
        throw new Error('options.filter must be a string');
      }
      item.options.filter = opts.filter;
    }

    if (opts.exclude !== undefined) {
      if (typeof opts.exclude !== 'string') {
        throw new Error('options.exclude must be a string');
      }
      item.options.exclude = opts.exclude;
    }

    if (opts.prefix !== undefined) {
      if (typeof opts.prefix !== 'string') {
        throw new Error('options.prefix must be a string');
      }
      item.options.prefix = opts.prefix;
    }

    if (opts.suffix !== undefined) {
      if (typeof opts.suffix !== 'string') {
        throw new Error('options.suffix must be a string');
      }
      item.options.suffix = opts.suffix;
    }
  }

  if (obj.memo !== undefined) {
    if (typeof obj.memo !== 'string') {
      throw new Error('memo must be a string');
    }
    item.memo = obj.memo;
  }

  return item;
}

/**
 * JsonGroupItemを検証
 */
function validateJsonGroupItem(obj: Record<string, unknown>): JsonGroupItem {
  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error('displayName is required and must be a non-empty string');
  }
  if (!Array.isArray(obj.itemNames)) {
    throw new Error('itemNames is required and must be an array');
  }
  for (let i = 0; i < obj.itemNames.length; i++) {
    if (typeof obj.itemNames[i] !== 'string') {
      throw new Error(`itemNames[${i}] must be a string`);
    }
  }

  const item: JsonGroupItem = {
    id: obj.id as string,
    type: 'group',
    displayName: obj.displayName,
    itemNames: obj.itemNames as string[],
  };

  if (obj.memo !== undefined) {
    if (typeof obj.memo !== 'string') {
      throw new Error('memo must be a string');
    }
    item.memo = obj.memo;
  }

  return item;
}

/**
 * JsonWindowItemを検証
 */
function validateJsonWindowItem(obj: Record<string, unknown>): JsonWindowItem {
  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error('displayName is required and must be a non-empty string');
  }
  if (typeof obj.windowTitle !== 'string' || !obj.windowTitle) {
    throw new Error('windowTitle is required and must be a non-empty string');
  }

  const item: JsonWindowItem = {
    id: obj.id as string,
    type: 'window',
    displayName: obj.displayName,
    windowTitle: obj.windowTitle,
  };

  // オプションフィールド（数値）
  const numericFields = ['x', 'y', 'width', 'height', 'virtualDesktopNumber'] as const;
  for (const field of numericFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'number') {
        throw new Error(`${field} must be a number`);
      }
      item[field] = obj[field] as number;
    }
  }

  // オプションフィールド（文字列）
  if (obj.processName !== undefined) {
    if (typeof obj.processName !== 'string') {
      throw new Error('processName must be a string');
    }
    item.processName = obj.processName;
  }

  // オプションフィールド（ブーリアン）
  const booleanFields = [
    'moveToActiveMonitorCenter',
    'activateWindow',
    'pinToAllDesktops',
  ] as const;
  for (const field of booleanFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'boolean') {
        throw new Error(`${field} must be a boolean`);
      }
      item[field] = obj[field] as boolean;
    }
  }

  if (obj.memo !== undefined) {
    if (typeof obj.memo !== 'string') {
      throw new Error('memo must be a string');
    }
    item.memo = obj.memo;
  }

  return item;
}

/**
 * WindowConfigを検証
 */
function validateWindowConfig(config: unknown): JsonLauncherItem['windowConfig'] {
  if (typeof config !== 'object' || config === null) {
    throw new Error('windowConfig must be an object');
  }

  const obj = config as Record<string, unknown>;

  // titleはオプションとして扱う（古いデータとの互換性のため）
  const result: NonNullable<JsonLauncherItem['windowConfig']> = {
    title: '',
  };

  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string') {
      throw new Error('windowConfig.title must be a string');
    }
    result.title = obj.title;
  }

  // オプションフィールド（文字列）
  if (obj.processName !== undefined) {
    if (typeof obj.processName !== 'string') {
      throw new Error('windowConfig.processName must be a string');
    }
    result.processName = obj.processName;
  }

  // オプションフィールド（数値）
  const numericFields = ['x', 'y', 'width', 'height', 'virtualDesktopNumber'] as const;
  for (const field of numericFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'number') {
        throw new Error(`windowConfig.${field} must be a number`);
      }
      result[field] = obj[field] as number;
    }
  }

  // オプションフィールド（ブーリアン）
  const booleanFields = [
    'moveToActiveMonitorCenter',
    'activateWindow',
    'pinToAllDesktops',
  ] as const;
  for (const field of booleanFields) {
    if (obj[field] !== undefined) {
      if (typeof obj[field] !== 'boolean') {
        throw new Error(`windowConfig.${field} must be a boolean`);
      }
      result[field] = obj[field] as boolean;
    }
  }

  return result;
}

// ============================================================
// アイテム作成ヘルパー
// ============================================================

/**
 * 新しいJsonLauncherItemを作成（IDは自動生成）
 */
export function createJsonLauncherItem(
  displayName: string,
  path: string,
  options?: Omit<JsonLauncherItem, 'id' | 'type' | 'displayName' | 'path'>
): JsonLauncherItem {
  return {
    id: generateId(),
    type: 'item',
    displayName,
    path,
    ...options,
  };
}

/**
 * 新しいJsonDirItemを作成（IDは自動生成）
 */
export function createJsonDirItem(path: string, options?: JsonDirItem['options']): JsonDirItem {
  const item: JsonDirItem = {
    id: generateId(),
    type: 'dir',
    path,
  };
  if (options) {
    item.options = options;
  }
  return item;
}

/**
 * 新しいJsonGroupItemを作成（IDは自動生成）
 */
export function createJsonGroupItem(displayName: string, itemNames: string[]): JsonGroupItem {
  return {
    id: generateId(),
    type: 'group',
    displayName,
    itemNames,
  };
}

/**
 * 新しいJsonWindowItemを作成（IDは自動生成）
 */
export function createJsonWindowItem(
  displayName: string,
  windowTitle: string,
  options?: Omit<JsonWindowItem, 'id' | 'type' | 'displayName' | 'windowTitle'>
): JsonWindowItem {
  return {
    id: generateId(),
    type: 'window',
    displayName,
    windowTitle,
    ...options,
  };
}
