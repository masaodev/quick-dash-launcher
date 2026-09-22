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
  JsonClipboardItem,
  JsonLayoutItem,
} from '@common/types';
import type { ClipboardFormat } from '@common/types/clipboard';
import { JSON_DATA_VERSION, JSON_DATA_SCHEMA_REF, JSON_ID_LENGTH } from '@common/types';

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
const ID_PATTERN = new RegExp(`^[${ID_ALPHABET}]{${JSON_ID_LENGTH}}$`);

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
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

  const result: JsonDataFile = { version: obj.version, items };
  if (typeof obj.$schema === 'string') {
    result.$schema = obj.$schema;
  }
  return result;
}

// ============================================================
// 寛容パース（外部編集されたファイル向け）
// ============================================================

/** 寛容パースで検出した問題の種別 */
export type JsonItemIssueKind =
  /** アイテムが不正（読み込み対象から外すが、ファイル上は保持する） */
  | 'invalid'
  /** id が欠落・不正・重複していたため採番した */
  | 'idAssigned'
  /** ファイル構造を補正した（version・$schema の補完など） */
  | 'normalized';

/** 寛容パースで検出した問題 */
export interface JsonItemIssue {
  /**
   * パース結果 data.items 内のインデックス。
   * ファイル単位の問題、およびオブジェクトでないため削除したアイテムは -1
   * （削除したものは reason に元の位置を書く）
   */
  index: number;
  kind: JsonItemIssueKind;
  /** 問題のアイテムの id（採番後の値。id が無いアイテムは undefined） */
  id?: string;
  /** 人間と AI が読める理由 */
  reason: string;
}

/** 寛容パースの結果 */
export interface LenientParseResult {
  /**
   * パース結果。items には不正なアイテムも元のオブジェクトのまま含む
   * （書き戻し時に消えないようにするため）。読み込みに使う側は
   * validItems を参照する。
   */
  data: JsonDataFile;
  /** 検証を通過した（正規化済みの）アイテムだけ */
  validItems: JsonItem[];
  /** 検出した問題の一覧 */
  issues: JsonItemIssue[];
  /** 採番・補正で内容が変わり、ファイルへの書き戻しが必要 */
  modified: boolean;
}

export interface LenientParseOptions {
  /** 他ファイルで既に使われている id。重複していれば採番し直す */
  reservedIds?: Set<string>;
}

/**
 * JSONデータファイルを寛容にパースする
 *
 * 人や AI が直接編集したファイルを想定し、JSON として壊れていない限り
 * ファイル全体を捨てない。id の欠落・不正・重複は採番で補い、
 * 不正なアイテムは項目単位でスキップして他を生かす。
 *
 * @param content - JSONファイルの内容（文字列）
 * @param options - reservedIds など
 * @returns パース結果と検出した問題
 * @throws JSON 構文エラー、または root/items の構造が不正な場合
 */
export function parseJsonDataFileLenient(
  content: string,
  options: LenientParseOptions = {}
): LenientParseResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON parse error: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid JSON structure: root must be an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.items)) {
    throw new Error('Invalid JSON structure: items must be an array');
  }

  const issues: JsonItemIssue[] = [];
  let modified = false;

  // $schema はエディタ補完・検証のための参照。無い・違うときは同梱スキーマへの相対パスに揃える
  if (obj.$schema !== JSON_DATA_SCHEMA_REF) {
    modified = true;
    issues.push({
      index: -1,
      kind: 'normalized',
      reason:
        obj.$schema === undefined
          ? `$schema が無いため "${JSON_DATA_SCHEMA_REF}" を補いました`
          : `$schema "${String(obj.$schema)}" を "${JSON_DATA_SCHEMA_REF}" に直しました`,
    });
  }

  let version: string;
  if (typeof obj.version === 'string') {
    version = obj.version;
  } else {
    version = JSON_DATA_VERSION;
    modified = true;
    issues.push({
      index: -1,
      kind: 'normalized',
      reason: `version が無いか文字列でないため "${JSON_DATA_VERSION}" を補いました`,
    });
  }

  const seenIds = new Set<string>(options.reservedIds ?? []);
  const items: JsonItem[] = [];
  const validItems: JsonItem[] = [];

  for (let i = 0; i < obj.items.length; i++) {
    const raw = obj.items[i];

    // オブジェクトでないものは保持しようがないので落とす
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      issues.push({
        index: -1,
        kind: 'invalid',
        reason: `元の items[${i}] はオブジェクトでないため削除しました`,
      });
      modified = true;
      continue;
    }

    // 以降の index は data.items 上の位置（削除があると元の位置とずれる）
    const index = items.length;
    const itemObj = { ...(raw as Record<string, unknown>) };

    // id の補完（欠落・不正・重複）
    let id: string;
    if (!isValidId(itemObj.id)) {
      const reason =
        itemObj.id === undefined
          ? 'id が無いため採番しました'
          : `id "${String(itemObj.id)}" が不正なため採番し直しました`;
      id = generateUniqueId(seenIds);
      issues.push({ index, kind: 'idAssigned', id, reason });
      modified = true;
    } else if (seenIds.has(itemObj.id)) {
      id = generateUniqueId(seenIds);
      issues.push({
        index,
        kind: 'idAssigned',
        id,
        reason: `id "${itemObj.id}" が重複しているため採番し直しました`,
      });
      modified = true;
    } else {
      id = itemObj.id;
    }
    itemObj.id = id;
    seenIds.add(id);

    try {
      const validatedItem = validateJsonItem(itemObj, index);
      items.push(validatedItem);
      validItems.push(validatedItem);
    } catch (error) {
      issues.push({
        index,
        kind: 'invalid',
        id,
        reason: error instanceof Error ? error.message : String(error),
      });
      // 不正でもファイル上には残す（AI や人が直せるように）
      items.push(itemObj as unknown as JsonItem);
    }
  }

  return {
    data: { $schema: JSON_DATA_SCHEMA_REF, version, items },
    validItems,
    issues,
    modified,
  };
}

/**
 * 使用済み id と衝突しない id を生成する
 */
function generateUniqueId(usedIds: Set<string>): string {
  let id = generateId();
  while (usedIds.has(id)) {
    id = generateId();
  }
  return id;
}

/**
 * JsonDataFileを文字列にシリアライズする
 *
 * キー順は $schema → version → items に固定する。$schema が無ければ同梱スキーマへの
 * 参照を補う（QDL が書くファイルには常に付く）。
 *
 * @param data - シリアライズするJsonDataFile
 * @param pretty - 整形出力するかどうか（デフォルト: true）
 * @returns JSON文字列
 *
 * @example
 * ```typescript
 * const json = serializeJsonDataFile({ version: '1.0', items: [] });
 * // => '{\n  "$schema": "../schemas/data.schema.json",\n  "version": "1.0",\n  "items": []\n}'
 * ```
 */
export function serializeJsonDataFile(data: JsonDataFile, pretty: boolean = true): string {
  const ordered: JsonDataFile = {
    $schema: data.$schema ?? JSON_DATA_SCHEMA_REF,
    version: data.version,
    items: data.items,
  };
  if (pretty) {
    return JSON.stringify(ordered, null, 2);
  }
  return JSON.stringify(ordered);
}

/**
 * 空のJsonDataFileを作成する
 *
 * @returns 空のJsonDataFile
 */
export function createEmptyJsonDataFile(): JsonDataFile {
  return {
    $schema: JSON_DATA_SCHEMA_REF,
    version: JSON_DATA_VERSION,
    items: [],
  };
}

// ============================================================
// バリデーションヘルパー
// ============================================================

/** ウィンドウ関連の数値フィールド */
const WINDOW_NUMERIC_FIELDS = ['x', 'y', 'width', 'height', 'virtualDesktopNumber'] as const;

/** ウィンドウ関連のブーリアンフィールド */
const WINDOW_BOOLEAN_FIELDS = [
  'moveToActiveMonitorCenter',
  'activateWindow',
  'pinToAllDesktops',
] as const;

/**
 * オプションの文字列フィールドを検証・設定
 */
function validateOptionalString(
  source: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any,
  field: string
): void {
  if (source[field] !== undefined) {
    if (typeof source[field] !== 'string') {
      throw new Error(`${field} must be a string`);
    }
    target[field] = source[field];
  }
}

/**
 * 指定された型のフィールドを検証・設定
 */
function validateTypedFields(
  source: Record<string, unknown>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  target: any,
  fields: readonly string[],
  expectedType: 'number' | 'boolean',
  prefix: string = ''
): void {
  for (const field of fields) {
    if (source[field] !== undefined) {
      if (typeof source[field] !== expectedType) {
        throw new Error(`${prefix}${field} must be a ${expectedType}`);
      }
      target[field] = source[field];
    }
  }
}

// ============================================================
// アイテムバリデーション
// ============================================================

/**
 * JSONアイテムを検証し、型付きオブジェクトとして返す
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
    case 'clipboard':
      return validateJsonClipboardItem(obj);
    case 'layout':
      return validateJsonLayoutItem(obj);
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

  validateOptionalString(obj, item, 'args');
  validateOptionalString(obj, item, 'customIcon');
  validateOptionalString(obj, item, 'memo');
  validateOptionalString(obj, item, 'autoImportRuleId');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

  if (obj.windowConfig !== undefined) {
    item.windowConfig = validateWindowConfig(obj.windowConfig);
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

    validateOptionalString(opts, item.options, 'filter');
    validateOptionalString(opts, item.options, 'exclude');
    validateOptionalString(opts, item.options, 'prefix');
    validateOptionalString(opts, item.options, 'suffix');
  }

  validateOptionalString(obj, item, 'memo');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

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

  validateOptionalString(obj, item, 'memo');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

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

  validateTypedFields(obj, item, WINDOW_NUMERIC_FIELDS, 'number');
  validateTypedFields(obj, item, WINDOW_BOOLEAN_FIELDS, 'boolean');
  validateOptionalString(obj, item, 'processName');
  validateOptionalString(obj, item, 'memo');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

  return item;
}

/** 有効なクリップボードフォーマット */
const VALID_CLIPBOARD_FORMATS: ClipboardFormat[] = ['text', 'html', 'rtf', 'image', 'file'];

/**
 * JsonClipboardItemを検証
 */
function validateJsonClipboardItem(obj: Record<string, unknown>): JsonClipboardItem {
  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error('displayName is required and must be a non-empty string');
  }
  if (typeof obj.dataFileRef !== 'string' || !obj.dataFileRef) {
    throw new Error('dataFileRef is required and must be a non-empty string');
  }
  if (typeof obj.savedAt !== 'number') {
    throw new Error('savedAt is required and must be a number');
  }
  if (!Array.isArray(obj.formats)) {
    throw new Error('formats is required and must be an array');
  }

  for (let i = 0; i < obj.formats.length; i++) {
    const format = obj.formats[i];
    if (
      typeof format !== 'string' ||
      !VALID_CLIPBOARD_FORMATS.includes(format as ClipboardFormat)
    ) {
      throw new Error(`formats[${i}] must be one of: ${VALID_CLIPBOARD_FORMATS.join(', ')}`);
    }
  }

  const item: JsonClipboardItem = {
    id: obj.id as string,
    type: 'clipboard',
    displayName: obj.displayName,
    dataFileRef: obj.dataFileRef,
    savedAt: obj.savedAt,
    formats: obj.formats as ClipboardFormat[],
  };

  validateOptionalString(obj, item, 'preview');
  validateOptionalString(obj, item, 'customIcon');
  validateOptionalString(obj, item, 'memo');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

  return item;
}

/**
 * JsonLayoutItemを検証
 */
function validateJsonLayoutItem(obj: Record<string, unknown>): JsonLayoutItem {
  if (typeof obj.displayName !== 'string' || !obj.displayName) {
    throw new Error('displayName is required and must be a non-empty string');
  }
  if (!Array.isArray(obj.entries)) {
    throw new Error('entries is required and must be an array');
  }

  const item: JsonLayoutItem = {
    id: obj.id as string,
    type: 'layout',
    displayName: obj.displayName,
    entries: obj.entries as JsonLayoutItem['entries'],
  };

  validateOptionalString(obj, item, 'memo');
  validateTypedFields(obj, item, ['updatedAt'], 'number');

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

  if (obj.processName !== undefined) {
    if (typeof obj.processName !== 'string') {
      throw new Error('windowConfig.processName must be a string');
    }
    result.processName = obj.processName;
  }

  validateTypedFields(obj, result, WINDOW_NUMERIC_FIELDS, 'number', 'windowConfig.');
  validateTypedFields(obj, result, WINDOW_BOOLEAN_FIELDS, 'boolean', 'windowConfig.');

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

/**
 * 新しいJsonClipboardItemを作成（IDは自動生成）
 */
export function createJsonClipboardItem(
  displayName: string,
  dataFileRef: string,
  formats: ClipboardFormat[],
  savedAt: number,
  options?: Omit<
    JsonClipboardItem,
    'id' | 'type' | 'displayName' | 'dataFileRef' | 'formats' | 'savedAt'
  >
): JsonClipboardItem {
  return {
    id: generateId(),
    type: 'clipboard',
    displayName,
    dataFileRef,
    formats,
    savedAt,
    ...options,
  };
}
